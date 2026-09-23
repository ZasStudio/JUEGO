// Estado global del juego, bus de eventos, guardado y utilidades.

export const bus = {
  ev: {},
  on(e, f) { (this.ev[e] ??= []).push(f); return () => this.off(e, f); },
  off(e, f) { this.ev[e] = (this.ev[e] || []).filter((x) => x !== f); },
  emit(e, ...a) { (this.ev[e] || []).slice().forEach((f) => f(...a)); },
};

export const SAVE_KEY = 'streamer_life_3d_save_v1';
export const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export let S = null;
export function setState(s) { S = s; }

let _uid = Date.now() % 100000;
export const uid = (p = 'id') => `${p}_${(_uid++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export const fmtMoney = (n) => `$${Math.round(n).toLocaleString('es-ES')}`;
export const fmtNum = (n) => {
  n = Math.round(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
  return n.toLocaleString('es-ES');
};

export function newState(player) {
  return {
    version: 1,
    player,
    money: 500,
    day: 0,
    minute: 9 * 60,
    needs: { hunger: 80, energy: 85, hygiene: 75, fun: 70 },
    stats: {
      followers: 0, subs: 0, totalViewers: 0, streams: 0, minutesStreamed: 0,
      peakViewers: 0, donations: 0, earnedStream: 0, earnedVideos: 0, earnedJobs: 0,
      pcsBuilt: 0, pcsRepaired: 0, videosUploaded: 0, bans: 0, raidsReceived: 0,
      avgViewers: 0,
    },
    skills: { charisma: 0, gaming: 0, editing: 0, hardware: 0 },
    inventory: {
      parts: [], // {uid, id, broken?}
      food: { noodles: 3, chips: 1 },
      games: ['chat', 'fortaleza', 'retro'],
      books: [],
      deco: [],
    },
    peripherals: { webcam: null, mic: 'mic_headset', light: null, monitor2: null, chair: 'chair_basic', keyboard: null, mouse: null, deck: null, greenscreen: null },
    pc: {
      parts: { case: 'case_office', mb: 'mb_1', cpu: 'cpu_a3', cooler: 'cool_1', ram: 'ram_1', gpu: 'gpu_1', storage: 'st_1', psu: 'psu_1' },
      paste: true, dust: 10, broken: null,
    },
    bench: { parts: {}, paste: false, job: null, broken: {} },
    deliveries: [], // {items:[{kind,id,qty}], at}
    doorPackages: [], // items waiting at door
    emails: [],
    jobs: [], // pedidos de clientes
    sponsors: [],
    vods: [],
    videos: [],
    social: { posts: [], announceUntil: 0, lastPostDay: -1, postsToday: 0 },
    trends: {},
    internet: 'net_basic',
    bills: { nextBillDay: 7, debt: 0, electricity: 0 },
    bank: [],
    quests: { index: 0 },
    achievements: {},
    flags: { affiliate: false, partner: false, plaques: [] },
    ledColor: '#8a2be2',
    streamSettings: { title: 'Primer directo!! 🎮', game: 'chat', res: '720p' },
    lastCoffee: -999,
    settings: { volume: 0.6, speed: 1, shadows: true },
    location: 'home',
    agency: { employees: [], candidates: [], slots: 2, candDay: -1, office: false },
    bots: { pending: 0, risk: 0, strikes: 0, banUntil: 0 },
    pet: null, // {type, name, color, hunger, happy}
    barista: { shifts: 0, best: 0 },
  };
}

export function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); return true; } catch (e) { return false; }
}
export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Rellena campos nuevos si el guardado es antiguo
    const base = newState(data.player);
    return deepMerge(base, data);
  } catch (e) { return null; }
}
export function deleteSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nada */ } }

function deepMerge(base, data) {
  for (const k of Object.keys(data)) {
    const v = data[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      base[k] = deepMerge(base[k], v);
    } else base[k] = v;
  }
  return base;
}

// ---- Tiempo ----
export const now = () => S.day * 1440 + S.minute;
export const hour = () => Math.floor(S.minute / 60);
export const fmtClock = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
export const dayName = (d = S.day) => DAY_NAMES[d % 7];

// ---- Dinero ----
export function addMoney(amount, reason) {
  S.money += amount;
  S.bank.unshift({ day: S.day, t: fmtClock(S.minute), amount: Math.round(amount * 100) / 100, reason });
  if (S.bank.length > 80) S.bank.length = 80;
  bus.emit('money', amount, reason);
}
export function canAfford(n) { return S.money >= n; }

// ---- Habilidades ----
export const SKILL_NAMES = { charisma: 'Carisma', gaming: 'Gaming', editing: 'Edición', hardware: 'Hardware' };
export const levelFromXp = (xp) => Math.min(10, Math.floor(Math.sqrt(xp / 40)) + 1);
export const xpForLevel = (lv) => (lv - 1) ** 2 * 40;
export function skill(name) { return levelFromXp(S.skills[name] || 0); }
export function addXP(name, amt) {
  const before = skill(name);
  S.skills[name] = (S.skills[name] || 0) + amt;
  const after = skill(name);
  if (after > before) bus.emit('levelup', name, after);
}

export function notify(text, type = 'info', icon = '') { bus.emit('toast', { text, type, icon }); }
