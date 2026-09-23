// Motor de simulación de un directo: espectadores, chat, eventos, ingresos y VOD.
import { S, bus, now, addMoney, notify, uid, pick, randi, rand, chance, clamp, skill, addXP, hour } from '../core/state.js';
import { GAME, discoverability } from '../data/games.js';
import { pcScore, encodeScore, cpuTemp, part } from '../data/parts.js';
import { INTERNET, RESOLUTIONS, peripheral, DECO_BY_ID } from '../data/items.js';
import { viewerName, nameColor, genericMessage, trollMessage, donationMessage, QUESTIONS } from '../data/chat.js';
import { sim, mood } from './sim.js';
import { sfx } from '../core/audio.js';

export function setupScore() {
  let s = 0;
  for (const d of S.inventory.deco) s += DECO_BY_ID[d]?.setup || 0;
  const P = S.peripherals;
  if (P.light) s += peripheral(P.light).q * 8;
  if (P.greenscreen) s += 5;
  if (P.deck) s += 3;
  return Math.min(60, s);
}

// Diagnóstico técnico del directo antes de empezar
export function techCheck(gameId, res) {
  const g = GAME[gameId];
  const R = RESOLUTIONS[res];
  const score = pcScore(S.pc.parts);
  const enc = encodeScore(S.pc.parts);
  const net = INTERNET.find((n) => n.id === S.internet);
  const temp = cpuTemp(S.pc.parts, S.pc.paste, S.pc.dust, 0.55 + g.req / 200);
  const issues = [];
  if (score < g.req) issues.push({ lvl: 'bad', t: `Tu PC (${score}) está por debajo del mínimo del juego (${g.req}): habrá LAG` });
  else if (score < g.req + 10) issues.push({ lvl: 'warn', t: `Tu PC apenas cumple con el juego: calidad baja` });
  if (enc < R.encode) issues.push({ lvl: 'bad', t: `Tu PC no puede codificar ${res} (codif. ${enc}/${R.encode}): se perderán frames` });
  if (net.upload < R.upload) issues.push({ lvl: 'bad', t: `Tu internet sube ${net.upload} Mbps y ${res} necesita ${R.upload} Mbps` });
  if (temp >= 90) issues.push({ lvl: 'bad', t: `CPU a ${temp}°C bajo carga: riesgo de apagado. Limpia la PC o mejora el disipador` });
  else if (temp >= 80) issues.push({ lvl: 'warn', t: `CPU a ${temp}°C: algo caliente` });
  if (!S.peripherals.webcam) issues.push({ lvl: 'warn', t: 'Sin webcam: la gente prefiere ver tu cara' });
  if ((peripheral(S.peripherals.mic)?.q || 0) < 0.4) issues.push({ lvl: 'warn', t: 'Micrófono de baja calidad' });
  if (S.needs.energy < 25) issues.push({ lvl: 'warn', t: 'Estás muy cansado' });
  if (S.needs.hygiene < 25) issues.push({ lvl: 'warn', t: 'Deberías ducharte (se nota en cámara 😅)' });
  const lag = score < g.req || enc < R.encode || net.upload < R.upload;
  return { issues, lag, score, enc, temp, upload: net.upload };
}

export class StreamSession {
  constructor({ game, title, res }) {
    this.game = GAME[game];
    this.title = title;
    this.res = res;
    this.minutes = 0;
    this.hype = 30;
    this.viewers = 0;
    this.peak = 0;
    this.followers = 0; this.fAcc = 0;
    this.subs = 0; this.sAcc = 0;
    this.donations = 0;
    this.adMoney = 0;
    this.viewerMinutes = 0;
    this.bonusPool = 0;
    this.chat = [];
    this.events = [];
    this.segments = [];
    this.segAcc = { hype: 0, n: 0, moments: [] };
    this.cooldowns = { talk: 0, ad: 0, mention: 0 };
    this.ended = false;
    this.lagTimer = 0;
    this.tech = techCheck(game, res);
    this.sponsor = S.sponsors.find((s) => s.status === 'active' && (!s.game || s.game === game)) || null;
    this.chatAcc = 0;
    this.nextAction = 12;
    this.log = [];
    this.startMinute = now();
    // Colaboración / anuncio previo
    if (S.collab && S.collab.until > now()) {
      this.bonusPool += S.collab.boost;
      this.alert('collab', `🤝 ¡Colaboración con ${S.collab.who}!`, `+${S.collab.boost} espectadores`);
      S.collab = null;
    }
    this.announced = S.social.announceUntil > now();
    sim.streaming = true;
  }

  alert(kind, title, sub = '') { this.events.push({ id: uid('ev'), kind, title, sub, t: 0 }); bus.emit('stream:alert', { kind, title, sub }); }

  factors() {
    const g = this.game;
    const P = S.peripherals;
    const trend = S.trends[g.id] || 1;
    const disc = discoverability(g, trend, S.stats.followers);
    const score = this.tech.score;
    const qPC = clamp((score - g.req) / 40 + 0.85, 0.35, 1.2);
    const cam = peripheral(P.webcam)?.q || 0;
    const mic = peripheral(P.mic)?.q || 0;
    const light = peripheral(P.light)?.q || 0;
    const setup = setupScore();
    const m = mood();
    const h = hour();
    const timeMult = h < 2 ? 0.85 : h < 7 ? 0.45 : h < 12 ? 0.7 : h < 17 ? 0.9 : 1.25;
    const titleOK = this.title && this.title.length >= 8;
    const lag = this.tech.lag || this.lagTimer > 0;
    const f = {
      disc, qPC,
      res: lag ? 0.55 : RESOLUTIONS[this.res].mult,
      cam: 0.82 + cam * 0.25 + (cam ? light * 0.06 : 0),
      mic: 0.8 + mic * 0.3,
      setup: 1 + (cam ? setup : setup * 0.4) / 180,
      mood: 0.55 + (m / 100) * 0.55,
      time: timeMult,
      announce: this.announced ? 1.3 : 1,
      title: titleOK ? 1.05 : 0.92,
      hype: 0.55 + (this.hype / 100) * 1.1,
      charisma: 1 + skill('charisma') * 0.035,
      hygiene: S.needs.hygiene < 20 && cam ? 0.85 : 1,
    };
    return f;
  }

  targetViewers() {
    const F = S.stats.followers;
    const f = this.factors();
    const loyal = F * 0.026 + S.stats.subs * 0.25;
    const browse = (4 + F * 0.012) * f.disc * 2.2;
    let t = (loyal + browse) * f.qPC * f.res * f.cam * f.mic * f.setup * f.mood * f.time * f.announce * f.title * f.hype * f.charisma * f.hygiene;
    return Math.max(0.5, t + this.bonusPool);
  }

  // Se llama cada minuto de juego
  minuteTick() {
    if (this.ended) return;
    this.minutes++;
    S.stats.minutesStreamed++;
    for (const k in this.cooldowns) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - 1);
    if (this.lagTimer > 0) this.lagTimer--;
    this.bonusPool *= 0.97;
    const target = this.targetViewers();
    this.viewers += (target - this.viewers) * 0.09 + rand(-0.4, 0.4) * Math.sqrt(Math.max(1, this.viewers)) * 0.3;
    this.viewers = Math.max(0, this.viewers);
    const v = Math.round(this.viewers);
    this.viewerMinutes += v;
    if (v > this.peak) this.peak = v;
    if (v > S.stats.peakViewers) S.stats.peakViewers = v;

    // Hype
    this.hype += (25 - this.hype) * 0.02 - 0.15;
    this.hype = clamp(this.hype, 0, 100);

    // Seguidores
    const followRate = v * 0.013 * (0.5 + this.hype / 100) * (S.stats.followers < 100 ? 1.6 : 1) * (1 + skill('charisma') * 0.04);
    this.fAcc += followRate;
    while (this.fAcc >= 1) { this.fAcc -= 1; this.newFollower(); }
    if (S.flags.affiliate) {
      this.sAcc += v * 0.0011 * (0.5 + this.hype / 100);
      while (this.sAcc >= 1) { this.sAcc -= 1; this.newSub(); }
    }
    // Donaciones
    if (v >= 1 && chance(Math.min(0.3, 0.002 + v * 0.0025) * (0.5 + this.hype / 100))) this.newDonation();
    // Trolls
    if (v >= 2 && chance(0.025 + v * 0.0006)) this.newTroll();
    // Preguntas del chat
    if (v >= 1 && !this.events.some((e) => e.kind === 'question' && !e.done) && chance(0.05 + (S.peripherals.monitor2 ? 0.02 : 0) + (this.game.mini === 'chat' ? 0.05 : 0))) this.newQuestion();
    // Raids
    if (v >= 4 && chance(0.0035 * (0.5 + this.hype / 60))) this.newRaid();

    // Temperatura y fallos
    const temp = cpuTemp(S.pc.parts, S.pc.paste, S.pc.dust, 0.55 + this.game.req / 200);
    this.temp = temp;
    if (temp >= 92 && chance(0.03)) { this.lagTimer = 5; this.sys('⚠️ Tu CPU se está estrangulando por temperatura (lag)'); }
    if (temp >= 98 && chance(0.012)) { this.crash('¡Tu PC se apagó por sobrecalentamiento! 🔥'); return; }
    if (this.tech.lag && chance(0.02)) this.sys('Chat: "LAAAG" 😵');

    // Necesidades durante el directo
    S.needs.fun = clamp(S.needs.fun + (this.hype > 50 ? 0.06 : this.hype < 15 ? -0.04 : 0.02), 0, 100);

    // Patrocinio
    if (this.sponsor && this.sponsor.status === 'active') {
      this.sponsor.progress += 1;
      this.checkSponsor();
    }

    // Segmentos del VOD (cada 10 min)
    this.segAcc.hype += this.hype; this.segAcc.n++;
    if (this.minutes % 10 === 0) this.closeSegment();

    addXP('charisma', 0.08 + v * 0.002);
    bus.emit('stream:tick', this);
  }

  closeSegment() {
    const a = this.segAcc;
    if (!a.n) return;
    const bonus = a.moments.reduce((s, m) => s + ({ epic: 25, fail: 18, raid: 20, donation: 8, scare: 22, sub: 5, chat: 6 }[m] || 0), 0);
    this.segments.push({ interest: clamp(a.hype / a.n * 0.8 + bonus + rand(-6, 6), 0, 100), moments: [...new Set(a.moments)], min: this.minutes });
    this.segAcc = { hype: 0, n: 0, moments: [] };
  }
  moment(kind) { this.segAcc.moments.push(kind); }

  // ---- Chat en tiempo real ----
  update(dt) {
    if (this.ended) return;
    const v = this.viewers;
    this.chatAcc += dt * Math.min(7, 0.15 + v * 0.06);
    while (this.chatAcc >= 1) {
      this.chatAcc -= 1;
      const ctx = { mini: this.game.mini, hype: this.hype, lag: this.tech.lag || this.lagTimer > 0, micQ: peripheral(S.peripherals.mic)?.q || 0, cam: !!S.peripherals.webcam, energy: S.needs.energy };
      this.pushChat({ user: viewerName(), color: nameColor(), text: genericMessage(ctx) });
    }
    for (const e of this.events) {
      e.t += dt;
      if (!e.done && e.timeout && e.t > e.timeout) this.expire(e);
    }
    this.events = this.events.filter((e) => !(e.done && e.t > (e.linger || 0)) && e.t < 30);
  }

  pushChat(m) {
    m.id = uid('c');
    this.chat.push(m);
    if (this.chat.length > 60) this.chat.shift();
    bus.emit('stream:chat', m);
  }
  sys(text) { this.pushChat({ user: '⚙️ Sistema', color: '#aaa', text, sys: true }); }

  newFollower() {
    this.followers++; S.stats.followers++;
    const n = viewerName();
    this.pushChat({ user: n, color: nameColor(), text: '¡Nuevo seguidor! 💜', special: 'follow' });
    this.alert('follow', `${n}`, 'te sigue ahora');
    sfx.follow();
    this.hype = clamp(this.hype + 1.5, 0, 100);
  }
  newSub() {
    this.subs++; S.stats.subs++;
    const n = viewerName();
    const money = S.flags.partner ? 3.5 : 2.5;
    addMoney(money, 'Suscripción'); S.stats.earnedStream += money;
    this.pushChat({ user: n, color: nameColor(), text: `se suscribió ⭐ ${randi(1, 12)} meses`, special: 'sub' });
    this.alert('sub', `${n} se suscribió`, '⭐ ¡Gracias!');
    sfx.sub();
    this.hype = clamp(this.hype + 4, 0, 100);
    this.moment('sub');
  }
  newDonation() {
    const big = chance(0.08);
    const amt = big ? randi(20, 100) : randi(1, 6 + Math.floor(this.viewers / 8));
    const n = viewerName();
    const msg = donationMessage();
    this.donations += amt; S.stats.donations += amt; S.stats.earnedStream += amt;
    addMoney(amt, `Donación de ${n}`);
    this.pushChat({ user: n, color: '#ffd700', text: `donó $${amt}: ${msg}`, special: 'donation' });
    this.events.push({ id: uid('ev'), kind: 'donation', user: n, amount: amt, msg, t: 0, timeout: S.peripherals.monitor2 ? 18 : 12 });
    this.alert('donation', `${n} donó $${amt}`, msg);
    sfx.donation();
    this.hype = clamp(this.hype + 3 + amt / 10, 0, 100);
    this.moment('donation');
  }
  newTroll() {
    const n = viewerName();
    if (S.flags.partner && chance(0.7)) { this.sys(`🤖 AutoMod bloqueó un mensaje de ${n}`); return; }
    const m = { user: n, color: '#ff5555', text: trollMessage(), troll: true, t0: performance.now() };
    this.pushChat(m);
    this.events.push({ id: uid('ev'), kind: 'troll', user: n, msgId: m.id, t: 0, timeout: S.peripherals.monitor2 ? 16 : 11 });
  }
  newQuestion() {
    const q = pick(QUESTIONS);
    const n = viewerName();
    this.pushChat({ user: n, color: nameColor(), text: q.q, special: 'question' });
    this.events.push({ id: uid('ev'), kind: 'question', user: n, q, t: 0, timeout: S.peripherals.monitor2 ? 22 : 15 });
  }
  newRaid() {
    const size = randi(8, 25 + Math.floor(S.stats.followers * 0.05));
    const who = '@' + viewerName();
    this.bonusPool += size;
    this.viewers += size * 0.6;
    S.stats.raidsReceived++;
    this.alert('raid', `⚔️ ¡RAID de ${who}!`, `${size} espectadores llegan`);
    this.pushChat({ user: who, color: '#ff4500', text: `¡RAID con ${size} personas! 🔥🔥`, special: 'raid' });
    sfx.raid();
    this.hype = clamp(this.hype + 15, 0, 100);
    this.moment('raid');
  }

  expire(e) {
    e.done = true;
    if (e.kind === 'troll') { this.hype = clamp(this.hype - 8, 0, 100); S.needs.fun = clamp(S.needs.fun - 4, 0, 100); this.sys(`El troll ${e.user} arruinó el ambiente del chat 😒`); }
    if (e.kind === 'question') { this.hype = clamp(this.hype - 3, 0, 100); }
    if (e.kind === 'donation') { this.hype = clamp(this.hype - 2, 0, 100); }
    bus.emit('stream:events', this);
  }

  // ---- Acciones del jugador ----
  ban(e) {
    if (e.done) return;
    e.done = true;
    S.stats.bans++;
    const m = this.chat.find((c) => c.id === e.msgId); if (m) { m.text = '<mensaje eliminado>'; m.banned = true; }
    this.sys(`🔨 ${e.user} fue baneado`);
    this.hype = clamp(this.hype + 2, 0, 100);
    sfx.hit();
    bus.emit('stream:events', this);
  }
  thank(e) {
    if (e.done) return;
    e.done = true;
    const ch = skill('charisma');
    this.hype = clamp(this.hype + 4 + ch, 0, 100);
    addXP('charisma', 6);
    this.pushChat({ user: S.player.name, color: '#9146ff', text: `¡Muchas gracias ${e.user} por los $${e.amount}! 💜`, me: true });
    bus.emit('stream:events', this);
  }
  answer(e, a) {
    if (e.done) return;
    e.done = true;
    let h = a.h;
    if (a.skill) h += skill(a.skill);
    if (a.setup) h += Math.round(setupScore() / 8);
    if (a.risk) { if (chance(0.5 + skill('gaming') * 0.04)) { h += 8; this.moment('epic'); this.pushChat({ user: 'chat', color: '#0f0', text: '¡¡LO LOGRÓ SIN MIRAR!! 😱' }); } else { h = -2; this.moment('fail'); this.pushChat({ user: 'chat', color: '#f55', text: 'JAJAJA fail épico 💀' }); } }
    this.hype = clamp(this.hype + h + skill('charisma') * 0.5, 0, 100);
    if (h > 0) { addXP('charisma', 5); this.moment('chat'); }
    this.pushChat({ user: S.player.name, color: '#9146ff', text: a.t.replace(/"/g, ''), me: true });
    bus.emit('stream:events', this);
  }
  talk() {
    if (this.cooldowns.talk > 0) return false;
    this.cooldowns.talk = 8;
    const ch = skill('charisma');
    const gain = 3 + ch * 0.8 + rand(0, 3);
    this.hype = clamp(this.hype + gain, 0, 100);
    S.needs.energy = clamp(S.needs.energy - 0.5, 0, 100);
    addXP('charisma', 4);
    const lines = ['¡Hola a todos los que van llegando!', 'Recuerden seguir el canal 💜', '¿De dónde me ven hoy?', 'Chat, ¿qué hacemos ahora?', 'Esta partida va para ustedes', 'Cuéntenme cómo les fue el día'];
    this.pushChat({ user: S.player.name, color: '#9146ff', text: pick(lines), me: true });
    return true;
  }
  runAd() {
    if (!S.flags.affiliate || this.cooldowns.ad > 0) return false;
    this.cooldowns.ad = 20;
    const money = Math.round(this.viewers * 0.035 * (S.flags.partner ? 1.4 : 1) * 100) / 100 + 0.2;
    this.adMoney += money; S.stats.earnedStream += money;
    addMoney(money, 'Anuncios en directo');
    this.viewers *= 0.9; this.hype = clamp(this.hype - 7, 0, 100);
    this.sys(`📺 Anuncio de 30s: +$${money.toFixed(2)}`);
    sfx.cash();
    return true;
  }
  mention() {
    if (!this.sponsor || this.cooldowns.mention > 0) return false;
    this.cooldowns.mention = 25;
    this.sponsor.mentions = (this.sponsor.mentions || 0) + 1;
    this.hype = clamp(this.hype - 2, 0, 100);
    this.pushChat({ user: S.player.name, color: '#9146ff', text: `Este directo es gracias a ${this.sponsor.brand}. ¡Link en la descripción! 😎`, me: true });
    this.checkSponsor();
    return true;
  }
  checkSponsor() {
    const sp = this.sponsor;
    if (sp.status === 'active' && sp.progress >= sp.hours * 60 && (sp.mentions || 0) >= sp.hours) {
      sp.status = 'done';
      addMoney(sp.pay, `Patrocinio ${sp.brand}`);
      S.stats._sponsorsDone = (S.stats._sponsorsDone || 0) + 1;
      notify(`🤝 ¡Contrato con ${sp.brand} completado! +$${sp.pay}`, 'gold');
      sfx.money();
    }
  }

  // Resultado de un minijuego de acción (ratio 0..1)
  actionResult(ratio, special) {
    const gm = skill('gaming');
    const delta = (ratio - 0.45) * 30 + gm * 0.5;
    this.hype = clamp(this.hype + delta, 0, 100);
    addXP('gaming', 4 + ratio * 8);
    if (ratio >= 0.95) { this.moment('epic'); this.pushChat({ user: 'chat', color: '#0f0', text: '¡¡¡JUGADÓN!!! CLIP IT 🔥🔥' }); this.alert('epic', '🔥 ¡JUGADA ÉPICA!', 'El chat enloquece'); this.bonusPool += 2 + this.viewers * 0.1; }
    else if (ratio <= 0.1) { this.moment('fail'); this.pushChat({ user: 'chat', color: '#f55', text: 'JAJAJAJA qué fail 💀💀' }); this.hype = clamp(this.hype + 4, 0, 100); }
    if (special === 'scare') this.moment('scare');
  }

  crash(reason) {
    this.crashed = reason;
    this.end();
  }

  end() {
    if (this.ended) return;
    this.ended = true;
    sim.streaming = false;
    this.closeSegment();
    const avg = this.minutes ? this.viewerMinutes / this.minutes : 0;
    S.stats._longest = Math.max(S.stats._longest || 0, this.minutes);
    S.stats.totalViewers += Math.round(avg);
    const hist = (S.stats._avgHist ||= []);
    hist.push(avg); if (hist.length > 5) hist.shift();
    S.stats.avgViewers = Math.round(hist.reduce((a, b) => a + b, 0) / hist.length * 10) / 10;
    addXP('gaming', this.minutes * 0.1);
    if (this.minutes >= 20) {
      S.vods.unshift({ id: uid('vod'), day: S.day, game: this.game.id, title: this.title, minutes: this.minutes, segments: this.segments, used: false, peak: this.peak });
      if (S.vods.length > 8) S.vods.length = 8;
    }
    if (this.minutes >= 30) S.stats.streams += 1;
    S.social.announceUntil = 0;
    this.summary = {
      minutes: this.minutes, avg: Math.round(avg), peak: this.peak, followers: this.followers, subs: this.subs,
      donations: this.donations, ads: this.adMoney, crashed: this.crashed, game: this.game.name,
    };
    bus.emit('stream:end', this.summary);
  }
}
