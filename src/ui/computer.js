// Sistema operativo de la PC del juego ("StreamOS") con todas las apps.
import { S, bus, fmtMoney, fmtNum, fmtClock, dayName, notify, addMoney, now, SKILL_NAMES, skill, addXP, clamp, rand, randi, chance, uid, pick } from '../core/state.js';
import { h, $, clear, bar, btn } from './dom.js';
import { modal, toast, choose, skillsPanel } from './hud.js';
import { GAMES, GAME, discoverability } from '../data/games.js';
import { PARTS, partsBySlot, SLOT_ORDER, SLOT_NAMES, SLOT_ICONS, partDesc, pcScore, encodeScore, cpuTemp, powerDraw, part } from '../data/parts.js';
import { FOOD, PERIPHERALS, PERIPHERAL_SLOT_NAMES, DECO, BOOKS, INTERNET, RESOLUTIONS, peripheral } from '../data/items.js';
import { buy, acceptEmail, declineEmail, receiveItems } from '../game/sim.js';
import { techCheck, setupScore } from '../game/stream.js';
import { STREAMERS } from '../data/chat.js';
import { ACHIEVEMENTS } from '../data/progress.js';
import { sfx } from '../core/audio.js';

const APPS = [
  { id: 'streamix', name: 'Streamix', icon: '📡', color: '#9146ff' },
  { id: 'market', name: 'TecnoMarket', icon: '🛒', color: '#ff7f11' },
  { id: 'vapor', name: 'Vapor Juegos', icon: '🎮', color: '#1b2838' },
  { id: 'mail', name: 'Correo', icon: '✉️', color: '#0984e3' },
  { id: 'jobs', name: 'Pedidos', icon: '🔧', color: '#00b894' },
  { id: 'vidcut', name: 'VidCut', icon: '🎬', color: '#e84393' },
  { id: 'chirper', name: 'Chirper', icon: '🐦', color: '#1da1f2' },
  { id: 'bank', name: 'Banco', icon: '🏦', color: '#2d3436' },
  { id: 'mypc', name: 'Mi PC', icon: '🖥️', color: '#636e72' },
  { id: 'trophies', name: 'Logros', icon: '🏆', color: '#fdcb6e' },
];

let el = null;
let current = null;
let onExit = null;
let onStream = null;
let refreshTimer = null;

export function openComputer({ onClose, onStartStream, app }) {
  onExit = onClose; onStream = onStartStream;
  el = h('div#os');
  $('#ui').appendChild(el);
  S.stats._usedPC = true;
  sfx.boot();
  renderDesktop();
  if (app) openApp(app);
  refreshTimer = setInterval(() => { const c = $('.os-clock', el); if (c) c.textContent = `${dayName()} ${fmtClock(S.minute)}`; const m = $('.os-money', el); if (m) m.textContent = fmtMoney(S.money); }, 500);
}
export function closeComputer() {
  if (!el) return;
  clearInterval(refreshTimer);
  el.remove(); el = null; current = null;
  onExit?.();
}
export const computerOpen = () => !!el;
export function computerBack() { if (current) { current = null; renderDesktop(); return true; } return false; }

function renderDesktop() {
  clear(el);
  const unread = S.emails.filter((e) => !e.read).length;
  const activeJobs = S.jobs.filter((j) => j.status === 'active').length;
  el.append(
    h('div.os-desktop', {},
      h('div.os-wall', {}, h('div.os-logo', {}, h('span', {}, S.player.channel || 'StreamOS'), h('small', {}, 'StreamOS 11 · ' + (S.flags.partner ? 'Partner 💎' : S.flags.affiliate ? 'Afiliado ⭐' : 'Streamer novato')))),
      h('div.os-icons', {}, APPS.map((a) => h('button.os-icon', { onclick: () => openApp(a.id) },
        h('div.os-icon-img', { style: { background: a.color } }, a.icon,
          a.id === 'mail' && unread ? h('span.badge', {}, unread) : null,
          a.id === 'jobs' && activeJobs ? h('span.badge', {}, activeJobs) : null),
        h('div.os-icon-name', {}, a.name)))),
    ),
    taskbar(),
  );
}

function taskbar() {
  return h('div.os-taskbar', {},
    h('button.os-start', { onclick: () => { current = null; renderDesktop(); } }, '⊞'),
    h('div.os-task-apps', {}, APPS.map((a) => h('button.os-task', { class: current === a.id ? 'active' : '', title: a.name, onclick: () => openApp(a.id) }, a.icon))),
    h('div.os-tray', {}, h('span.os-money', {}, fmtMoney(S.money)), h('span.os-clock', {}, `${dayName()} ${fmtClock(S.minute)}`),
      h('button.os-power', { onclick: closeComputer, title: 'Levantarse de la PC' }, '⏻ Salir')),
  );
}

export function openApp(id) {
  current = id;
  const app = APPS.find((a) => a.id === id);
  clear(el);
  const body = h('div.app-body');
  el.append(
    h('div.app-window', {},
      h('div.app-title', { style: { background: app.color } }, h('span', {}, `${app.icon} ${app.name}`), h('div', {}, h('button.app-btn', { onclick: () => { current = null; renderDesktop(); } }, '—'), h('button.app-btn.close', { onclick: () => { current = null; renderDesktop(); } }, '✕'))),
      body),
    taskbar(),
  );
  const renderers = { streamix: appStreamix, market: appMarket, vapor: appVapor, mail: appMail, jobs: appJobs, vidcut: appVidcut, chirper: appChirper, bank: appBank, mypc: appMyPC, trophies: appTrophies };
  const rerender = () => { clear(body); renderers[id](body, rerender); };
  rerender();
}

// ======================= STREAMIX =======================
let streamTab = 'live';
function appStreamix(body, rerender) {
  const tabs = h('div.tabs', {}, [['live', '🔴 Ir en vivo'], ['stats', '📊 Canal'], ['trends', '📈 Tendencias']].map(([k, n]) => h('button.tab', { class: streamTab === k ? 'active' : '', onclick: () => { streamTab = k; rerender(); } }, n)));
  body.append(tabs);
  const pane = h('div.pane'); body.append(pane);
  if (streamTab === 'live') {
    const st = S.streamSettings;
    if (!S.inventory.games.includes(st.game)) st.game = 'chat';
    const tech = techCheck(st.game, st.res);
    const g = GAME[st.game];
    const trend = S.trends[g.id] || 1;
    const title = h('input.inp', { value: st.title, maxLength: 60, placeholder: 'Título del directo', oninput: (e) => { st.title = e.target.value; } });
    const gameSel = h('div.game-grid', {}, S.inventory.games.map((id) => {
      const G = GAME[id]; const tr = S.trends[id] || 1;
      return h('button.game-card', { class: st.game === id ? 'sel' : '', onclick: () => { st.game = id; rerender(); }, style: { background: `linear-gradient(135deg, ${G.color[0]}, ${G.color[1]})` } },
        h('b', {}, G.name), h('small', {}, G.genre), h('span.trend', { class: tr > 1.1 ? 'up' : tr < 0.9 ? 'down' : '' }, tr > 1.1 ? '▲ en tendencia' : tr < 0.9 ? '▼ en baja' : '● estable'));
    }));
    const resSel = h('div.res-row', {}, Object.keys(RESOLUTIONS).map((r) => h('button.chip', { class: st.res === r ? 'sel' : '', onclick: () => { st.res = r; rerender(); } }, r)));
    const disc = discoverability(g, trend, S.stats.followers);
    const sponsor = S.sponsors.find((s) => s.status === 'active' && (!s.game || s.game === st.game));
    pane.append(
      h('div.cols', {},
        h('div.col', {},
          h('h3', {}, 'Configura tu directo'),
          h('label', {}, 'Título'), title,
          h('label', {}, 'Juego / Categoría'), gameSel,
          h('label', {}, 'Resolución de salida'), resSel,
        ),
        h('div.col.side', {},
          h('h3', {}, 'Análisis previo'),
          h('div.kv', {}, h('span', {}, 'Popularidad del juego'), bar(g.pop, '#9146ff')),
          h('div.kv', {}, h('span', {}, 'Competencia (streamers)'), bar(g.sat * 100, '#e74c3c')),
          h('div.kv', {}, h('span', {}, 'Descubribilidad para ti'), bar(Math.min(100, disc * 100), '#2ecc71')),
          h('div.kv', {}, h('span', {}, 'Rendimiento PC vs requisito'), h('b', {}, `${tech.score} / ${g.req}`)),
          h('div.kv', {}, h('span', {}, 'Temperatura estimada CPU'), h('b', { style: { color: tech.temp > 88 ? '#e74c3c' : tech.temp > 78 ? '#f1c40f' : '#2ecc71' } }, `${tech.temp}°C`)),
          h('div.kv', {}, h('span', {}, 'Subida de internet'), h('b', {}, `${tech.upload} Mbps`)),
          h('div.kv', {}, h('span', {}, 'Puntos de escena (setup)'), h('b', {}, Math.round(setupScore()))),
          S.social.announceUntil > now() ? h('div.ok', {}, '✅ Anunciaste el directo en Chirper (+30% alcance)') : h('div.tip', {}, '💡 Anuncia el directo en Chirper antes de empezar'),
          sponsor ? h('div.ok', {}, `🤝 Patrocinio activo: ${sponsor.brand} (${Math.floor(sponsor.progress / 60)}/${sponsor.hours}h, menciones ${sponsor.mentions || 0}/${sponsor.hours})`) : null,
          S.collab && S.collab.until > now() ? h('div.ok', {}, `🤝 Colaboración lista con ${S.collab.who}`) : null,
          h('div.issues', {}, tech.issues.length ? tech.issues.map((i) => h('div', { class: i.lvl }, (i.lvl === 'bad' ? '⛔ ' : '⚠️ ') + i.t)) : h('div.ok', {}, '✅ Todo listo para transmitir')),
          h('div.tip', {}, `Mejor horario: 17:00–23:00 (hora actual ${fmtClock(S.minute)})`),
          btn('🔴 INICIAR DIRECTO', () => { if (S.needs.energy < 5) { notify('Estás demasiado cansado para transmitir', 'bad'); return; } const s = { ...st }; closeComputerSilently(); onStream?.(s); }, 'big live'),
        ),
      ),
    );
  } else if (streamTab === 'stats') {
    const st = S.stats;
    pane.append(
      h('div.stat-grid', {},
        statCard('Seguidores', fmtNum(st.followers), '💜'), statCard('Suscriptores', S.flags.affiliate ? fmtNum(st.subs) : 'Bloqueado', '⭐'),
        statCard('Media espectadores', st.avgViewers, '👀'), statCard('Pico histórico', fmtNum(st.peakViewers), '📈'),
        statCard('Directos', st.streams, '🎥'), statCard('Horas en vivo', (st.minutesStreamed / 60).toFixed(1), '⏱️'),
        statCard('Donaciones', fmtMoney(st.donations), '💸'), statCard('Ganado en directos', fmtMoney(st.earnedStream), '💰'),
        statCard('Ganado en videos', fmtMoney(st.earnedVideos), '🎬'), statCard('Ganado en trabajos', fmtMoney(st.earnedJobs), '🔧'),
      ),
      h('h3', {}, 'Programa de socios'),
      progressLine('Afiliado', [['Seguidores', st.followers, 50], ['Directos (30+ min)', st.streams, 3]], S.flags.affiliate),
      progressLine('Partner', [['Seguidores', st.followers, 1000], ['Media de espectadores', st.avgViewers, 25]], S.flags.partner),
      h('h3', {}, 'Tus habilidades'), skillsPanel(),
    );
  } else {
    const rows = [...GAMES].sort((a, b) => discoverability(b, S.trends[b.id] || 1, S.stats.followers) - discoverability(a, S.trends[a.id] || 1, S.stats.followers));
    pane.append(
      h('p.muted', {}, 'Los juegos muy populares tienen mucha competencia: para canales pequeños es más fácil destacar en juegos de nicho. Las tendencias cambian cada día.'),
      h('table.tbl', {}, h('tr', {}, h('th', {}, 'Juego'), h('th', {}, 'Género'), h('th', {}, 'Popularidad'), h('th', {}, 'Competencia'), h('th', {}, 'Tendencia hoy'), h('th', {}, 'Para ti'), h('th', {}, 'Req. PC'), h('th', {}, '')),
        rows.map((g) => {
          const tr = S.trends[g.id] || 1;
          const d = discoverability(g, tr, S.stats.followers);
          return h('tr', {}, h('td', {}, h('b', {}, g.name)), h('td', {}, g.genre), h('td', {}, bar(g.pop, '#9146ff')), h('td', {}, bar(g.sat * 100, '#e74c3c')),
            h('td', { class: tr > 1.1 ? 'up' : tr < 0.9 ? 'down' : '' }, `${tr > 1 ? '▲' : '▼'} ${Math.round(tr * 100)}%`),
            h('td', {}, bar(Math.min(100, d * 100), '#2ecc71')), h('td', { class: g.req > pcScore(S.pc.parts) ? 'down' : '' }, g.req),
            h('td', {}, S.inventory.games.includes(g.id) ? '✔️' : fmtMoney(g.price)));
        })),
    );
  }
}
function closeComputerSilently() { clearInterval(refreshTimer); el?.remove(); el = null; current = null; }
function statCard(n, v, i) { return h('div.stat-card', {}, h('div.sc-i', {}, i), h('div.sc-v', {}, v), h('div.sc-n', {}, n)); }
function progressLine(name, reqs, done) {
  return h('div.prog', {}, h('b', {}, `${done ? '✅' : '🔒'} ${name}`), reqs.map(([n, v, t]) => h('div.kv', {}, h('span', {}, `${n}: ${Math.min(v, t)}/${t}`), bar((v / t) * 100, done ? '#2ecc71' : '#9146ff'))));
}

// ======================= TECNOMARKET =======================
let mkTab = 'parts', mkSlot = 'gpu';
function appMarket(body, rerender) {
  const tabs = h('div.tabs', {}, [['parts', '🧩 Componentes'], ['periph', '🎧 Periféricos'], ['deco', '🛋️ Decoración'], ['food', '🍕 Comida a domicilio'], ['books', '📚 Libros'], ['net', '🌐 Internet']].map(([k, n]) => h('button.tab', { class: mkTab === k ? 'active' : '', onclick: () => { mkTab = k; rerender(); } }, n)));
  body.append(tabs, h('div.tip', {}, '🚚 Los pedidos llegan a tu puerta en 1-2 horas. Abre los paquetes en la entrada.'));
  const pane = h('div.pane'); body.append(pane);
  if (mkTab === 'parts') {
    pane.append(h('div.subtabs', {}, SLOT_ORDER.map((s) => h('button.chip', { class: mkSlot === s ? 'sel' : '', onclick: () => { mkSlot = s; rerender(); } }, `${SLOT_ICONS[s]} ${SLOT_NAMES[s]}`))));
    const owned = (id) => S.inventory.parts.filter((p) => p.id === id).length;
    pane.append(h('div.shop-grid', {}, partsBySlot(mkSlot).map((p) => shopCard({
      icon: SLOT_ICONS[p.slot], name: p.name, desc: partDesc(p), price: p.price, extra: owned(p.id) ? `En inventario: ${owned(p.id)}` : '',
      onBuy: () => { if (buy([{ kind: 'part', id: p.id }], p.price, true, `Compra: ${p.name}`)) rerender(); },
    }))));
  } else if (mkTab === 'periph') {
    pane.append(h('div.shop-grid', {}, Object.entries(PERIPHERALS).flatMap(([slot, list]) => list.map((p) => {
      const has = S.peripherals[slot] === p.id;
      return shopCard({ icon: p.icon, name: p.name, desc: `${PERIPHERAL_SLOT_NAMES[slot]}${p.desc ? ' · ' + p.desc : ''}`, price: p.price, owned: has, onBuy: () => { if (buy([{ kind: 'peripheral', id: p.id }], p.price, true, `Compra: ${p.name}`)) rerender(); } });
    }))));
  } else if (mkTab === 'deco') {
    pane.append(h('div.shop-grid', {}, DECO.map((d) => shopCard({ icon: d.icon, name: d.name, desc: `+${d.setup} puntos de escena${d.desc ? ' · ' + d.desc : ''}`, price: d.price, owned: S.inventory.deco.includes(d.id), onBuy: () => { if (buy([{ kind: 'deco', id: d.id }], d.price, true, `Compra: ${d.name}`)) rerender(); } }))));
  } else if (mkTab === 'food') {
    pane.append(h('div.shop-grid', {}, Object.entries(FOOD).map(([id, f]) => {
      const price = Math.round(f.price * 1.3 + 2);
      return shopCard({ icon: f.icon, name: f.name, desc: f.cook ? 'Para cocinar en la estufa' : `Hambre +${f.hunger}${f.energy ? ' · Energía +' + f.energy : ''}${f.fun ? ' · Diversión +' + f.fun : ''}`, price, extra: `Tienes: ${S.inventory.food[id] || 0} · Más barato en el súper`, onBuy: () => { if (buy([{ kind: 'food', id, qty: 1 }], price, true, `Delivery: ${f.name}`)) rerender(); } });
    })));
  } else if (mkTab === 'books') {
    pane.append(h('div.shop-grid', {}, BOOKS.map((b) => shopCard({ icon: b.icon, name: b.name, desc: `Estudia en el librero: +XP de ${SKILL_NAMES[b.skill]}`, price: b.price, owned: S.inventory.books.includes(b.id), onBuy: () => { if (buy([{ kind: 'book', id: b.id }], b.price, true, `Compra: ${b.name}`)) rerender(); } }))));
  } else {
    pane.append(h('p.muted', {}, 'El plan de internet se cobra semanalmente con la renta. La subida (upload) limita la resolución a la que puedes transmitir.'),
      h('div.shop-grid', {}, INTERNET.map((n) => h('div.shop-card', { class: S.internet === n.id ? 'owned' : '' },
        h('div.sc-icon', {}, '🌐'), h('b', {}, n.name), h('small', {}, `Subida ${n.upload} Mbps`), h('div.price', {}, `${fmtMoney(n.price)}/semana`),
        S.internet === n.id ? h('div.ok', {}, 'Plan actual') : btn('Contratar', () => { S.internet = n.id; notify(`🌐 Contrataste ${n.name}`, 'good'); rerender(); })))));
  }
}
function shopCard({ icon, name, desc, price, onBuy, owned, extra }) {
  return h('div.shop-card', { class: owned ? 'owned' : '' },
    h('div.sc-icon', {}, icon), h('b', {}, name), h('small', {}, desc), extra ? h('small.extra', {}, extra) : null,
    h('div.price', {}, fmtMoney(price)),
    owned ? h('div.ok', {}, '✔ Lo tienes') : btn('Comprar', onBuy, S.money >= price ? '' : 'poor'));
}

// ======================= VAPOR =======================
function appVapor(body, rerender) {
  body.append(h('p.muted', {}, 'Compra juegos digitales. Se añaden al instante a tu biblioteca.'));
  const sc = pcScore(S.pc.parts);
  body.append(h('div.shop-grid', {}, GAMES.map((g) => {
    const owned = S.inventory.games.includes(g.id);
    return h('div.shop-card.game', { class: owned ? 'owned' : '' },
      h('div.cover', { style: { background: `linear-gradient(135deg, ${g.color[0]}, ${g.color[1]})` } }, g.name),
      h('small', {}, `${g.genre} · Popularidad ${g.pop}`),
      h('small', { class: g.req > sc ? 'down' : '' }, `Requisito PC: ${g.req} (tu PC: ${sc})`),
      h('div.price', {}, g.price ? fmtMoney(g.price) : 'Gratis'),
      owned ? h('div.ok', {}, '✔ En tu biblioteca') : btn(g.price ? 'Comprar' : 'Obtener', () => { if (buy([{ kind: 'game', id: g.id }], g.price, false, `Juego: ${g.name}`)) { notify(`🎮 ${g.name} añadido a tu biblioteca`, 'good'); rerender(); } }));
  })));
}

// ======================= CORREO =======================
let mailSel = null;
function appMail(body, rerender) {
  const list = h('div.mail-list', {}, S.emails.length ? S.emails.map((m) => h('div.mail-item', { class: `${m.read ? '' : 'unread'} ${mailSel === m.id ? 'sel' : ''}`, onclick: () => { mailSel = m.id; m.read = true; rerender(); } },
    h('b', {}, m.from), h('div', {}, m.subject), h('small', {}, `Día ${m.day + 1}${m.status === 'accepted' ? ' · ✅ Aceptado' : m.status === 'declined' ? ' · ❌ Rechazado' : ''}`))) : h('p.muted', {}, 'Bandeja vacía'));
  const m = S.emails.find((x) => x.id === mailSel);
  const view = h('div.mail-view', {}, m ? [
    h('h3', {}, m.subject), h('div.muted', {}, `De: ${m.from} · Día ${m.day + 1}`), h('pre.mail-body', {}, m.body),
    ['job', 'sponsor', 'collab'].includes(m.type) && m.status === 'new' ? h('div.row', {}, btn('✅ Aceptar', () => { acceptEmail(m); rerender(); }, 'good'), btn('❌ Rechazar', () => { declineEmail(m); rerender(); })) : null,
  ] : h('p.muted', {}, 'Selecciona un correo'));
  body.append(h('div.mail', {}, list, view));
}

// ======================= PEDIDOS =======================
function appJobs(body) {
  const act = S.jobs.filter((j) => j.status === 'active');
  body.append(h('p.muted', {}, 'Pedidos de clientes aceptados desde el Correo. Se trabajan y entregan en el banco de trabajo de tu casa.'));
  if (!act.length) body.append(h('div.tip', {}, 'No tienes pedidos activos. Revisa tu correo: llegan nuevas ofertas cada día.'));
  body.append(h('div.job-list', {}, act.map((j) => h('div.job-card', {},
    h('div.job-h', {}, h('b', {}, `${j.type === 'build' ? '🧩 Armado' : '🩺 Reparación'} · ${j.client}`), h('span.price', {}, fmtMoney(j.pay))),
    j.type === 'build'
      ? h('div', {}, `Rendimiento mínimo: ${j.minScore}`, j.req.glass ? ' · Vidrio' : '', j.req.nvme ? ' · NVMe' : '', j.req.ram32 ? ' · 32GB+ RAM' : '')
      : h('div', {}, `Síntoma: "${j.symptom}"`),
    h('small', {}, `Entrega hasta el día ${j.deadlineDay + 1} (${j.deadlineDay - S.day <= 0 ? '¡hoy!' : `quedan ${j.deadlineDay - S.day} días`})`),
    S.bench.job === j.id ? h('div.ok', {}, '🛠️ En el banco de trabajo') : null,
  ))));
  const past = S.jobs.filter((j) => j.status !== 'active');
  if (past.length) body.append(h('h3', {}, 'Historial'), h('div', {}, past.map((j) => h('div.muted', {}, `${j.status === 'done' ? '✅' : '❌'} ${j.client} · ${fmtMoney(j.pay)}`))));
}

// ======================= VIDCUT (editor de video) =======================
let editState = null;
function appVidcut(body, rerender) {
  if (!editState) {
    body.append(h('h3', {}, 'Tus VODs (grabaciones de directos)'));
    const vods = S.vods.filter((v) => !v.used);
    if (!vods.length) body.append(h('div.tip', {}, 'No tienes VODs sin editar. Haz un directo de al menos 20 minutos para grabar uno.'));
    body.append(h('div.vod-list', {}, vods.map((v) => h('div.vod', {},
      h('div.vod-thumb', { style: { background: `linear-gradient(135deg, ${GAME[v.game].color[0]}, ${GAME[v.game].color[1]})` } }, `${Math.floor(v.minutes / 60)}h${String(v.minutes % 60).padStart(2, '0')}`),
      h('div', {}, h('b', {}, v.title), h('div.muted', {}, `${GAME[v.game].name} · Día ${v.day + 1} · Pico ${v.peak}`)),
      h('div.row', {}, btn('🎬 Editar video', () => { editState = { vod: v, sel: new Set(), type: 'video', thumb: 0, title: '' }; rerender(); }), btn('📱 Hacer short', () => { editState = { vod: v, sel: new Set(), type: 'short', thumb: 0, title: '' }; rerender(); }), btn('🗑️', () => { v.used = true; rerender(); }))))));
    body.append(h('h3', {}, 'Videos publicados'));
    if (!S.videos.length) body.append(h('p.muted', {}, 'Aún no subiste videos.'));
    body.append(h('table.tbl', {}, S.videos.length ? h('tr', {}, h('th', {}, 'Título'), h('th', {}, 'Tipo'), h('th', {}, 'Calidad'), h('th', {}, 'Vistas'), h('th', {}, 'Ingresos')) : null,
      [...S.videos].reverse().slice(0, 15).map((v) => h('tr', {}, h('td', {}, v.title), h('td', {}, v.type === 'short' ? 'Short' : 'Video'), h('td', {}, '★'.repeat(Math.max(1, Math.round(v.quality * 5)))), h('td', {}, fmtNum(v.views)), h('td', {}, fmtMoney(v.earned))))));
    if (!S.flags.affiliate) body.append(h('div.tip', {}, '💡 Los videos generan dinero cuando eres Afiliado. Aun así te dan seguidores.'));
    return;
  }
  const E = editState, v = E.vod;
  const maxSel = E.type === 'short' ? 1 : 6;
  const noise = Math.max(0, 30 - skill('editing') * 3);
  if (!v._wave) v._wave = v.segments.map((s) => clamp(s.interest + rand(-noise, noise), 3, 100));
  const icons = { epic: '🔥', fail: '💀', raid: '⚔️', donation: '💸', scare: '😱', sub: '⭐', chat: '💬' };
  body.append(
    h('div.row.between', {}, h('h3', {}, `Editando: ${v.title} (${E.type === 'short' ? 'Short vertical' : 'Video'})`), btn('← Volver', () => { editState = null; rerender(); })),
    h('p.muted', {}, `Selecciona hasta ${maxSel} fragmento(s) de 10 minutos. La barra muestra el nivel de emoción estimado (más preciso con más habilidad de Edición: Nv ${skill('editing')}). Los iconos marcan momentos clave.`),
    h('div.timeline', {}, v.segments.map((s, i) => h('button.seg', {
      class: E.sel.has(i) ? 'sel' : '',
      onclick: () => { if (E.sel.has(i)) E.sel.delete(i); else if (E.sel.size < maxSel) E.sel.add(i); rerender(); },
    }, h('div.seg-bar', { style: { height: `${v._wave[i]}%` } }), h('div.seg-ic', {}, s.moments.map((m) => icons[m] || '').join('')), h('small', {}, `${s.min - 10}'`)))),
    h('label', {}, 'Miniatura'),
    h('div.row', {}, ['😱 Cara de sorpresa + flecha roja', '🔥 Texto grande "INCREÍBLE"', '🙂 Captura normal del juego'].map((t, i) => h('button.chip', { class: E.thumb === i ? 'sel' : '', onclick: () => { E.thumb = i; rerender(); } }, t))),
    h('label', {}, 'Título'),
    h('div.row', {}, (() => {
      const g = GAME[v.game].name;
      const opts = [`¡NO PUEDO CREER LO QUE PASÓ EN ${g.toUpperCase()}! 😱`, `Mejores momentos de ${g} #${randi(1, 99)}`, `${g} - directo del día ${v.day + 1}`];
      if (!E.title) E.title = opts[0];
      return opts.map((o) => h('button.chip', { class: E.title === o ? 'sel' : '', onclick: () => { E.title = o; rerender(); } }, o));
    })()),
    h('div.row', {}, btn(`⬆️ Renderizar y subir (${E.sel.size}/${maxSel})`, () => uploadVideo(rerender), 'big', E.sel.size === 0)),
  );
}
function uploadVideo(rerender) {
  const E = editState, v = E.vod;
  const segs = [...E.sel].map((i) => v.segments[i]);
  const avg = segs.reduce((a, s) => a + s.interest, 0) / segs.length / 100;
  const lenBonus = E.type === 'short' ? 1 : clamp(segs.length / 4, 0.5, 1.1);
  const thumbB = [1.15, 1.08, 0.95][E.thumb];
  const titleB = E.title.includes('!') || E.title.includes('😱') ? 1.08 : 1;
  const ed = skill('editing');
  const quality = clamp(avg * lenBonus * thumbB * titleB * (0.75 + ed * 0.04), 0.05, 1);
  const minutes = E.type === 'short' ? 30 : 60 + segs.length * 20 - ed * 5;
  modal({
    title: '🎬 Renderizando...', closable: false,
    content: (b) => {
      const fill = h('div.pfill'); b.append(h('p', {}, `Editando y exportando (${Math.round(minutes)} min de juego)...`), h('div.pbar', {}, fill));
      let k = 0; const iv = setInterval(() => { k += 0.04; fill.style.width = `${Math.min(100, k * 100)}%`; if (k >= 1) { clearInterval(iv); b.closest('.modal-wrap').remove(); finish(); } }, 60);
    },
  });
  const finish = () => {
    bus.emit('skiptime', Math.round(minutes));
    const viral = quality > 0.8 && chance(0.12 + ed * 0.01) ? randi(4, 12) : 1;
    S.videos.push({ id: uid('vid'), title: E.title, type: E.type, quality, game: v.game, uploadedAt: now(), views: 0, earned: 0, viral });
    S.stats.videosUploaded++;
    addXP('editing', 15 + segs.length * 5);
    v.used = true;
    notify(`🎬 Video subido: "${E.title}" · Calidad ${'★'.repeat(Math.max(1, Math.round(quality * 5)))}${viral > 1 ? ' · ¡Parece que se está haciendo viral! 🚀' : ''}`, 'good');
    editState = null;
    rerender();
  };
}

// ======================= CHIRPER =======================
function appChirper(body, rerender) {
  const canPost = S.social.postsToday < 3;
  const post = (kind) => {
    if (!canPost) return;
    S.social.postsToday++;
    let text = '', gain = 0;
    if (kind === 'announce') { text = `🔴 ¡Hoy directo de ${GAME[S.streamSettings.game].name}! No se lo pierdan 👉 streamix.tv/${(S.player.channel || '').replace(/\s/g, '').toLowerCase()}`; S.social.announceUntil = now() + 12 * 60; gain = randi(0, 2); }
    else if (kind === 'meme') { text = pick(['Cuando dices "una partida más" a las 3am 💀', 'Mi PC cuando abro 2 pestañas de Chrome 🔥🔥', 'El chat: "juega mejor" / Yo: 🤡', 'POV: el troll del chat vuelve con otra cuenta']); gain = chance(0.15 + skill('charisma') * 0.02) ? randi(10, 40 + S.stats.followers * 0.05) : randi(0, 4); if (gain > 9) notify('🐦 ¡Tu meme se volvió viral!', 'gold'); }
    else { text = `¡Gracias por los ${fmtNum(S.stats.followers)} seguidores! Son los mejores 💜`; gain = randi(0, 3); S.needs.fun = clamp(S.needs.fun + 5, 0, 100); addXP('charisma', 3); }
    S.stats.followers += Math.round(gain);
    S.social.posts.unshift({ text, day: S.day, t: fmtClock(S.minute), likes: randi(0, 5) + Math.round(S.stats.followers * rand(0.02, 0.08)), rt: randi(0, 3) });
    bus.emit('skiptime', 5);
    rerender();
  };
  const handle = '@' + (S.player.channel || 'streamer').replace(/\s/g, '');
  const feed = [
    ...S.social.posts.slice(0, 8).map((p) => ({ ...p, who: S.player.name, handle, me: true })),
    ...[0, 1, 2, 3].map((i) => ({ who: STREAMERS[(S.day + i) % STREAMERS.length].slice(1), handle: STREAMERS[(S.day + i) % STREAMERS.length], text: ['Hoy maratón de 12 horas 🔥', '¿Qué juego pruebo mañana?', 'Nueva placa de 1M!! gracias 😭', 'El nuevo parche de Fortaleza Royale está roto jaja', 'Mañana colab sorpresa 👀', 'Setup nuevo terminado ✨'][(S.day * 3 + i) % 6], likes: randi(500, 20000), rt: randi(50, 2000) })),
  ];
  body.append(
    h('div.cols', {},
      h('div.col.side', {},
        h('div.profile', {}, h('div.avatar', {}, (S.player.name || '?')[0]), h('b', {}, S.player.name), h('div.muted', {}, handle), h('div', {}, `${fmtNum(S.stats.followers)} seguidores`)),
        h('h3', {}, 'Publicar'), h('small.muted', {}, `Publicaciones hoy: ${S.social.postsToday}/3`),
        btn('📣 Anunciar directo (+30% alcance 12h)', () => post('announce'), '', !canPost),
        btn('😂 Publicar un meme (puede volverse viral)', () => post('meme'), '', !canPost),
        btn('💜 Agradecer a la comunidad', () => post('thanks'), '', !canPost),
      ),
      h('div.col', {}, h('h3', {}, 'Inicio'), feed.map((p) => h('div.chirp', { class: p.me ? 'me' : '' }, h('div.avatar.sm', {}, p.who[0]), h('div', {}, h('b', {}, p.who), h('span.muted', {}, ` ${p.handle}`), h('p', {}, p.text), h('small.muted', {}, `❤️ ${fmtNum(p.likes)} · 🔁 ${fmtNum(p.rt)}`))))),
    ),
  );
}

// ======================= BANCO =======================
function appBank(body) {
  const net = INTERNET.find((n) => n.id === S.internet);
  const days = S.bills.nextBillDay - S.day;
  body.append(
    h('div.stat-grid', {},
      statCard('Saldo', fmtMoney(S.money), '💵'),
      statCard('Próximas facturas', `en ${days} día${days === 1 ? '' : 's'}`, '📅'),
      statCard('Renta + Internet', fmtMoney(300 + net.price), '🏠'),
      statCard('Electricidad acumulada', fmtMoney(S.bills.electricity), '⚡'),
    ),
    S.bills.debt ? h('div.bad', {}, `⚠️ Tienes ${S.bills.debt} aviso(s) de deuda. A los 3 te desalojan.`) : null,
    h('h3', {}, 'Movimientos'),
    h('table.tbl', {}, S.bank.slice(0, 40).map((t) => h('tr', {}, h('td', {}, `Día ${t.day + 1} ${t.t}`), h('td', {}, t.reason), h('td', { class: t.amount >= 0 ? 'up' : 'down' }, `${t.amount >= 0 ? '+' : ''}${fmtMoney(t.amount)}`)))),
  );
}

// ======================= MI PC =======================
function appMyPC(body, rerender) {
  const P = S.pc.parts;
  const sc = pcScore(P), enc = encodeScore(P);
  const temp = cpuTemp(P, S.pc.paste, S.pc.dust, 0.8);
  body.append(
    h('div.cols', {},
      h('div.col', {},
        h('h3', {}, 'Especificaciones'),
        h('table.tbl', {}, SLOT_ORDER.map((s) => h('tr', {}, h('td', {}, `${SLOT_ICONS[s]} ${SLOT_NAMES[s]}`), h('td', {}, h('b', {}, part(P[s])?.name || '—')), h('td.muted', {}, part(P[s]) ? partDesc(part(P[s])) : '')))),
        h('div.tip', {}, '🔧 Para mejorar tu PC: compra piezas, ármalas en el banco de trabajo y usa "Instalar en mi escritorio". Tus piezas viejas vuelven al inventario.'),
      ),
      h('div.col.side', {},
        h('h3', {}, 'Rendimiento'),
        h('div.big-score', {}, sc, h('small', {}, '/100')),
        h('div.kv', {}, h('span', {}, 'Codificación (stream)'), bar(enc, '#9146ff')),
        h('div.kv', {}, h('span', {}, `Temperatura a carga: ${temp}°C`), bar(temp, temp > 88 ? '#e74c3c' : temp > 78 ? '#f1c40f' : '#2ecc71')),
        h('div.kv', {}, h('span', {}, `Polvo: ${Math.round(S.pc.dust)}%`), bar(S.pc.dust, '#a4b0be')),
        h('div.kv', {}, h('span', {}, `Consumo: ${powerDraw(P)}W / Fuente ${part(P.psu)?.watts}W`)),
        h('div.muted', {}, S.pc.dust > 50 ? '⚠️ Mucho polvo: límpiala con aire comprimido en la torre (junto al escritorio).' : 'Limpia el polvo cada pocos días en la torre de la PC.'),
        btn('▶ Ejecutar benchmark', () => runBenchmark(sc)),
        h('h3', {}, 'Color de iluminación RGB'),
        h('div.row', {}, ['#8a2be2', '#ff0055', '#00e5ff', '#39ff14', '#ffae00', '#ffffff', '#ff00ff', '#0055ff'].map((c) => h('button.swatch', { style: { background: c }, class: S.ledColor === c ? 'sel' : '', onclick: () => { S.ledColor = c; bus.emit('led'); rerender(); } }))),
      ),
    ),
  );
}
function runBenchmark(sc) {
  modal({
    title: '▶ Benchmark 3DStress', closable: true,
    content: (b) => {
      const c = h('canvas', { width: 520, height: 240, style: { width: '100%', borderRadius: '8px', background: '#000' } });
      const out = h('div.big-score', {}, '...');
      b.append(c, out);
      const g = c.getContext('2d');
      let t = 0; const fps = Math.round(20 + sc * 1.6);
      const iv = setInterval(() => {
        t += 0.05;
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 520, 240);
        for (let i = 0; i < 30; i++) { const a = t * 2 + i * 0.4; g.fillStyle = `hsl(${(i * 12 + t * 80) % 360},90%,60%)`; g.beginPath(); g.arc(260 + Math.cos(a) * (40 + i * 5), 120 + Math.sin(a * 1.3) * (20 + i * 3), 4 + (i % 4), 0, 7); g.fill(); }
        g.fillStyle = '#0f0'; g.font = '14px monospace'; g.fillText(`FPS: ${Math.round(fps + Math.sin(t * 5) * fps * 0.08)}`, 10, 20);
        if (t > 4) { clearInterval(iv); out.textContent = `${sc * 137 + randi(0, 99)} pts`; out.append(h('small', {}, ` · ~${fps} FPS en 1080p`)); }
      }, 30);
    },
  });
}

// ======================= LOGROS =======================
function appTrophies(body) {
  const got = Object.keys(S.achievements).length;
  body.append(h('h3', {}, `Logros ${got}/${ACHIEVEMENTS.length}`), h('div.ach-grid', {}, ACHIEVEMENTS.map((a) => h('div.ach', { class: S.achievements[a.id] ? 'got' : '' }, h('div.ach-i', {}, S.achievements[a.id] ? a.icon : '🔒'), h('b', {}, a.name), h('small', {}, a.desc)))));
  body.append(h('h3', {}, 'Habilidades'), skillsPanel());
}
