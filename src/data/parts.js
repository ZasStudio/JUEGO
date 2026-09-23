// Catálogo de componentes de PC y lógica de compatibilidad / rendimiento.

export const SLOT_ORDER = ['case', 'mb', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'psu'];
export const SLOT_NAMES = {
  case: 'Gabinete', mb: 'Placa base', cpu: 'Procesador', cooler: 'Disipador', ram: 'Memoria RAM',
  gpu: 'Tarjeta gráfica', storage: 'Almacenamiento', psu: 'Fuente de poder',
};
export const SLOT_ICONS = { case: '🗄️', mb: '🟩', cpu: '🔲', cooler: '🌀', ram: '📏', gpu: '🎴', storage: '💾', psu: '🔌' };

const P = [];
const add = (slot, list) => list.forEach((p) => P.push({ slot, ...p }));

add('cpu', [
  { id: 'cpu_a3', name: 'Ryzo 3 3100', socket: 'AM4', cores: 4, score: 30, tdp: 65, price: 90 },
  { id: 'cpu_i3', name: 'Intello i3-12100F', socket: 'LGA1700', cores: 4, score: 38, tdp: 60, price: 110 },
  { id: 'cpu_a5', name: 'Ryzo 5 5600', socket: 'AM4', cores: 6, score: 55, tdp: 65, price: 140 },
  { id: 'cpu_i5', name: 'Intello i5-13400F', socket: 'LGA1700', cores: 10, score: 62, tdp: 65, price: 200 },
  { id: 'cpu_a7', name: 'Ryzo 7 7700X', socket: 'AM5', cores: 8, score: 78, tdp: 105, price: 320 },
  { id: 'cpu_i7', name: 'Intello i7-14700K', socket: 'LGA1700', cores: 20, score: 86, tdp: 125, price: 400 },
  { id: 'cpu_i9', name: 'Intello i9-14900K', socket: 'LGA1700', cores: 24, score: 94, tdp: 150, price: 580 },
  { id: 'cpu_a9', name: 'Ryzo 9 7950X3D', socket: 'AM5', cores: 16, score: 99, tdp: 120, price: 650 },
]);
add('gpu', [
  { id: 'gpu_1', name: 'GeFuerza GT 1030', score: 12, tdp: 30, price: 80, len: 0.6 },
  { id: 'gpu_2', name: 'Radeo RX 6500', score: 28, tdp: 107, price: 160, len: 0.7 },
  { id: 'gpu_3', name: 'GeFuerza RTX 3060', score: 48, tdp: 170, price: 290, len: 0.85, rgb: true },
  { id: 'gpu_4', name: 'Radeo RX 7700 XT', score: 62, tdp: 245, price: 420, len: 0.9, rgb: true },
  { id: 'gpu_5', name: 'GeFuerza RTX 4070 Super', score: 75, tdp: 220, price: 600, len: 0.95, rgb: true },
  { id: 'gpu_6', name: 'Radeo RX 7900 XTX', score: 87, tdp: 355, price: 900, len: 1.0, rgb: true },
  { id: 'gpu_7', name: 'GeFuerza RTX 5090', score: 100, tdp: 575, price: 1999, len: 1.0, rgb: true },
]);
add('ram', [
  { id: 'ram_1', name: '8GB DDR4 2666', type: 'DDR4', gb: 8, score: 20, price: 25 },
  { id: 'ram_2', name: '16GB DDR4 3200', type: 'DDR4', gb: 16, score: 45, price: 45 },
  { id: 'ram_3', name: '32GB DDR4 3600 RGB', type: 'DDR4', gb: 32, score: 65, price: 85, rgb: true },
  { id: 'ram_4', name: '16GB DDR5 5600', type: 'DDR5', gb: 16, score: 60, price: 70 },
  { id: 'ram_5', name: '32GB DDR5 6000 RGB', type: 'DDR5', gb: 32, score: 82, price: 120, rgb: true },
  { id: 'ram_6', name: '64GB DDR5 6400 RGB', type: 'DDR5', gb: 64, score: 98, price: 240, rgb: true },
]);
add('mb', [
  { id: 'mb_1', name: 'A320M Básica', socket: 'AM4', ramType: 'DDR4', form: 'mATX', price: 55, color: '#1d3b1d' },
  { id: 'mb_3', name: 'H610M Office', socket: 'LGA1700', ramType: 'DDR4', form: 'mATX', price: 80, color: '#1b2a3a' },
  { id: 'mb_2', name: 'B550 Gamer', socket: 'AM4', ramType: 'DDR4', form: 'ATX', price: 120, color: '#222222' },
  { id: 'mb_7', name: 'B760M DDR5', socket: 'LGA1700', ramType: 'DDR5', form: 'mATX', price: 140, color: '#2a2a33' },
  { id: 'mb_5', name: 'B650 Tomahawk', socket: 'AM5', ramType: 'DDR5', form: 'ATX', price: 190, color: '#1a1a1a' },
  { id: 'mb_4', name: 'Z790 Aurora', socket: 'LGA1700', ramType: 'DDR5', form: 'ATX', price: 260, color: '#111418', rgb: true },
  { id: 'mb_6', name: 'X670E Extreme', socket: 'AM5', ramType: 'DDR5', form: 'ATX', price: 420, color: '#0e0e10', rgb: true },
]);
add('storage', [
  { id: 'st_1', name: 'HDD 500GB 5400rpm', type: 'HDD', gb: 500, score: 15, price: 30 },
  { id: 'st_2', name: 'SSD SATA 480GB', type: 'SSD', gb: 480, score: 45, price: 40 },
  { id: 'st_3', name: 'NVMe 1TB Gen3', type: 'NVMe', gb: 1000, score: 75, price: 70 },
  { id: 'st_4', name: 'NVMe 2TB Gen4', type: 'NVMe', gb: 2000, score: 92, price: 140 },
  { id: 'st_5', name: 'NVMe 4TB Gen5', type: 'NVMe', gb: 4000, score: 100, price: 320 },
]);
add('psu', [
  { id: 'psu_1', name: 'Fuente Genérica 400W', watts: 400, cert: 'Ninguna', price: 35 },
  { id: 'psu_2', name: 'Fuente 550W Bronze', watts: 550, cert: 'Bronze', price: 55 },
  { id: 'psu_3', name: 'Fuente 650W Gold', watts: 650, cert: 'Gold', price: 85 },
  { id: 'psu_4', name: 'Fuente 850W Gold', watts: 850, cert: 'Gold', price: 130 },
  { id: 'psu_5', name: 'Fuente 1000W Platinum', watts: 1000, cert: 'Platinum', price: 210 },
  { id: 'psu_6', name: 'Fuente 1300W Titanium', watts: 1300, cert: 'Titanium', price: 320 },
]);
add('cooler', [
  { id: 'cool_1', name: 'Disipador de stock', capacity: 70, type: 'air', price: 15 },
  { id: 'cool_2', name: 'Torre 4 heatpipes', capacity: 150, type: 'air', price: 35 },
  { id: 'cool_3', name: 'Torre doble RGB', capacity: 210, type: 'air', price: 75, rgb: true },
  { id: 'cool_4', name: 'Líquida AIO 240mm', capacity: 250, type: 'aio', price: 110, rgb: true },
  { id: 'cool_5', name: 'Líquida AIO 360mm RGB', capacity: 330, type: 'aio', price: 170, rgb: true },
]);
add('case', [
  { id: 'case_office', name: 'Gabinete Oficina', color: '#2b2b2b', glass: false, rgb: false, price: 40, style: 1 },
  { id: 'case_gamer', name: 'Gabinete Gamer Vidrio', color: '#161616', glass: true, rgb: true, price: 80, style: 1 },
  { id: 'case_white', name: 'Gabinete Blanco Air', color: '#e8e8ec', glass: true, rgb: true, price: 110, style: 1 },
  { id: 'case_pro', name: 'Gabinete Pro RGB', color: '#0b0b10', glass: true, rgb: true, price: 160, style: 2 },
  { id: 'case_aqua', name: 'Gabinete Acuario', color: '#f4f4f8', glass: true, rgb: true, price: 190, style: 3 },
]);

export const PARTS = Object.fromEntries(P.map((p) => [p.id, p]));
export const partsBySlot = (slot) => P.filter((p) => p.slot === slot);
export const part = (id) => PARTS[id];

// Consumo estimado del equipo
export function powerDraw(parts) {
  const c = part(parts.cpu), g = part(parts.gpu);
  return (c?.tdp || 0) + (g?.tdp || 0) + 80;
}

// Puntaje de rendimiento (0-100) de un conjunto de piezas
export function pcScore(parts) {
  const c = part(parts.cpu), g = part(parts.gpu), r = part(parts.ram), s = part(parts.storage);
  if (!c || !g || !r || !s) return 0;
  let raw = g.score * 0.45 + c.score * 0.33 + r.score * 0.12 + s.score * 0.1;
  const gap = Math.abs(g.score - c.score);
  if (gap > 35) raw *= 0.88; // cuello de botella
  else if (gap > 20) raw *= 0.95;
  return Math.round(Math.min(100, raw));
}

// Capacidad de codificación para transmitir
export function encodeScore(parts) {
  const c = part(parts.cpu), g = part(parts.gpu);
  if (!c || !g) return 0;
  const hwEnc = g.score >= 40 ? g.score * 0.6 : 0; // encoder por hardware
  return Math.round(Math.max(c.score * 0.9, hwEnc + c.score * 0.3));
}

// Revisión de compatibilidad. Devuelve {ok, errors[], warnings[]}
export function checkBuild(parts, paste = true, broken = {}) {
  const errors = [], warnings = [];
  for (const slot of SLOT_ORDER) if (!parts[slot]) errors.push(`Falta: ${SLOT_NAMES[slot]}`);
  const mb = part(parts.mb), cpu = part(parts.cpu), ram = part(parts.ram), psu = part(parts.psu), cool = part(parts.cooler);
  if (mb && cpu && mb.socket !== cpu.socket) errors.push(`El socket del CPU (${cpu.socket}) no coincide con la placa (${mb.socket})`);
  if (mb && ram && mb.ramType !== ram.type) errors.push(`La placa usa ${mb.ramType} y la RAM es ${ram.type}`);
  if (psu && parts.cpu && parts.gpu) {
    const need = Math.round(powerDraw(parts) * 1.2);
    if (psu.watts < powerDraw(parts)) errors.push(`La fuente (${psu.watts}W) no alcanza: el equipo consume ~${powerDraw(parts)}W`);
    else if (psu.watts < need) warnings.push(`Fuente muy justa: recomendado ${need}W`);
  }
  if (cool && cpu && cool.capacity < cpu.tdp) warnings.push(`El disipador (${cool.capacity}W) es débil para el CPU (${cpu.tdp}W): se calentará`);
  if (!paste && parts.cpu && parts.cooler) warnings.push('No aplicaste pasta térmica: temperaturas altas');
  const brokenSlots = Object.keys(broken).filter((k) => broken[k] && parts[k]);
  return { ok: errors.length === 0, errors, warnings, brokenSlots };
}

// Temperatura del CPU bajo carga (0..1 carga)
export function cpuTemp(parts, paste, dust = 0, load = 1) {
  const cpu = part(parts.cpu), cool = part(parts.cooler);
  if (!cpu || !cool) return 99;
  let ratio = (cpu.tdp * load) / cool.capacity;
  if (!paste) ratio *= 1.6;
  return Math.round(32 + 48 * ratio + dust * 0.22);
}

export function buildValue(parts) {
  return Object.values(parts).reduce((a, id) => a + (part(id)?.price || 0), 0);
}

export function partDesc(p) {
  switch (p.slot) {
    case 'cpu': return `${p.socket} · ${p.cores} núcleos · ${p.tdp}W · Rend. ${p.score}`;
    case 'gpu': return `${p.tdp}W · Rend. ${p.score}${p.score >= 40 ? ' · Encoder HW' : ''}`;
    case 'ram': return `${p.type} · ${p.gb}GB · Rend. ${p.score}`;
    case 'mb': return `${p.socket} · ${p.ramType} · ${p.form}`;
    case 'storage': return `${p.type} · ${p.gb >= 1000 ? p.gb / 1000 + 'TB' : p.gb + 'GB'} · Rend. ${p.score}`;
    case 'psu': return `${p.watts}W · 80+ ${p.cert}`;
    case 'cooler': return `Soporta ${p.capacity}W · ${p.type === 'aio' ? 'Líquida' : 'Aire'}`;
    case 'case': return `${p.glass ? 'Vidrio templado' : 'Panel cerrado'}${p.rgb ? ' · RGB' : ''}`;
    default: return '';
  }
}
