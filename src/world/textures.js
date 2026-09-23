// Texturas procedurales tipo PBR: color + mapa normal + rugosidad generados en canvas.
import * as THREE from 'three';

const cache = new Map();

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Ruido de valor suavizado (tileable) para variaciones orgánicas
function valueNoise(w, h, cell, seed = 1) {
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const grid = Array.from({ length: gh }, () => Array.from({ length: gw }, rnd));
  const out = new Float32Array(w * h);
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = x / cell, gy = y / cell;
    const x0 = Math.floor(gx) % gw, y0 = Math.floor(gy) % gh, x1 = (x0 + 1) % gw, y1 = (y0 + 1) % gh;
    const tx = sm(gx - Math.floor(gx)), ty = sm(gy - Math.floor(gy));
    const a = grid[y0][x0] + (grid[y0][x1] - grid[y0][x0]) * tx;
    const b = grid[y1][x0] + (grid[y1][x1] - grid[y1][x0]) * tx;
    out[y * w + x] = a + (b - a) * ty;
  }
  return out;
}
function fbm(w, h, base = 64, oct = 4, seed = 1) {
  const out = new Float32Array(w * h);
  let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const n = valueNoise(w, h, Math.max(2, base >> o), seed + o * 17);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

// Normal map a partir de un mapa de alturas (Sobel, con envoltura)
function normalFromHeight(hm, w, h, strength = 2) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const H = (x, y) => hm[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
    const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
    let nx = -dx * strength, ny = -dy * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
function grayCanvas(vals, w, h, map = (v) => v) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const img = g.createImageData(w, h);
  for (let i = 0; i < vals.length; i++) { const v = Math.max(0, Math.min(255, map(vals[i]) * 255)); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  return c;
}
function tex(canvas, srgb, repeat) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}
function hexToRgb(hex) { const c = new THREE.Color(hex); return [c.r * 255, c.g * 255, c.b * 255]; }

/**
 * Crea (o reutiliza) un material PBR procedural.
 * kind: wood | plaster | brick | asphalt | concrete | grass | fabric | marble | carpet | metal | tiles | darkwood | leather
 */
export function pbr(kind, opts = {}) {
  const { unique, ...keyOpts } = opts;
  const key = kind + JSON.stringify(keyOpts);
  if (cache.has(key)) return unique ? cache.get(key).clone() : cache.get(key);
  const S = opts.size || 512;
  const color = makeCanvas(S, S), g = color.getContext('2d');
  let height = new Float32Array(S * S);
  let rough = null;
  let params = { roughness: 0.8, metalness: 0, normalStrength: 1 };
  const base = opts.color;

  if (kind === 'wood' || kind === 'darkwood') {
    const rows = opts.rows || 6;
    const n = fbm(S, S, 32, 3, 3);
    const tones = kind === 'darkwood' ? [[92, 60, 38], [80, 50, 30], [104, 68, 42]] : [[176, 124, 78], [160, 110, 68], [188, 138, 90], [150, 102, 62]];
    const img = g.createImageData(S, S);
    const ph = S / rows;
    const plank = [];
    for (let r = 0; r < rows; r++) { const off = Math.random() * S; plank.push({ off, len: S * (0.45 + Math.random() * 0.55), tone: tones[r % tones.length], ph: Math.random() * 10 }); }
    for (let y = 0; y < S; y++) {
      const r = Math.floor(y / ph), p = plank[r];
      for (let x = 0; x < S; x++) {
        const lx = (x + p.off) % p.len;
        const seamX = lx < 2 || lx > p.len - 2;
        const seamY = (y % ph) < 2;
        const grain = Math.sin((y * 1.3 + Math.sin(x * 0.02 + p.ph) * 3 + n[y * S + x] * 7) * 0.9) * 0.5 + 0.5;
        const k = 0.86 + grain * 0.07 + n[y * S + x] * 0.1 + (Math.floor((x + p.off) / p.len) % 2) * 0.05;
        const i = (y * S + x) * 4;
        const dark = seamX || seamY ? 0.45 : 1;
        img.data[i] = p.tone[0] * k * dark; img.data[i + 1] = p.tone[1] * k * dark; img.data[i + 2] = p.tone[2] * k * dark; img.data[i + 3] = 255;
        height[y * S + x] = (seamX || seamY ? 0 : 0.6 + grain * 0.08);
      }
    }
    g.putImageData(img, 0, 0);
    rough = grayCanvas(n, S, S, (v) => 0.35 + v * 0.3);
    params = { roughness: 1, metalness: 0, normalStrength: 1.2 };
  } else if (kind === 'plaster') {
    const n = fbm(S, S, 64, 5, 7);
    const [r, gg, b] = hexToRgb(base || '#d9d4e7');
    const img = g.createImageData(S, S);
    for (let i = 0; i < S * S; i++) { const k = 0.93 + n[i] * 0.1; img.data[i * 4] = r * k; img.data[i * 4 + 1] = gg * k; img.data[i * 4 + 2] = b * k; img.data[i * 4 + 3] = 255; height[i] = n[i] * 0.4; }
    g.putImageData(img, 0, 0);
    params = { roughness: 0.92, normalStrength: 0.6 };
  } else if (kind === 'brick') {
    const [r, gg, b] = hexToRgb(base || '#a0522d');
    const n = fbm(S, S, 16, 3, 11);
    const bw = S / 4, bh = S / 12;
    g.fillStyle = '#bdb6aa'; g.fillRect(0, 0, S, S);
    const img = g.getImageData(0, 0, S, S);
    for (let y = 0; y < S; y++) {
      const row = Math.floor(y / bh); const off = (row % 2) * bw / 2;
      for (let x = 0; x < S; x++) {
        const lx = (x + off) % bw, ly = y % bh;
        const mortar = lx < 3 || ly < 3;
        const i = (y * S + x) * 4;
        if (mortar) { height[y * S + x] = 0.1 + n[y * S + x] * 0.05; continue; }
        const bi = Math.floor((x + off) / bw) * 31 + row * 7;
        const vary = 0.8 + ((bi * 9301 + 49297) % 233280) / 233280 * 0.3 + n[y * S + x] * 0.12;
        img.data[i] = r * vary; img.data[i + 1] = gg * vary; img.data[i + 2] = b * vary;
        height[y * S + x] = 0.7 + n[y * S + x] * 0.2;
      }
    }
    g.putImageData(img, 0, 0);
    params = { roughness: 0.95, normalStrength: 2.5 };
  } else if (kind === 'asphalt') {
    const n = fbm(S, S, 8, 4, 5);
    const img = g.createImageData(S, S);
    for (let i = 0; i < S * S; i++) { const sp = Math.random() < 0.04 ? 30 : 0; const v = 44 + n[i] * 26 + sp; img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v + 3; img.data[i * 4 + 3] = 255; height[i] = n[i] * 0.5 + (sp ? 0.2 : 0); }
    g.putImageData(img, 0, 0);
    // grietas
    g.strokeStyle = 'rgba(15,15,15,0.7)'; g.lineWidth = 1.2;
    for (let k = 0; k < 6; k++) { g.beginPath(); let x = Math.random() * S, y = Math.random() * S; g.moveTo(x, y); for (let j = 0; j < 12; j++) { x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
    rough = grayCanvas(n, S, S, (v) => 0.75 + v * 0.2);
    params = { roughness: 1, normalStrength: 1.5 };
  } else if (kind === 'concrete' || kind === 'tiles') {
    const n = fbm(S, S, 32, 4, 13);
    const tiles = opts.tiles || (kind === 'tiles' ? 8 : 4);
    const [r, gg, b] = hexToRgb(base || (kind === 'tiles' ? '#eef3f6' : '#a7a7ad'));
    const ts = S / tiles;
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const seam = (x % ts) < (kind === 'tiles' ? 3 : 2) || (y % ts) < (kind === 'tiles' ? 3 : 2);
      const i = (y * S + x) * 4;
      const k = seam ? (kind === 'tiles' ? 0.78 : 0.6) : 0.9 + n[y * S + x] * (kind === 'tiles' ? 0.08 : 0.2);
      img.data[i] = r * k; img.data[i + 1] = gg * k; img.data[i + 2] = b * k; img.data[i + 3] = 255;
      height[y * S + x] = seam ? 0 : 0.5 + n[y * S + x] * 0.1;
    }
    g.putImageData(img, 0, 0);
    params = kind === 'tiles' ? { roughness: 0.5, normalStrength: 1.5 } : { roughness: 0.9, normalStrength: 1.2 };
  } else if (kind === 'grass') {
    const n = fbm(S, S, 32, 4, 21);
    const img = g.createImageData(S, S);
    for (let i = 0; i < S * S; i++) { const bl = Math.random(); const k = 0.7 + n[i] * 0.4 + bl * 0.15; img.data[i * 4] = 62 * k; img.data[i * 4 + 1] = 118 * k; img.data[i * 4 + 2] = 48 * k; img.data[i * 4 + 3] = 255; height[i] = bl * 0.4 + n[i] * 0.3; }
    g.putImageData(img, 0, 0);
    params = { roughness: 1, normalStrength: 1.4 };
  } else if (kind === 'fabric' || kind === 'carpet') {
    const [r, gg, b] = hexToRgb(base || '#3b6978');
    const n = fbm(S, S, 16, 3, 31);
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const weave = kind === 'fabric' ? ((x % 4 < 2) !== (y % 4 < 2) ? 1 : 0.88) : 0.85 + Math.random() * 0.2;
      const k = weave * (0.9 + n[i] * 0.15);
      img.data[i * 4] = r * k; img.data[i * 4 + 1] = gg * k; img.data[i * 4 + 2] = b * k; img.data[i * 4 + 3] = 255;
      height[i] = weave * 0.5 + n[i] * 0.2;
    }
    g.putImageData(img, 0, 0);
    params = { roughness: 1, normalStrength: kind === 'fabric' ? 0.8 : 1.6 };
  } else if (kind === 'marble') {
    const n = fbm(S, S, 64, 5, 41);
    const [r, gg, b] = hexToRgb(base || '#f0ede6');
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const vein = Math.abs(Math.sin((x * 0.02 + y * 0.01 + n[i] * 6) * 2));
      const k = 0.86 + Math.pow(vein, 0.3) * 0.14;
      img.data[i * 4] = r * k; img.data[i * 4 + 1] = gg * k; img.data[i * 4 + 2] = b * k; img.data[i * 4 + 3] = 255;
      height[i] = n[i] * 0.1;
    }
    g.putImageData(img, 0, 0);
    params = { roughness: 0.18, normalStrength: 0.3 };
  } else if (kind === 'metal') {
    const [r, gg, b] = hexToRgb(base || '#9aa0a6');
    const img = g.createImageData(S, S);
    const line = Array.from({ length: S }, () => Math.random());
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = y * S + x; const k = 0.9 + line[y] * 0.12; img.data[i * 4] = r * k; img.data[i * 4 + 1] = gg * k; img.data[i * 4 + 2] = b * k; img.data[i * 4 + 3] = 255; height[i] = line[y] * 0.2; }
    g.putImageData(img, 0, 0);
    params = { roughness: 0.35, metalness: 0.85, normalStrength: 0.4 };
  } else if (kind === 'leather') {
    const [r, gg, b] = hexToRgb(base || '#2d2d33');
    const n = fbm(S, S, 6, 3, 51);
    const img = g.createImageData(S, S);
    for (let i = 0; i < S * S; i++) { const k = 0.85 + n[i] * 0.25; img.data[i * 4] = r * k; img.data[i * 4 + 1] = gg * k; img.data[i * 4 + 2] = b * k; img.data[i * 4 + 3] = 255; height[i] = n[i]; }
    g.putImageData(img, 0, 0);
    params = { roughness: 0.55, normalStrength: 1.5 };
  }

  const rep = opts.repeat || [1, 1];
  const map = tex(color, true, rep);
  const normalMap = tex(normalFromHeight(height, S, S, 3), false, rep);
  const m = new THREE.MeshStandardMaterial({
    map, normalMap, roughness: params.roughness, metalness: params.metalness || 0,
    normalScale: new THREE.Vector2(params.normalStrength, params.normalStrength),
  });
  if (rough) { m.roughnessMap = tex(rough, false, rep); }
  if (opts.transparent) { m.transparent = true; }
  cache.set(key, m);
  return opts.unique ? m.clone() : m;
}

// Ajusta la repetición de las texturas de un material clonado
export function withRepeat(material, rx, ry) {
  const m = material.clone();
  for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) { m[k] = m[k].clone(); m[k].repeat.set(rx, ry); m[k].needsUpdate = true; }
  return m;
}
