// Banco de trabajo: armar, diagnosticar, reparar y entregar PCs.
import { S, bus, fmtMoney, notify, addMoney, addXP, skill, uid, clamp } from '../core/state.js';
import { h, $, clear, btn } from './dom.js';
import { modal, choose, progressOverlay } from './hud.js';
import { PARTS, part, SLOT_ORDER, SLOT_NAMES, SLOT_ICONS, partDesc, checkBuild, pcScore, cpuTemp, powerDraw, buildValue } from '../data/parts.js';
import { tick, refreshDerived } from '../game/sim.js';
import { sfx } from '../core/audio.js';

let el = null, onChange = null, onExit = null, filter = 'all';

const REQUIRES = { mb: 'case', cpu: 'mb', cooler: 'cpu', ram: 'mb', gpu: 'mb', storage: 'case', psu: 'case' };
const DEPENDENTS = { case: ['mb', 'storage', 'psu'], mb: ['cpu', 'ram', 'gpu'], cpu: ['cooler'] };

export function openBench({ onUpdate, onClose }) {
  onChange = onUpdate; onExit = onClose;
  el = h('div#bench');
  $('#ui').appendChild(el);
  render();
}
export function closeBench() { if (el) { el.remove(); el = null; onExit?.(); } }
export const benchOpen = () => !!el;

const B = () => S.bench;
const job = () => S.jobs.find((j) => j.id === B().job && j.status === 'active');

function render() {
  if (!el) return;
  clear(el);
  const bench = B();
  const j = job();
  const inv = S.inventory.parts.filter((p) => filter === 'all' || part(p.id).slot === filter);
  const grouped = {};
  inv.forEach((p) => { (grouped[p.id] ??= []).push(p); });

  // Panel izquierdo: inventario
  const left = h('div.bench-panel.left', {},
    h('h3', {}, '🧰 Tus piezas'),
    h('div.subtabs', {}, [['all', 'Todo'], ...SLOT_ORDER.map((s) => [s, SLOT_ICONS[s]])].map(([k, n]) => h('button.chip', { class: filter === k ? 'sel' : '', title: SLOT_NAMES[k] || 'Todo', onclick: () => { filter = k; render(); } }, n))),
    Object.keys(grouped).length ? h('div.part-list', {}, Object.entries(grouped).map(([id, list]) => {
      const p = part(id);
      const reason = installBlock(p);
      return h('div.part-item', { class: reason ? 'blocked' : '' },
        h('div.pi-icon', {}, SLOT_ICONS[p.slot]),
        h('div.pi-txt', {}, h('b', {}, `${p.name}${list.length > 1 ? ` x${list.length}` : ''}`), h('small', {}, partDesc(p)), reason ? h('small.warn', {}, reason) : null),
        btn('Instalar', () => install(list[0]), '', !!reason));
    })) : h('p.muted', {}, 'No tienes piezas. Cómpralas en TecnoMarket (PC) o en PC Zone (calle).'),
  );

  // Panel derecho: estado del banco
  const chk = checkBuild(bench.parts, bench.paste, {});
  const sc = pcScore(bench.parts);
  const right = h('div.bench-panel.right', {},
    h('h3', {}, '🛠️ PC en el banco'),
    j ? h('div.job-banner', {}, j.type === 'build'
      ? `🧩 Pedido de ${j.client}: rendimiento ${j.minScore}+${j.req.glass ? ' · vidrio' : ''}${j.req.nvme ? ' · NVMe' : ''}${j.req.ram32 ? ' · 32GB RAM' : ''} · Paga ${fmtMoney(j.pay)}`
      : `🩺 Reparación de ${j.client}: "${j.symptom}" · Paga ${fmtMoney(j.pay)} + piezas`) : null,
    h('div.slot-list', {}, SLOT_ORDER.map((s) => {
      const id = bench.parts[s];
      const p = part(id);
      const diag = bench.diag?.[s];
      return h('div.slot', { class: p ? 'filled' : '' },
        h('div.pi-icon', {}, SLOT_ICONS[s]),
        h('div.pi-txt', {}, h('small', {}, SLOT_NAMES[s]), h('b', {}, p ? p.name : '— vacío —'), diag ? h('small', { class: diag === 'bad' ? 'bad' : 'ok' }, diag === 'bad' ? '❌ Dañada' : '✅ Funciona') : null),
        p && j?.type === 'repair' && !diag ? btn('🔍', () => diagnose(s), 'sm') : null,
        p ? btn('✕', () => remove(s), 'sm') : null,
      );
    })),
    bench.parts.cpu && !bench.parts.cooler ? h('div.row', {}, btn(bench.paste ? '✅ Pasta térmica aplicada' : '🧴 Aplicar pasta térmica', () => { bench.paste = true; sfx.install(); addXP('hardware', 2); onChange?.(); render(); }, bench.paste ? 'good' : '', bench.paste)) : null,
    h('div.kv', {}, h('span', {}, 'Rendimiento estimado'), h('b', {}, sc || '—')),
    bench.parts.cpu && bench.parts.gpu ? h('div.kv', {}, h('span', {}, 'Consumo'), h('b', {}, `${powerDraw(bench.parts)}W`)) : null,
    bench.parts.cpu && bench.parts.cooler ? h('div.kv', {}, h('span', {}, 'Temp. a carga'), h('b', {}, `${cpuTemp(bench.parts, bench.paste, 0, 0.8)}°C`)) : null,
    h('div.issues', {}, chk.errors.map((e) => h('div.bad', {}, '⛔ ' + e)), chk.warnings.map((w) => h('div.warn', {}, '⚠️ ' + w))),
    h('div.bench-actions', {},
      btn('⚡ Encender / Probar', () => testPC(), 'good', !Object.keys(bench.parts).length),
      j ? btn('📦 Entregar al cliente', () => deliver(), 'big') : null,
      !j && chk.ok ? btn('🖥️ Instalar en mi escritorio', () => installOnDesk()) : null,
      !j ? btn('📋 Trabajar en un pedido', () => pickJob()) : null,
      !j && !Object.keys(bench.parts).length ? btn('🔧 Desmontar mi PC al banco', () => pcToBench()) : null,
      !j && Object.keys(bench.parts).length ? btn('🧹 Guardar todas las piezas', () => clearBench()) : null,
      j ? btn('↩️ Dejar este pedido', () => leaveJob()) : null,
    ),
    h('div.muted', {}, `Habilidad Hardware: Nv ${skill('hardware')} · Orden: gabinete → placa → CPU → pasta → disipador → RAM → GPU → disco → fuente`),
    btn('← Volver', () => closeBench()),
  );
  el.append(left, right);
}

function installBlock(p) {
  const bench = B();
  if (bench.parts[p.slot]) return `Ya hay ${SLOT_NAMES[p.slot].toLowerCase()} instalado`;
  const req = REQUIRES[p.slot];
  if (req && !bench.parts[req]) return `Primero instala: ${SLOT_NAMES[req]}`;
  if (p.slot === 'storage' && p.type === 'NVMe' && !bench.parts.mb) return 'El NVMe va en la placa base';
  if (p.slot === 'cpu' && part(bench.parts.mb)?.socket !== p.socket) return `Socket ${p.socket} ≠ placa ${part(bench.parts.mb)?.socket}`;
  if (p.slot === 'ram' && part(bench.parts.mb)?.ramType !== p.type) return `RAM ${p.type} ≠ placa ${part(bench.parts.mb)?.ramType}`;
  if (p.slot === 'mb') for (const s of ['cpu', 'ram']) if (bench.parts[s]) return 'Quita primero CPU/RAM';
  return null;
}

function install(inv) {
  const p = part(inv.id);
  const bench = B();
  if (installBlock(p)) return;
  if (p.slot === 'cooler' && !bench.paste) notify('⚠️ Instalaste el disipador sin pasta térmica', 'bad');
  S.inventory.parts = S.inventory.parts.filter((x) => x.uid !== inv.uid);
  bench.parts[p.slot] = p.id;
  bench.tested = false;
  if (job()?.type === 'repair' && bench.broken?.[p.slot] === 'removed') { bench.broken[p.slot] = false; bench.refund = (bench.refund || 0) + p.price; }
  addXP('hardware', 3);
  sfx.install();
  tick(3);
  onChange?.(p.slot);
  render();
}

function remove(slot) {
  const bench = B();
  for (const d of DEPENDENTS[slot] || []) if (bench.parts[d] && !(slot === 'case' && d === 'storage' && part(bench.parts.storage)?.type === 'NVMe')) { notify(`Primero quita: ${SLOT_NAMES[d]}`, 'bad'); sfx.error(); return; }
  const id = bench.parts[slot];
  delete bench.parts[slot];
  bench.tested = false;
  if (slot === 'cpu') bench.paste = false;
  if (bench.broken?.[slot] === true) {
    bench.broken[slot] = 'removed';
    notify(`🗑️ Desechaste la pieza dañada (${part(id).name})`, 'info');
  } else {
    S.inventory.parts.push({ uid: uid('p'), id });
  }
  if (bench.diag) delete bench.diag[slot];
  sfx.install();
  tick(2);
  onChange?.();
  render();
}

async function diagnose(slot) {
  const bench = B();
  const mins = skill('hardware') >= 5 ? 8 : 15;
  await progressOverlay(`🔍 Probando ${SLOT_NAMES[slot]} con el multímetro...`, 1.2);
  tick(mins);
  bench.diag ??= {};
  bench.diag[slot] = bench.broken?.[slot] === true ? 'bad' : 'ok';
  addXP('hardware', 4);
  bench.diag[slot] === 'bad' ? sfx.fail() : sfx.hit();
  render();
}

async function testPC() {
  const bench = B();
  await progressOverlay('⚡ Encendiendo...', 1.5);
  tick(5);
  const chk = checkBuild(bench.parts, bench.paste, bench.broken || {});
  const broken = Object.keys(bench.broken || {}).find((k) => bench.broken[k] === true && bench.parts[k]);
  let title, text, ok = false;
  if (!chk.ok) { title = '⛔ No enciende'; text = chk.errors.join('\n'); sfx.fail(); }
  else if (broken) { title = '❌ Falla detectada'; text = `Síntoma: "${job()?.symptom || 'algo anda mal'}"\nDiagnostica las piezas (🔍) para encontrar la dañada.`; sfx.fail(); }
  else {
    ok = true; sfx.boot();
    title = '✅ ¡POST correcto! Arranca el sistema';
    text = `Rendimiento: ${pcScore(bench.parts)}\nTemperatura a carga: ${cpuTemp(bench.parts, bench.paste, 0, 0.8)}°C${chk.warnings.length ? '\n\nAvisos:\n' + chk.warnings.join('\n') : ''}`;
    addXP('hardware', 5);
  }
  bench.tested = ok;
  modal({ title, content: h('pre.mail-body', {}, text), actions: [{ text: 'OK' }] });
  onChange?.('power');
  render();
}

function installOnDesk() {
  const bench = B();
  const chk = checkBuild(bench.parts, bench.paste);
  if (!chk.ok) return;
  modal({
    title: '🖥️ Instalar en tu escritorio',
    content: h('p', {}, `Tu PC actual (rendimiento ${pcScore(S.pc.parts)}) se desmontará y sus piezas irán a tu inventario. La nueva tiene rendimiento ${pcScore(bench.parts)}.`),
    actions: [{ text: 'Cancelar' }, {
      text: 'Instalar', cls: 'good', fn: () => {
        for (const [slot, id] of Object.entries(S.pc.parts)) if (id) S.inventory.parts.push({ uid: uid('p'), id });
        S.pc.parts = { ...bench.parts }; S.pc.paste = bench.paste; S.pc.dust = 0;
        bench.parts = {}; bench.paste = false;
        refreshDerived();
        notify(`🖥️ ¡Nueva PC instalada! Rendimiento ${S._pcScore}`, 'gold');
        sfx.levelup();
        bus.emit('pc');
        onChange?.();
        render();
      },
    }],
  });
}

function pcToBench() {
  modal({
    title: '🔧 Desmontar tu PC',
    content: h('p', {}, 'Llevarás tu PC al banco para mejorarla o cambiarle piezas. No podrás transmitir hasta volver a instalarla en el escritorio.'),
    actions: [{ text: 'Cancelar' }, {
      text: 'Desmontar', fn: () => {
        B().parts = { ...S.pc.parts }; B().paste = S.pc.paste;
        S.pc.parts = {};
        bus.emit('pc'); onChange?.(); render();
      },
    }],
  });
}

function clearBench() {
  const bench = B();
  for (const id of Object.values(bench.parts)) S.inventory.parts.push({ uid: uid('p'), id });
  bench.parts = {}; bench.paste = false;
  onChange?.(); render();
}

async function pickJob() {
  const act = S.jobs.filter((j) => j.status === 'active');
  if (!act.length) { notify('No tienes pedidos activos. Acepta uno en el Correo de la PC.', 'bad'); return; }
  const id = await choose('📋 Elige un pedido', act.map((j) => ({
    value: j.id, icon: j.type === 'build' ? '🧩' : '🩺', label: `${j.client} · ${fmtMoney(j.pay)}`,
    sub: j.type === 'build' ? `Armar PC rendimiento ${j.minScore}+` : `Reparar: ${j.symptom}`,
    disabled: j.type === 'repair' && Object.keys(B().parts).length > 0,
  })), Object.keys(B().parts).length ? 'Para reparaciones el banco debe estar vacío. Para armados puedes usar las piezas que ya tienes en el banco.' : '');
  if (!id) return;
  const j = S.jobs.find((x) => x.id === id);
  const bench = B();
  bench.job = j.id;
  if (j.type === 'repair') {
    bench.parts = { ...j.parts }; bench.paste = true;
    bench.broken = { [j.broken]: true }; bench.diag = {}; bench.refund = 0;
    notify(`🩺 PC de ${j.client} en el banco. Síntoma: ${j.symptom}`, 'info');
  } else { bench.broken = {}; bench.diag = {}; }
  onChange?.(); render();
}

function leaveJob() {
  const bench = B(); const j = job();
  if (j?.type === 'repair') { j.parts = { ...bench.parts }; if (bench.broken?.[j.broken] === 'removed') j.parts[j.broken] = j.parts[j.broken] || null; bench.parts = {}; }
  bench.job = null; bench.broken = {}; bench.diag = {};
  onChange?.(); render();
}

function deliver() {
  const bench = B(); const j = job();
  if (!j) return;
  const chk = checkBuild(bench.parts, bench.paste, bench.broken || {});
  const sc = pcScore(bench.parts);
  const problems = [...chk.errors];
  if (!bench.tested) problems.push('Primero enciende y prueba la PC');
  if (chk.brokenSlots.length) problems.push('La PC todavía tiene una pieza dañada');
  if (sc < j.minScore) problems.push(`Rendimiento ${sc} < ${j.minScore} requerido`);
  if (j.type === 'build') {
    if (j.req.glass && !part(bench.parts.case)?.glass) problems.push('El cliente quería gabinete con vidrio');
    if (j.req.nvme && part(bench.parts.storage)?.type !== 'NVMe') problems.push('El cliente quería disco NVMe');
    if (j.req.ram32 && (part(bench.parts.ram)?.gb || 0) < 32) problems.push('El cliente quería 32GB de RAM');
  }
  if (problems.length) { modal({ title: '❌ El cliente no la acepta', content: h('pre.mail-body', {}, problems.join('\n')), actions: [{ text: 'OK' }] }); sfx.error(); return; }
  const warnPenalty = chk.warnings.length ? 0.85 : 1;
  const tip = Math.round(j.pay * (0.05 * skill('hardware')) * (sc > j.minScore + 10 ? 1.5 : 1));
  const total = Math.round(j.pay * warnPenalty) + tip + (j.type === 'repair' ? bench.refund || 0 : 0);
  addMoney(total, `Pedido de ${j.client}`);
  S.stats.earnedJobs += total;
  if (j.type === 'build') S.stats.pcsBuilt++; else S.stats.pcsRepaired++;
  addXP('hardware', 25);
  j.status = 'done';
  bench.parts = {}; bench.paste = false; bench.job = null; bench.broken = {}; bench.diag = {}; bench.tested = false; bench.refund = 0;
  sfx.money();
  modal({ title: '✅ ¡Cliente satisfecho!', content: h('p', {}, `${j.client} te pagó ${fmtMoney(total)}${tip ? ` (incluye ${fmtMoney(tip)} de propina)` : ''}${warnPenalty < 1 ? '. Descontó un poco por los avisos de temperatura/fuente.' : '.'}`), actions: [{ text: 'Genial', cls: 'good' }] });
  onChange?.(); render();
}

bus.on('inventory', () => render());
