// Interfaz del directo en vivo: vista del juego con minijuegos, facecam, chat, eventos y controles.
import { S, bus, fmtMoney, fmtNum, clamp, rand, randi, pick, skill, chance } from '../core/state.js';
import { h, $, clear, bar, btn } from './dom.js';
import { modal } from './hud.js';
import { FOOD, peripheral } from '../data/items.js';
import { eat } from '../game/sim.js';
import { sfx } from '../core/audio.js';

let root = null, S2 = null, game = null, faceCanvas = null, onEnd = null;
const R = {};
let speed = 1;
let action = null; // minijuego activo
let actionTimer = 10;
let raf = 0;
let unsubs = [];
let keyHandler = null;
let player = null;

export const streamUI = {
  get speed() { return speed; },
  get open() { return !!root; },
};

export function openStreamUI(session, { faceCam, character, onFinish }) {
  S2 = session; faceCanvas = faceCam; onEnd = onFinish; player = character;
  speed = 1; action = null; actionTimer = 8;
  root = h('div#streamui', {},
    h('div.st-top', {},
      h('div.live-badge', {}, '● EN VIVO'),
      R.time = h('div.st-chip'),
      R.viewers = h('div.st-chip.v'),
      R.fol = h('div.st-chip'),
      R.subs = h('div.st-chip'),
      R.money = h('div.st-chip.m'),
      R.hype = h('div.hype-wrap', {}, h('span', {}, '🔥 Hype'), h('div.hype-bar', {}, R.hypeFill = h('div.hype-fill'))),
      h('div.st-speed', {}, [1, 2, 4].map((s) => h('button.chip', { class: s === 1 ? 'sel' : '', onclick: (e) => { speed = s; e.target.parentNode.querySelectorAll('.chip').forEach((c) => c.classList.remove('sel')); e.target.classList.add('sel'); } }, `x${s}`))),
    ),
    h('div.st-main', {},
      h('div.st-left', {},
        h('div.st-view', {},
          R.canvas = h('canvas', { width: 960, height: 540 }),
          R.face = h('div.facecam', {}, S.peripherals.webcam ? faceCam : h('div.nocam', {}, '📷', h('small', {}, 'Sin cámara'))),
          R.alerts = h('div.st-alerts'),
          R.title = h('div.st-title', {}, `${session.title} · ${session.game.name} · ${session.res}`),
        ),
        R.actionBox = h('div.st-actionbox'),
        R.events = h('div.st-events'),
      ),
      h('div.st-right', {},
        h('div.chat-head', {}, '💬 Chat del directo'),
        R.chat = h('div.chat'),
        h('div.chat-tip', {}, 'Haz clic en los mensajes rojos (trolls) para banearlos'),
      ),
    ),
    h('div.st-bottom', {},
      R.needs = h('div.st-needs'),
      h('div.st-actions', {},
        R.talkBtn = btn('🗣️ Hablar al chat', () => { if (S2.talk()) { player?.doEmote('wave', 1.5); renderButtons(); } }),
        R.adBtn = btn('📺 Poner anuncio', () => { S2.runAd(); renderButtons(); }),
        R.spBtn = btn('🤝 Mencionar patrocinador', () => { S2.mention(); renderButtons(); }),
        R.snackBtn = btn('🥤 Tomar algo', () => snackMenu()),
        R.actBtn = btn('🎮 ¡Jugada!', () => { if (!action) startAction(); }, 'good'),
        btn('⏹ Terminar directo', () => confirmEnd(), 'danger'),
      ),
    ),
  );
  $('#ui').appendChild(root);
  R.ctx = R.canvas.getContext('2d');
  R.canvas.addEventListener('mousedown', onCanvasClick);
  keyHandler = (e) => onKey(e);
  window.addEventListener('keydown', keyHandler);
  unsubs = [
    bus.on('stream:chat', addChat),
    bus.on('stream:alert', showAlert),
    bus.on('stream:events', renderEvents),
  ];
  renderButtons();
  const loop = (t) => { draw(t / 1000); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
}

export function closeStreamUI() {
  if (!root) return;
  cancelAnimationFrame(raf);
  window.removeEventListener('keydown', keyHandler);
  unsubs.forEach((u) => u());
  root.remove(); root = null; action = null;
}

// Llamado cada frame desde main
export function streamFrame(dt) {
  if (!root || !S2) return;
  S2.update(dt);
  if (!action) {
    actionTimer -= dt;
    if (actionTimer <= 0) startAction();
  } else updateAction(dt);
  if (Math.random() < 0.1) renderEvents();
}

// Llamado cada minuto de juego
export function streamMinute() {
  if (!root) return;
  const s = S2;
  R.time.textContent = `⏱️ ${Math.floor(s.minutes / 60)}:${String(s.minutes % 60).padStart(2, '0')}`;
  R.viewers.textContent = `👀 ${fmtNum(Math.round(s.viewers))}`;
  R.fol.textContent = `💜 +${s.followers}`;
  R.subs.textContent = S.flags.affiliate ? `⭐ +${s.subs}` : '⭐ —';
  R.money.textContent = `💵 +${fmtMoney(s.donations + s.adMoney + s.subs * 2.5)}`;
  R.hypeFill.style.width = `${s.hype}%`;
  R.hypeFill.style.background = s.hype > 70 ? 'linear-gradient(90deg,#ff512f,#f09819)' : s.hype > 35 ? 'linear-gradient(90deg,#9146ff,#e84393)' : '#636e72';
  const N = S.needs;
  const col = (v) => (v > 60 ? '#2ecc71' : v > 30 ? '#f1c40f' : '#e74c3c');
  clear(R.needs).append(
    mini('🍔', N.hunger, col(N.hunger)), mini('⚡', N.energy, col(N.energy)), mini('🚿', N.hygiene, col(N.hygiene)), mini('🎮', N.fun, col(N.fun)),
    h('div.temp', { style: { color: (s.temp || 60) > 88 ? '#e74c3c' : '#aaa' } }, `🌡️ CPU ${s.temp || '--'}°C`),
    ...(s.tech.lag ? [h('div.lag', {}, '⚠️ LAG')] : []),
  );
  renderButtons();
}
function mini(i, v, c) { return h('div.mneed', {}, i, bar(v, c)); }

function renderButtons() {
  if (!root) return;
  const c = S2.cooldowns;
  R.talkBtn.disabled = c.talk > 0; R.talkBtn.textContent = c.talk > 0 ? `🗣️ Hablar (${c.talk})` : '🗣️ Hablar al chat';
  R.adBtn.style.display = S.flags.affiliate ? '' : 'none';
  R.adBtn.disabled = c.ad > 0; R.adBtn.textContent = c.ad > 0 ? `📺 Anuncio (${c.ad})` : '📺 Poner anuncio';
  R.spBtn.style.display = S2.sponsor && S2.sponsor.status === 'active' ? '' : 'none';
  if (S2.sponsor) { R.spBtn.disabled = c.mention > 0; R.spBtn.textContent = `🤝 Mencionar ${S2.sponsor.brand} (${S2.sponsor.mentions || 0}/${S2.sponsor.hours})${c.mention ? ' · ' + c.mention : ''}`; }
  R.actBtn.disabled = !!action;
}

function addChat(m) {
  if (!root) return;
  const line = h('div.cmsg', { class: `${m.troll ? 'troll' : ''} ${m.special || ''} ${m.me ? 'me' : ''} ${m.sys ? 'sys' : ''}`, onclick: () => { if (m.troll && !m.banned) { const e = S2.events.find((x) => x.msgId === m.id); if (e) S2.ban(e); line.classList.add('banned'); line.querySelector('.ct').textContent = '<mensaje eliminado>'; } } },
    h('b', { style: { color: m.color } }, m.user + ': '), h('span.ct', {}, m.text));
  R.chat.appendChild(line);
  while (R.chat.children.length > 70) R.chat.firstChild.remove();
  R.chat.scrollTop = R.chat.scrollHeight;
}

function showAlert({ kind, title, sub }) {
  if (!root) return;
  const a = h('div.alert', { class: kind }, h('div.al-t', {}, title), h('div.al-s', {}, sub));
  R.alerts.appendChild(a);
  setTimeout(() => a.classList.add('out'), 3000);
  setTimeout(() => a.remove(), 3600);
  if (kind === 'donation' || kind === 'raid' || kind === 'sub') player?.doEmote('cheer', 1.5);
}

function renderEvents() {
  if (!root) return;
  const evs = S2.events.filter((e) => !e.done && ['donation', 'question', 'troll'].includes(e.kind));
  const key = evs.map((e) => e.id).join(',');
  if (R.events._key === key) { // solo actualizar tiempos
    R.events.querySelectorAll('[data-eid]').forEach((n) => { const e = S2.events.find((x) => x.id === n.dataset.eid); if (e && e.timeout) n.querySelector('.ev-time').style.width = `${Math.max(0, 100 - (e.t / e.timeout) * 100)}%`; });
    return;
  }
  R.events._key = key;
  clear(R.events);
  if (!evs.length) { R.events.append(h('div.ev-empty', {}, 'Sin eventos pendientes · interactúa con el chat para subir el hype')); return; }
  for (const e of evs.slice(0, 3)) {
    let content;
    if (e.kind === 'donation') content = [h('div', {}, `💸 ${e.user} donó $${e.amount}: "${e.msg}"`), btn('💜 Agradecer', () => { S2.thank(e); renderEvents(); }, 'good')];
    else if (e.kind === 'troll') content = [h('div', {}, `😈 Troll en el chat: ${e.user}`), btn('🔨 Banear', () => { S2.ban(e); R.chat.querySelectorAll('.troll').forEach(() => {}); renderEvents(); }, 'danger')];
    else content = [h('div', {}, `❓ ${e.user}: ${e.q.q}`), h('div.row', {}, e.q.a.map((a) => btn(a.t, () => { S2.answer(e, a); renderEvents(); })))];
    R.events.append(h('div.ev', { class: e.kind, dataset: { eid: e.id } }, ...content, h('div.ev-timer', {}, h('div.ev-time'))));
  }
}

function snackMenu() {
  const items = Object.keys(S.inventory.food).filter((id) => FOOD[id]?.snack || (FOOD[id] && !FOOD[id].cook && FOOD[id].time <= 5));
  modal({
    title: '🥤 Tomar algo sin dejar el directo',
    content: (b, close) => {
      if (!items.length) b.append(h('p.muted', {}, 'No tienes snacks, bebidas ni sándwiches en tu inventario.'));
      items.forEach((id) => b.append(h('button.choice', { onclick: () => { eat(id); close(); S2.pushChat({ user: 'chat', color: '#aaa', text: 'provecho 😋' }); } }, h('span.choice-icon', {}, FOOD[id].icon), h('span.choice-text', {}, h('b', {}, `${FOOD[id].name} x${S.inventory.food[id]}`), h('small', {}, `Hambre +${FOOD[id].hunger} · Energía +${FOOD[id].energy || 0}`)))));
    },
  });
}

function confirmEnd() {
  modal({ title: '¿Terminar el directo?', content: h('p', {}, S2.minutes < 30 ? '⚠️ Los directos de menos de 30 minutos no cuentan para el programa de afiliados.' : 'Se guardará un VOD que podrás editar en VidCut.'), actions: [{ text: 'Seguir en vivo' }, { text: 'Terminar', cls: 'danger', fn: () => S2.end() }] });
}

// ==================== MINIJUEGOS ====================
function startAction() {
  const type = S2.game.mini;
  const kb = !!S.peripherals.keyboard, ms = !!S.peripherals.mouse;
  const gm = skill('gaming');
  action = { type, t: 0, prep: 1.4, done: false, hits: 0, total: 0, targets: [], rounds: [], seq: [], idx: 0 };
  sfx.notify();
  if (type === 'aim') { action.duration = 7; action.spawnT = 0; action.size = 26 + (ms ? 12 : 0) + gm * 1.5; }
  else if (type === 'timing') { action.total = 4; action.zone = 0.12 + gm * 0.01 + (kb ? 0.03 : 0); action.pos = 0; action.dir = 1; action.speed = 1.4 + Math.random() * 0.6; action.zoneAt = rand(0.2, 0.8); action.duration = 12; }
  else if (type === 'qte') {
    action.total = 5; action.seq = Array.from({ length: 5 }, () => pick(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']));
    action.per = 1.25 + gm * 0.06 + (kb ? 0.25 : 0); action.keyT = 0; action.duration = 99;
    if (S2.game.horror && chance(0.6)) { action.scare = true; }
  } else { // chat
    action.duration = 10;
    const topics = [['Contar una anécdota graciosa', 0.9], ['Reaccionar a videos del chat', 0.8], ['Hablar del clima', 0.2], ['Leer mensajes y responder', 0.75], ['Hacer una encuesta polémica', 0.85], ['Hablar de impuestos', 0.1], ['Mostrar tu mascota imaginaria', 0.6]];
    action.options = [...topics].sort(() => Math.random() - 0.5).slice(0, 3);
  }
  renderButtons();
  showActionPanel();
}

function showActionPanel() {
  if (action.type === 'chat') {
    const box = h('div.ev.action', {}, h('div', {}, '🎙️ ¡El chat quiere tema! Elige de qué hablar:'), h('div.row', {}, action.options.map(([t, v]) => btn(t, () => {
      const ratio = clamp(v + skill('charisma') * 0.04 + rand(-0.2, 0.2), 0, 1);
      finishAction(ratio);
    }))));
    R.actionBox.append(box);
    action.box = box;
  }
}

function finishAction(ratio) {
  if (!action || action.done) return;
  action.done = true;
  action.box?.remove();
  S2.actionResult(ratio, action.scare ? 'scare' : null);
  action.result = ratio;
  action.resultT = 1.8;
  if (ratio >= 0.6) { sfx.levelup(); player?.doEmote('cheer', 1.5); } else if (ratio < 0.3) { sfx.fail(); player?.doEmote('facepalm', 1.5); }
  R.events._key = null;
  actionTimer = rand(14, 24) / Math.max(1, speed * 0.7);
}

function updateAction(dt) {
  const a = action;
  a.t += dt;
  if (a.done) { a.resultT -= dt; if (a.resultT <= 0) { action = null; renderButtons(); } return; }
  if (a.t < a.prep) return;
  const tt = a.t - a.prep;
  if (a.type === 'aim') {
    a.spawnT -= dt;
    if (a.spawnT <= 0 && tt < a.duration - 0.8) { a.spawnT = 0.55; a.total++; a.targets.push({ x: rand(80, 880), y: rand(80, 460), life: 1.35, max: 1.35 }); }
    a.targets.forEach((t) => { t.life -= dt; });
    a.targets = a.targets.filter((t) => t.life > 0 && !t.hit);
    if (tt >= a.duration) finishAction(a.total ? a.hits / a.total : 0);
  } else if (a.type === 'timing') {
    a.pos += a.dir * a.speed * dt;
    if (a.pos > 1) { a.pos = 1; a.dir = -1; } if (a.pos < 0) { a.pos = 0; a.dir = 1; }
    if (a.rounds.length >= a.total || tt > a.duration) finishAction(a.rounds.filter(Boolean).length / a.total);
  } else if (a.type === 'qte') {
    if (a.scare && tt < 0.05 && !a.scared) { a.scared = true; sfx.scare(); player?.doEmote('scare', 1.2); }
    a.keyT += dt;
    if (a.keyT > a.per) { a.rounds.push(false); a.idx++; a.keyT = 0; sfx.miss(); }
    if (a.idx >= a.total) finishAction(a.rounds.filter(Boolean).length / a.total);
  } else if (a.type === 'chat') {
    if (tt > a.duration) finishAction(0.3);
  }
}

function onCanvasClick(e) {
  if (!action || action.done || action.t < action.prep) return;
  const r = R.canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 960, y = ((e.clientY - r.top) / r.height) * 540;
  if (action.type === 'aim') {
    const t = action.targets.find((t) => Math.hypot(t.x - x, t.y - y) < action.size * (0.5 + t.life / t.max * 0.5));
    if (t) { t.hit = true; action.hits++; sfx.hit(); action.flash = { x: t.x, y: t.y, t: 0.25 }; } else sfx.miss();
  } else if (action.type === 'timing') timingPress();
}
function timingPress() {
  const a = action;
  const ok = Math.abs(a.pos - a.zoneAt) < a.zone / 2;
  a.rounds.push(ok); ok ? sfx.hit() : sfx.miss();
  a.zoneAt = rand(0.15, 0.85); a.speed *= 1.12; a.flashOk = ok ? 0.3 : -0.3;
}
function onKey(e) {
  if (!action || action.done || action.t < action.prep) return;
  if (action.type === 'timing' && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); timingPress(); }
  if (action.type === 'qte' && e.key.startsWith('Arrow')) {
    e.preventDefault();
    const ok = e.key === action.seq[action.idx];
    action.rounds.push(ok); action.idx++; action.keyT = 0;
    ok ? sfx.hit() : sfx.miss();
  }
}

// ==================== DIBUJO ====================
function draw(t) {
  const g = R.ctx; if (!g) return;
  const W = 960, H = 540;
  const G = S2.game;
  const [c1, c2] = G.color;
  const lag = S2.tech.lag || S2.lagTimer > 0;
  if (lag && Math.random() < 0.15) return; // frames congelados
  // Fondo de "gameplay"
  const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, c1); grd.addColorStop(1, c2);
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  if (G.mini === 'aim') drawShooter(g, t, W, H);
  else if (G.mini === 'timing') drawRunner(g, t, W, H, G);
  else if (G.mini === 'qte') drawDungeon(g, t, W, H, G);
  else drawChatting(g, t, W, H);
  if (lag) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, W, H); for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(${randi(0, 255)},${randi(0, 255)},${randi(0, 255)},0.3)`; g.fillRect(randi(0, W), randi(0, H), randi(20, 120), randi(10, 40)); } }
  // Minijuego
  if (action) drawAction(g, t, W, H);
  // Overlay del canal
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(W - 250, 10, 240, 32);
  g.fillStyle = '#fff'; g.font = 'bold 16px sans-serif'; g.fillText(`${S.player.channel} · 👀 ${Math.round(S2.viewers)}`, W - 240, 32);
  if (S.peripherals.deck) { g.fillStyle = 'rgba(145,70,255,0.8)'; g.fillRect(10, H - 36, 260, 26); g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText(`Último seguidor: ${S2.chat.filter((c) => c.special === 'follow').slice(-1)[0]?.user || '—'}`, 18, H - 18); }
}

function drawShooter(g, t, W, H) {
  // horizonte y edificios
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 12; i++) { const bx = ((i * 110 - t * 20) % (W + 200)) - 100; const bh = 80 + ((i * 37) % 120); g.fillRect(bx, H * 0.55 - bh, 90, bh); }
  g.fillStyle = '#3d5a3d'; g.fillRect(0, H * 0.55, W, H * 0.45);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 20; i++) { g.beginPath(); g.moveTo(W / 2, H * 0.55); g.lineTo(i * 60 - 100 + Math.sin(t) * 20, H); g.lineTo(i * 60 - 80 + Math.sin(t) * 20, H); g.fill(); }
  // enemigo lejano
  const ex = W / 2 + Math.sin(t * 0.8) * 250; g.fillStyle = '#c0392b'; g.fillRect(ex - 8, H * 0.5 - 30, 16, 30); g.beginPath(); g.arc(ex, H * 0.5 - 36, 8, 0, 7); g.fill();
  // arma
  g.fillStyle = '#222'; g.save(); g.translate(W * 0.72, H * 0.86 + Math.sin(t * 6) * 4); g.rotate(-0.2); g.fillRect(0, 0, 220, 50); g.fillStyle = '#444'; g.fillRect(150, -20, 40, 30); g.restore();
  // mira
  g.strokeStyle = '#0f0'; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2 - 12, H / 2); g.lineTo(W / 2 + 12, H / 2); g.moveTo(W / 2, H / 2 - 12); g.lineTo(W / 2, H / 2 + 12); g.stroke();
  g.fillStyle = '#fff'; g.font = 'bold 22px monospace'; g.fillText(`❤ 100   ⛨ 50   🔫 ${30 - (Math.floor(t * 2) % 30)}/90`, 20, H - 20);
  g.fillText(`Quedan: ${Math.max(2, 99 - Math.floor(S2.minutes / 2))}`, 20, 40);
}
function drawRunner(g, t, W, H, G) {
  g.fillStyle = 'rgba(255,255,255,0.15)';
  for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(((i * 200 - t * 30) % (W + 200)) - 100, 80 + i * 13, 40, 0, 7); g.fill(); }
  const ground = H * 0.75;
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, ground, W, H - ground);
  for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)'; g.fillRect(((i * 90 - t * 300) % (W + 90) + W + 90) % (W + 90) - 90, ground, 45, 12); }
  const y = ground - 40 - Math.abs(Math.sin(t * 4)) * 60;
  if (G.genre === 'Carreras') { g.fillStyle = '#e74c3c'; g.fillRect(200, ground - 40, 120, 35); g.fillStyle = '#111'; g.beginPath(); g.arc(225, ground - 5, 14, 0, 7); g.arc(295, ground - 5, 14, 0, 7); g.fill(); }
  else if (G.genre === 'Deportes') { g.fillStyle = '#fff'; g.beginPath(); g.arc(250 + Math.sin(t * 3) * 80, y + 20, 18, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillRect(W - 120, ground - 160, 8, 160); g.fillRect(W - 120, ground - 160, 100, 8); }
  else { g.fillStyle = '#ffd32a'; g.fillRect(230, y, 40, 40); g.fillStyle = '#000'; g.fillRect(255, y + 10, 6, 6); }
  for (let i = 0; i < 3; i++) { const ox = ((i * 380 - t * 300) % (W + 400) + W + 400) % (W + 400) - 50; g.fillStyle = '#6ab04c'; g.fillRect(ox, ground - 50, 30, 50); }
  g.fillStyle = '#fff'; g.font = 'bold 26px monospace'; g.fillText(`SCORE ${Math.floor(t * 123) % 99999}`, 20, 40);
}
function drawDungeon(g, t, W, H, G) {
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 8; i++) { g.strokeStyle = 'rgba(255,255,255,0.06)'; g.strokeRect(W / 2 - i * 70, H / 2 - i * 40, i * 140, i * 80); }
  const fl = g.createRadialGradient(W / 2 + Math.sin(t) * 60, H / 2, 10, W / 2, H / 2, 380);
  fl.addColorStop(0, G.horror ? 'rgba(255,240,200,0.35)' : 'rgba(255,160,60,0.3)'); fl.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fl; g.fillRect(0, 0, W, H);
  if (G.horror) { if (Math.sin(t * 0.7) > 0.95) { g.fillStyle = '#fff'; g.beginPath(); g.arc(W * 0.7, H * 0.45, 20, 0, 7); g.fill(); g.fillStyle = '#000'; g.fillRect(W * 0.7 - 8, H * 0.45 - 4, 5, 5); g.fillRect(W * 0.7 + 3, H * 0.45 - 4, 5, 5); } }
  else { g.fillStyle = '#8e44ad'; g.beginPath(); g.arc(W * 0.7, H * 0.55 + Math.sin(t * 2) * 10, 60, 0, 7); g.fill(); g.fillStyle = '#e74c3c'; g.fillRect(W * 0.55, 30, 300 * (0.5 + 0.5 * Math.sin(t * 0.2)), 16); g.strokeStyle = '#fff'; g.strokeRect(W * 0.55, 30, 300, 16); }
  g.fillStyle = '#ddd'; g.font = 'bold 20px serif'; g.fillText(G.horror ? 'Batería linterna: ' + (100 - (Math.floor(t) % 100)) + '%' : 'HP ▰▰▰▰▰▱▱ · Estus 3', 20, H - 24);
}
function drawChatting(g, t, W, H) {
  g.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 20; i++) { g.beginPath(); g.arc((i * 97 + t * 20) % W, (i * 53 + Math.sin(t + i) * 30) % H, 10 + (i % 5) * 6, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(W * 0.25, H * 0.15, W * 0.5, H * 0.6);
  g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('💬 CHARLANDO CON EL CHAT', W / 2, H * 0.45);
  g.font = '22px sans-serif'; g.fillText(S2.title, W / 2, H * 0.53); g.textAlign = 'left';
}

function drawAction(g, t, W, H) {
  const a = action;
  if (a.t < a.prep) {
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, H / 2 - 50, W, 100);
    g.fillStyle = '#ffd32a'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center';
    const txt = { aim: '🎯 ¡ENEMIGOS! Haz clic en los objetivos', timing: '⏱️ ¡Pulsa ESPACIO en la zona verde!', qte: '⚔️ ¡Pulsa las FLECHAS a tiempo!', chat: '🎙️ ¡Elige un tema de conversación!' }[a.type];
    g.fillText(txt, W / 2, H / 2 + 15); g.textAlign = 'left';
    return;
  }
  if (a.done) {
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, H / 2 - 60, W, 120);
    g.textAlign = 'center'; g.font = 'bold 56px sans-serif';
    const r = a.result;
    g.fillStyle = r >= 0.95 ? '#ffd32a' : r >= 0.6 ? '#2ecc71' : r >= 0.3 ? '#dfe6e9' : '#e74c3c';
    g.fillText(r >= 0.95 ? '¡JUGADA ÉPICA! 🔥' : r >= 0.6 ? '¡Bien jugado!' : r >= 0.3 ? 'Meh...' : r <= 0.1 ? '¡FAIL LEGENDARIO! 💀' : 'Fallaste...', W / 2, H / 2 + 20);
    g.textAlign = 'left';
    return;
  }
  if (a.type === 'aim') {
    for (const tg of a.targets) {
      const r = a.size * (0.5 + (tg.life / tg.max) * 0.5);
      g.fillStyle = '#e74c3c'; g.beginPath(); g.arc(tg.x, tg.y, r, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(tg.x, tg.y, r * 0.66, 0, 7); g.fill();
      g.fillStyle = '#e74c3c'; g.beginPath(); g.arc(tg.x, tg.y, r * 0.33, 0, 7); g.fill();
    }
    if (a.flash) { a.flash.t -= 0.016; if (a.flash.t > 0) { g.strokeStyle = '#ffd32a'; g.lineWidth = 4; g.beginPath(); g.arc(a.flash.x, a.flash.y, 50 * (1 - a.flash.t * 3), 0, 7); g.stroke(); } }
    g.fillStyle = '#fff'; g.font = 'bold 28px sans-serif'; g.fillText(`Impactos: ${a.hits}/${a.total}   ⏱ ${Math.max(0, a.duration - (a.t - a.prep)).toFixed(1)}s`, W / 2 - 150, 80);
  } else if (a.type === 'timing') {
    const bx = 180, bw = 600, by = H - 120;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(bx - 10, by - 10, bw + 20, 60);
    g.fillStyle = '#2ecc71'; g.fillRect(bx + (a.zoneAt - a.zone / 2) * bw, by, a.zone * bw, 40);
    g.fillStyle = '#fff'; g.fillRect(bx + a.pos * bw - 4, by - 8, 8, 56);
    g.font = 'bold 26px sans-serif'; g.fillText(`Ronda ${Math.min(a.total, a.rounds.length + 1)}/${a.total}   ${a.rounds.map((r) => (r ? '✅' : '❌')).join(' ')}`, bx, by - 24);
    if (a.flashOk) { g.fillStyle = a.flashOk > 0 ? 'rgba(46,204,113,0.25)' : 'rgba(231,76,60,0.25)'; g.fillRect(0, 0, W, H); a.flashOk *= 0.9; if (Math.abs(a.flashOk) < 0.02) a.flashOk = 0; }
  } else if (a.type === 'qte') {
    if (a.scare && a.t - a.prep < 0.5) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.beginPath(); g.arc(W / 2, H / 2, 160, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(W / 2 - 55, H / 2 - 30, 35, 0, 7); g.arc(W / 2 + 55, H / 2 - 30, 35, 0, 7); g.fill(); g.fillRect(W / 2 - 70, H / 2 + 50, 140, 50); return; }
    const arrows = { ArrowUp: '⬆', ArrowDown: '⬇', ArrowLeft: '⬅', ArrowRight: '➡' };
    g.font = 'bold 64px sans-serif'; g.textAlign = 'center';
    a.seq.forEach((k, i) => {
      const x = W / 2 - 240 + i * 120, y = H - 110;
      g.fillStyle = i < a.idx ? (a.rounds[i] ? 'rgba(46,204,113,0.8)' : 'rgba(231,76,60,0.8)') : i === a.idx ? 'rgba(255,211,42,0.9)' : 'rgba(0,0,0,0.6)';
      g.fillRect(x - 48, y - 60, 96, 96);
      g.fillStyle = '#fff'; g.fillText(arrows[k], x, y + 10);
    });
    g.fillStyle = '#ffd32a'; g.fillRect(W / 2 - 240 - 48, H - 30, 576 * (1 - a.keyT / a.per), 8);
    g.textAlign = 'left';
  }
}
