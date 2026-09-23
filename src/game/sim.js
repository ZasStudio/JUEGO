// Simulación: tiempo, necesidades, economía, correos, pedidos, patrocinios, videos y progreso.
import { S, bus, now, addMoney, notify, uid, pick, randi, rand, chance, clamp, skill, fmtMoney, fmtNum, addXP } from '../core/state.js';
import { updateTrends, GAME, GAMES } from '../data/games.js';
import { PARTS, partsBySlot, pcScore, powerDraw, part, SLOT_ORDER } from '../data/parts.js';
import { FOOD, INTERNET, RENT, peripheral } from '../data/items.js';
import { CLIENTS, BRANDS, STREAMERS } from '../data/chat.js';
import { QUESTS, ACHIEVEMENTS } from '../data/progress.js';
import { sfx } from '../core/audio.js';

export const sim = { streaming: false };

export function refreshDerived() {
  S._pcScore = pcScore(S.pc.parts);
}

// Avanza el reloj N minutos de juego procesando eventos
export function tick(minutes) {
  for (let i = 0; i < minutes; i++) stepMinute();
}

let accum = 0;
export function realtimeTick(dt, speed = 1, perMinute) {
  accum += dt * speed;
  let n = 0;
  while (accum >= 1) { accum -= 1; stepMinute(); perMinute?.(); n++; }
  return n;
}

function stepMinute() {
  const prevHour = Math.floor(S.minute / 60);
  S.minute += 1;
  if (S.minute >= 1440) { S.minute -= 1440; S.day += 1; onNewDay(); }
  decayNeeds(1);
  // Entregas
  const t = now();
  const arrived = S.deliveries.filter((d) => d.at <= t);
  if (arrived.length) {
    S.deliveries = S.deliveries.filter((d) => d.at > t);
    arrived.forEach((d) => S.doorPackages.push(...d.items));
    notify('📦 ¡Llegó un paquete a tu puerta!', 'good');
    sfx.notify();
    bus.emit('packages');
  }
  if (Math.floor(S.minute / 60) !== prevHour) onNewHour();
  if (S.minute % 10 === 0) checkProgress();
}

export function decayNeeds(m, mult = {}) {
  const N = S.needs;
  const streaming = sim.streaming;
  const chair = peripheral(S.peripherals.chair)?.q || 0;
  N.hunger = clamp(N.hunger - 0.065 * m * (mult.hunger ?? 1), 0, 100);
  N.energy = clamp(N.energy - (streaming ? 0.085 * (1 - chair) : 0.05) * m * (N.hunger < 10 ? 1.6 : 1) * (mult.energy ?? 1), 0, 100);
  N.hygiene = clamp(N.hygiene - 0.035 * m * (mult.hygiene ?? 1), 0, 100);
  N.fun = clamp(N.fun - 0.03 * m * (mult.fun ?? 1), 0, 100);
  if (N.energy <= 0 && !mult.noFaint) bus.emit('faint');
}

export const mood = () => {
  const N = S.needs;
  const low = Math.min(N.hunger, N.energy, N.hygiene, N.fun);
  return clamp((N.hunger + N.energy + N.hygiene + N.fun) / 4 * 0.7 + low * 0.3, 0, 100);
};

function onNewHour() {
  updateVideos(1);
  // Electricidad: consumo de la PC
  const kw = powerDraw(S.pc.parts) / 1000;
  S.bills.electricity += kw * (sim.streaming ? 1 : 0.15) * 0.25 + 0.02;
  // Seguidores pasivos por videos existentes / presencia en redes
  if (S.stats.followers > 50 && chance(0.3)) S.stats.followers += randi(0, Math.ceil(S.stats.followers * 0.002));
  bus.emit('hour');
}

function onNewDay() {
  updateTrends(S);
  S.social.postsToday = 0;
  // Polvo acumulado en la PC
  S.pc.dust = clamp(S.pc.dust + 6 + rand(0, 4), 0, 100);
  // Pérdida de suscriptores (meses que no renuevan) y ganancia pasiva de subs
  if (S.stats.subs > 0) {
    const lost = Math.floor(S.stats.subs * rand(0.01, 0.04));
    S.stats.subs -= lost;
    if (S.flags.affiliate) {
      const income = S.stats.subs * (S.flags.partner ? 0.18 : 0.12);
      if (income >= 1) addMoney(income, 'Suscripciones (pago diario)');
    }
  }
  // Facturas semanales
  if (S.day >= S.bills.nextBillDay) {
    const net = INTERNET.find((n) => n.id === S.internet);
    const total = RENT + net.price + Math.round(S.bills.electricity);
    S.bills.nextBillDay += 7;
    pushEmail({ from: 'Administración Residencial Luna', subject: `Facturas de la semana: ${fmtMoney(total)}`, body: `Renta: ${fmtMoney(RENT)}\nInternet (${net.name}): ${fmtMoney(net.price)}\nElectricidad: ${fmtMoney(S.bills.electricity)}\n\nSe descontó de tu cuenta automáticamente.`, type: 'bill' });
    addMoney(-total, 'Facturas semanales');
    S.bills.electricity = 0;
    if (S.money < 0) {
      S.bills.debt += 1;
      notify(`⚠️ ¡Estás en números rojos! (${S.bills.debt}/3 avisos)`, 'bad');
      if (S.bills.debt >= 3) bus.emit('gameover', 'Te desalojaron por no pagar la renta durante 3 semanas.');
    } else S.bills.debt = 0;
  }
  // Vencimiento de pedidos y patrocinios
  for (const j of S.jobs) {
    if (j.status === 'active' && S.day > j.deadlineDay) {
      j.status = 'failed';
      notify(`❌ El pedido de ${j.client} venció.`, 'bad');
      if (S.bench.job === j.id) { S.bench.job = null; }
    }
  }
  S.jobs = S.jobs.filter((j) => j.status === 'active' || (j.status !== 'active' && S.day - j.deadlineDay < 3));
  for (const sp of S.sponsors) {
    if (sp.status === 'active' && S.day > sp.deadlineDay) { sp.status = 'failed'; notify(`❌ Contrato con ${sp.brand} vencido.`, 'bad'); }
  }
  generateDailyEmails();
  bus.emit('day');
}

// ---------------- Correos ----------------
export function pushEmail(e) {
  const mail = { id: uid('mail'), day: S.day, read: false, status: 'new', type: 'info', ...e };
  S.emails.unshift(mail);
  if (S.emails.length > 60) S.emails.length = 60;
  bus.emit('email', mail);
  return mail;
}

export function generateDailyEmails() {
  const F = S.stats.followers;
  const n = randi(1, 2) + (F > 500 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    if (r < 0.55) pushEmail(makeJobEmail());
    else if (r < 0.85 && F >= 80) pushEmail(makeSponsorEmail());
    else if (F >= 400 && chance(0.6)) pushEmail(makeCollabEmail());
    else pushEmail(makeJobEmail());
  }
  if (chance(0.25)) pushEmail(fanMail());
}

function estCost(score) { return 300 + score * score * 0.2; }

export function makeJobEmail(forceType) {
  const client = pick(CLIENTS);
  const hw = skill('hardware');
  const type = forceType || (chance(0.45) ? 'repair' : 'build');
  if (type === 'build') {
    const maxScore = Math.min(95, 30 + hw * 6 + S.day * 1.5);
    const minScore = Math.round(rand(25, maxScore) / 5) * 5;
    const req = {};
    if (chance(0.3)) req.glass = true;
    if (chance(0.25)) req.nvme = true;
    if (minScore > 55 && chance(0.3)) req.ram32 = true;
    const pay = Math.round((estCost(minScore) * rand(1.2, 1.4) + 60 + hw * 15) / 10) * 10;
    const reqTxt = [req.glass && 'gabinete con vidrio', req.nvme && 'disco NVMe', req.ram32 && '32GB de RAM o más'].filter(Boolean);
    const job = { id: uid('job'), type, client, minScore, req, pay, days: randi(2, 4) };
    return {
      from: `${client} (cliente)`, subject: `Necesito una PC gamer (rendimiento ${minScore}+)`, type: 'job', data: job,
      body: `¡Hola! Vi que armas PCs. Quiero una PC con rendimiento mínimo de ${minScore}.${reqTxt.length ? '\nRequisitos extra: ' + reqTxt.join(', ') + '.' : ''}\n\nTe pago ${fmtMoney(pay)} al entregarla (las piezas corren por tu cuenta).\nPlazo: ${job.days} días.\n\nTip: compra las piezas en TecnoMarket o PC Zone, ármala en el banco de trabajo y entrégala desde ahí.`,
    };
  }
  // Reparación: generamos una PC con una pieza dañada
  const tier = clamp(Math.floor(rand(0, 3 + hw / 3)), 0, 4);
  const parts = randomBuild(tier);
  const brokenSlot = pick(['gpu', 'ram', 'psu', 'storage', 'cooler', 'mb', 'cpu']);
  const SYMPTOMS = {
    gpu: 'Enciende pero no da imagen, a veces aparecen rayas de colores.',
    ram: 'Hace pitidos al encender y no arranca.',
    psu: 'No enciende para nada, ni una luz.',
    storage: 'Dice "No se encontró sistema operativo".',
    cooler: 'Se apaga sola a los minutos de jugar, está muy caliente.',
    mb: 'No enciende y olía a quemado.',
    cpu: 'Los ventiladores giran al máximo pero no hay imagen.',
  };
  const pay = Math.round((70 + part(parts[brokenSlot]).price * 0.5 + hw * 10 + rand(0, 60)) / 5) * 5;
  const job = { id: uid('job'), type: 'repair', client, parts, broken: brokenSlot, symptom: SYMPTOMS[brokenSlot], pay, days: randi(2, 3), minScore: pcScore(parts) };
  return {
    from: `${client} (cliente)`, subject: `Reparación: ${SYMPTOMS[brokenSlot].split(',')[0]}`, type: 'job', data: job,
    body: `Hola, mi PC tiene un problema:\n"${SYMPTOMS[brokenSlot]}"\n\n¿Puedes repararla? Te pago ${fmtMoney(pay)} de mano de obra + reembolso de la pieza que cambies.\nPlazo: ${job.days} días.\n\nTip: pon la PC en el banco de trabajo, diagnostica las piezas sospechosas y reemplaza la dañada con una pieza nueva compatible.`,
  };
}

export function randomBuild(tier) {
  // tier 0..4
  const pickTier = (slot) => { const list = partsBySlot(slot); const i = clamp(Math.round((tier / 4) * (list.length - 1) + rand(-1, 1)), 0, list.length - 1); return list[i]; };
  const cpu = pickTier('cpu');
  const mbs = partsBySlot('mb').filter((m) => m.socket === cpu.socket);
  const mb = mbs[clamp(Math.round((tier / 4) * (mbs.length - 1)), 0, mbs.length - 1)];
  const rams = partsBySlot('ram').filter((r) => r.type === mb.ramType);
  const ram = rams[clamp(Math.round((tier / 4) * (rams.length - 1)), 0, rams.length - 1)];
  const gpu = pickTier('gpu');
  const coolers = partsBySlot('cooler').filter((c) => c.capacity >= cpu.tdp);
  const cooler = coolers[0];
  const p = { cpu: cpu.id, mb: mb.id, ram: ram.id, gpu: gpu.id, cooler: cooler.id, storage: pickTier('storage').id, case: pickTier('case').id };
  const need = powerDraw(p) * 1.25;
  p.psu = partsBySlot('psu').find((x) => x.watts >= need)?.id || 'psu_6';
  return p;
}

function makeSponsorEmail() {
  const brand = pick(BRANDS);
  const F = S.stats.followers;
  const hours = randi(2, 5);
  const g = chance(0.4) ? pick(GAMES.filter((x) => x.id !== 'chat')) : null;
  const pay = Math.round((60 + F * 0.12 + hours * 25 + (g ? 40 : 0)) / 10) * 10;
  const sp = { id: uid('sp'), brand, hours, game: g?.id || null, pay, days: randi(3, 6) };
  return {
    from: `${brand} · Marketing`, subject: `Propuesta de patrocinio: ${fmtMoney(pay)}`, type: 'sponsor', data: sp,
    body: `¡Hola ${S.player.name}! Nos encanta tu contenido.\n\nTe proponemos transmitir ${hours} horas${g ? ` jugando ${g.name}` : ''} mencionando a ${brand} durante el directo (usa el botón "Mencionar patrocinador").\n\nPago: ${fmtMoney(pay)} al completar.\nPlazo: ${sp.days} días.`,
  };
}

function makeCollabEmail() {
  const who = pick(STREAMERS);
  const boost = Math.round(20 + S.stats.followers * rand(0.03, 0.08));
  return {
    from: who, subject: '¿Hacemos un directo juntos? 🤝', type: 'collab', data: { who, boost },
    body: `¡Ey! Soy ${who}. Me gustaría hacer una colaboración contigo. Si aceptas, en tu próximo directo (en las próximas 24h) llegarán ~${fmtNum(boost)} espectadores de mi comunidad.`,
  };
}

function fanMail() {
  const msgs = ['¡Tus directos me alegran el día! Sigue así 💜', 'Gracias por el consejo del otro día, ya armé mi PC.', 'Eres mi streamer favorito, ¿harás maratón?', 'Te dibujé un fanart (imagina que está adjunto 😅)'];
  return { from: `Fan · ${pick(CLIENTS)}`, subject: 'Mensaje de un fan', body: pick(msgs), type: 'info' };
}

export function acceptEmail(mail) {
  if (mail.status !== 'new') return;
  if (mail.type === 'job') {
    const j = { ...mail.data, status: 'active', deadlineDay: S.day + mail.data.days };
    S.jobs.push(j);
    notify(`🔧 Pedido aceptado: ${j.client}`, 'good');
  } else if (mail.type === 'sponsor') {
    const sp = { ...mail.data, status: 'active', progress: 0, mentions: 0, deadlineDay: S.day + mail.data.days };
    S.sponsors.push(sp);
    notify(`🤝 Contrato con ${sp.brand} aceptado`, 'good');
  } else if (mail.type === 'collab') {
    S.collab = { ...mail.data, until: now() + 1440 };
    notify(`🤝 Colaboración con ${mail.data.who} lista para tu próximo directo`, 'good');
  }
  mail.status = 'accepted';
  bus.emit('jobs');
}
export function declineEmail(mail) { mail.status = 'declined'; }

// ---------------- Compras y entregas ----------------
export function buy(items, total, delivery = true, label = 'Compra') {
  if (S.money < total) { notify('No tienes suficiente dinero', 'bad'); sfx.error(); return false; }
  addMoney(-total, label);
  sfx.cash();
  if (delivery) {
    const at = now() + randi(40, 120);
    S.deliveries.push({ items, at });
    notify(`🛒 Pedido realizado. Llega en ~${Math.round((at - now()) / 60 * 10) / 10}h`, 'info');
  } else receiveItems(items);
  return true;
}

export function receiveItems(items) {
  for (const it of items) {
    if (it.kind === 'part') for (let i = 0; i < (it.qty || 1); i++) S.inventory.parts.push({ uid: uid('p'), id: it.id });
    else if (it.kind === 'food') S.inventory.food[it.id] = (S.inventory.food[it.id] || 0) + (it.qty || 1);
    else if (it.kind === 'game') { if (!S.inventory.games.includes(it.id)) S.inventory.games.push(it.id); }
    else if (it.kind === 'book') { if (!S.inventory.books.includes(it.id)) S.inventory.books.push(it.id); }
    else if (it.kind === 'deco') { if (!S.inventory.deco.includes(it.id)) S.inventory.deco.push(it.id); }
    else if (it.kind === 'peripheral') {
      const p = peripheral(it.id);
      const old = S.peripherals[p.slot];
      S.peripherals[p.slot] = it.id;
      if (old && old !== it.id) notify(`Reemplazaste ${peripheral(old)?.name}`, 'info');
    }
  }
  bus.emit('inventory');
}

export function openPackages() {
  const items = S.doorPackages.splice(0);
  receiveItems(items);
  const names = items.map((i) => itemName(i)).join(', ');
  notify(`📦 Recibiste: ${names}`, 'good');
  bus.emit('packages');
}

export function itemName(it) {
  if (it.kind === 'part') return PARTS[it.id]?.name;
  if (it.kind === 'food') return FOOD[it.id]?.name + (it.qty > 1 ? ` x${it.qty}` : '');
  if (it.kind === 'game') return GAME[it.id]?.name;
  if (it.kind === 'peripheral') return peripheral(it.id)?.name;
  return it.name || it.id;
}

// ---------------- Videos ----------------
export function updateVideos(hours) {
  let earned = 0, subsG = 0;
  for (const v of S.videos) {
    const ageH = (now() - v.uploadedAt) / 60;
    const decay = Math.exp(-ageH / (v.type === 'short' ? 30 : 90));
    const base = v.type === 'short' ? 60 : 25;
    const reach = base * (0.2 + v.quality ** 2 * 1.8) * (1 + S.stats.followers / 150) * (v.viral || 1) * (GAME[v.game] ? 0.6 + (S.trends[v.game] || 1) * 0.4 : 1);
    const nv = Math.max(0, reach * decay * hours * rand(0.7, 1.3));
    v.views += nv;
    const rpm = v.type === 'short' ? 0.4 : 3.5;
    const money = S.flags.affiliate ? (nv / 1000) * rpm * (S.flags.partner ? 1.4 : 1) : 0;
    v.earned += money; earned += money;
    const ns = nv * (v.type === 'short' ? 0.002 : 0.005) * (0.5 + v.quality);
    v.subsFrac = (v.subsFrac || 0) + ns;
    const whole = Math.floor(v.subsFrac); v.subsFrac -= whole; subsG += whole;
  }
  if (earned > 0.01) { S.stats.earnedVideos += earned; addMoney(earned, 'Ingresos de videos'); }
  if (subsG > 0) S.stats.followers += subsG;
}

// ---------------- Progreso ----------------
export function checkProgress() {
  refreshDerived();
  // Afiliado / Partner
  if (!S.flags.affiliate && S.stats.followers >= 50 && S.stats.streams >= 3) {
    S.flags.affiliate = true;
    bus.emit('bigmsg', '🎉 ¡Ahora eres AFILIADO!', 'Desbloqueaste suscripciones, anuncios y monetización de videos.');
    sfx.levelup();
  }
  if (S.flags.affiliate && !S.flags.partner && S.stats.followers >= 1000 && S.stats.avgViewers >= 25) {
    S.flags.partner = true;
    bus.emit('bigmsg', '💎 ¡Ahora eres PARTNER!', 'Mejor reparto de ingresos, más ofertas y moderadores automáticos.');
    sfx.levelup();
  }
  for (const [k, th] of [['1k', 1000], ['10k', 10000], ['100k', 100000]]) {
    if (S.stats.followers >= th && !S.flags.plaques.includes(k)) {
      S.flags.plaques.push(k);
      bus.emit('bigmsg', `🏆 ¡Placa de ${k} seguidores!`, 'Te enviaron una placa conmemorativa. Ya está colgada en tu pared.');
      bus.emit('deco');
    }
  }
  // Misiones
  const q = QUESTS[S.quests.index];
  if (q && q.check(S)) {
    S.quests.index++;
    addMoney(q.reward, `Misión: ${q.title}`);
    notify(`✅ Misión completada: ${q.title} (+${fmtMoney(q.reward)})`, 'good');
    sfx.levelup();
    bus.emit('quest');
  }
  for (const a of ACHIEVEMENTS) {
    if (!S.achievements[a.id] && a.check(S)) {
      S.achievements[a.id] = S.day + 1;
      notify(`${a.icon} Logro desbloqueado: ${a.name}`, 'gold');
      sfx.sub();
    }
  }
}

// ---------------- Acciones de necesidades ----------------
export function eat(foodId) {
  const f = FOOD[foodId];
  if (!f || !(S.inventory.food[foodId] > 0)) return false;
  S.inventory.food[foodId]--;
  if (!S.inventory.food[foodId]) delete S.inventory.food[foodId];
  applyFood(f);
  return f;
}
export function applyFood(f) {
  const N = S.needs;
  N.hunger = clamp(N.hunger + (f.hunger || 0), 0, 100);
  N.energy = clamp(N.energy + (f.energy || 0), 0, 100);
  N.fun = clamp(N.fun + (f.fun || 0), 0, 100);
  S.stats._ate = true;
  sfx.eat();
}
