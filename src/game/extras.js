// Sistemas extra: agencia de streamers, bots de espectadores, mascota y trabajo de barista.
import { S, bus, addMoney, notify, uid, pick, randi, rand, chance, clamp, now, fmtMoney, fmtNum } from '../core/state.js';
import { CLIENTS } from '../data/chat.js';
import { GAMES } from '../data/games.js';
import { pushEmail } from './sim.js';

// ---------------- Agencia (casa de streaming) ----------------
const NICKS = ['Nova', 'Pixel', 'Kira', 'Toxi', 'Mango', 'Zeta', 'Luna', 'Dante', 'Frost', 'Wanda', 'Rex', 'Momo'];
export function agency() { return S.agency; }
export function genCandidates() {
  const A = S.agency;
  A.candidates = Array.from({ length: 3 }, () => {
    const skill = randi(1, 5);
    return {
      id: uid('emp'), name: `${pick(NICKS)}${pick(['Gamer', 'TV', 'Plays', '_', 'Live', 'Pro'])}${randi(1, 99)}`,
      real: pick(CLIENTS), skill, game: pick(GAMES.filter((g) => g.id !== 'chat')).id,
      salary: 15 + skill * 12 + randi(0, 10), setup: 400 + skill * 150, followers: randi(20, 200) * skill,
    };
  });
  A.candDay = S.day;
}
export function hire(c) {
  const A = S.agency;
  if (A.employees.length >= A.slots) { notify('No hay espacio: mejora tu casa de streaming', 'bad'); return false; }
  if (S.money < c.setup) { notify(`Necesitas ${fmtMoney(c.setup)} para su equipo de streaming`, 'bad'); return false; }
  addMoney(-c.setup, `Equipo para ${c.name}`);
  A.employees.push({ ...c, hiredDay: S.day, earned: 0, mood: 80 });
  A.candidates = A.candidates.filter((x) => x.id !== c.id);
  notify(`🤝 ${c.name} se unió a tu agencia`, 'good');
  return true;
}
export function fire(e) { S.agency.employees = S.agency.employees.filter((x) => x.id !== e.id); notify(`👋 ${e.name} dejó la agencia`, 'info'); }
export function train(e) {
  const cost = 250 * e.skill;
  if (e.skill >= 10) return;
  if (S.money < cost) { notify('Sin dinero suficiente', 'bad'); return; }
  addMoney(-cost, `Curso para ${e.name}`); e.skill++; e.salary += 8; notify(`📈 ${e.name} subió a nivel ${e.skill}`, 'good');
}
function agencyDay() {
  const A = S.agency;
  if (!A.employees.length) return;
  let total = 0, lines = [];
  for (const e of A.employees) {
    const inc = (12 + e.skill * 16 + e.followers * 0.03) * rand(0.6, 1.4) * (0.7 + e.mood / 250);
    const cut = inc * 0.6; // tu parte
    e.followers += Math.round(e.skill * rand(4, 14) + e.followers * 0.01);
    e.mood = clamp(e.mood + rand(-8, 5), 0, 100);
    const net = cut - e.salary;
    e.earned += net; total += net;
    lines.push(`${e.name}: ${net >= 0 ? '+' : ''}${fmtMoney(net)} (seguidores ${fmtNum(e.followers)})`);
    if (e.mood < 15 && chance(0.3)) { fire(e); pushEmail({ from: e.name, subject: 'Renuncio 😤', body: 'No estoy a gusto en la agencia. Me voy.' }); }
  }
  addMoney(total, 'Agencia: balance diario');
  S.stats.agencyEarned = (S.stats.agencyEarned || 0) + total;
  pushEmail({ from: 'Tu agencia', subject: `Reporte diario: ${total >= 0 ? '+' : ''}${fmtMoney(total)}`, body: lines.join('\n') });
}
export function motivate(e) {
  if (S.money < 50) return;
  addMoney(-50, `Pizza para ${e.name}`);
  e.mood = clamp(e.mood + 25, 0, 100);
}

// ---------------- Bots de espectadores ----------------
export const BOT_PACKS = [
  { n: 25, price: 20, risk: 0.12 },
  { n: 100, price: 70, risk: 0.22 },
  { n: 400, price: 240, risk: 0.38 },
];
export function buyBots(p) {
  if (S.money < p.price) { notify('Sin dinero suficiente', 'bad'); return false; }
  addMoney(-p.price, 'Servicio anónimo');
  S.bots.pending += p.n; S.bots.risk = Math.max(S.bots.risk, p.risk);
  notify(`🤖 ${p.n} bots listos para tu próximo directo`, 'info');
  return true;
}
// Se llama al terminar un directo que usó bots
export function botsAfterStream(n) {
  const risk = S.bots.risk;
  S.bots.pending = 0; S.bots.risk = 0;
  if (!n || !chance(risk)) return null;
  S.bots.strikes++;
  if (S.bots.strikes >= 3) {
    S.bots.strikes = 0;
    S.bots.banUntil = now() + 3 * 1440;
    const lost = Math.floor(S.stats.followers * 0.15);
    S.stats.followers -= lost;
    pushEmail({ from: 'Streamix · Seguridad', subject: '⛔ Canal suspendido 3 días', body: `Detectamos espectadores falsos por tercera vez. Tu canal queda suspendido 3 días y se eliminaron ${lost} seguidores sospechosos.` });
    return 'ban';
  }
  pushEmail({ from: 'Streamix · Seguridad', subject: `⚠️ Advertencia ${S.bots.strikes}/3`, body: 'Detectamos actividad de bots en tu último directo. Con 3 advertencias tu canal será suspendido.' });
  return 'strike';
}
export const isBanned = () => S.bots.banUntil > now();

// ---------------- Mascota ----------------
export const PETS = [
  { type: 'cat', name: 'Gato', price: 150, colors: ['#e0a458', '#3b3b3b', '#f2f2f2', '#9e9e9e'] },
  { type: 'dog', name: 'Perro', price: 250, colors: ['#c68642', '#f5deb3', '#2b2b2b', '#8d5b3a'] },
];
function petHour() {
  if (!S.pet) return;
  S.pet.hunger = clamp(S.pet.hunger - 2.2, 0, 100);
  S.pet.happy = clamp(S.pet.happy - (S.pet.hunger < 20 ? 3 : 0.8), 0, 100);
}

// ---------------- Barista ----------------
export const BARISTA = {
  size: ['Chico', 'Mediano', 'Grande'],
  drink: ['Espresso', 'Latte', 'Capuchino', 'Mocha', 'Chai'],
  milk: ['Entera', 'Avena', 'Almendra', 'Sin leche'],
  extra: ['Canela', 'Caramelo', 'Crema', 'Nada'],
};
export const LABELS = { size: 'Tamaño', drink: 'Bebida', milk: 'Leche', extra: 'Extra' };
export function randomOrder() { return Object.fromEntries(Object.entries(BARISTA).map(([k, v]) => [k, pick(v)])); }

bus.on('day', () => { agencyDay(); if (S.agency.candDay !== S.day) genCandidates(); });
bus.on('hour', () => petHour());
