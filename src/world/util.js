// Utilidades 3D: materiales, primitivas, texturas procedurales.
import * as THREE from 'three';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!opts.unique && matCache.has(key)) return matCache.get(key);
  const { unique, ...rest } = opts;
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...rest });
  if (!opts.unique) matCache.set(key, m);
  return m;
}
export function glow(color, intensity = 1.5) {
  return new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity, roughness: 0.5 });
}

export function box(w, h, d, material, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof material === 'string' || typeof material === 'number' ? mat(material) : material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
export function cyl(rt, rb, h, material, x = 0, y = 0, z = 0, parent, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof material === 'string' || typeof material === 'number' ? mat(material) : material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
export function sphere(r, material, x = 0, y = 0, z = 0, parent, seg = 16) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75)), typeof material === 'string' || typeof material === 'number' ? mat(material) : material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
// Caja redondeada simple (bordes biselados) usando RoundedBox casero por escalado de esfera no es trivial; usamos capsula para brazos.
export function capsule(r, len, material, parent) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), typeof material === 'string' ? mat(material) : material);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function woodTex() {
  const t = canvasTex(512, 512, (g, w, h) => {
    const rows = 8;
    for (let i = 0; i < rows; i++) {
      const y = (i * h) / rows;
      const off = (i % 2) * 180 + Math.random() * 60;
      for (let x = -off; x < w; x += 300) {
        const base = 120 + Math.random() * 30;
        g.fillStyle = `rgb(${base + 40},${base - 5},${base - 50})`;
        g.fillRect(x, y, 300, h / rows);
        for (let k = 0; k < 18; k++) {
          g.strokeStyle = `rgba(80,45,20,${0.05 + Math.random() * 0.1})`;
          g.beginPath();
          const yy = y + Math.random() * (h / rows);
          g.moveTo(x, yy); g.bezierCurveTo(x + 100, yy + 3, x + 200, yy - 3, x + 300, yy);
          g.stroke();
        }
        g.fillStyle = 'rgba(40,20,5,0.5)';
        g.fillRect(x, y, 2, h / rows);
      }
      g.fillStyle = 'rgba(40,20,5,0.6)';
      g.fillRect(0, y, w, 2);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export function tileTex(c1 = '#e9eef2', c2 = '#cfd8df', n = 8) {
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = c2; g.fillRect(0, 0, w, h);
    const s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = c1; g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export function noiseTex(base = '#888', amt = 20, size = 256) {
  const t = canvasTex(size, size, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * amt;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Cartel con texto (para tiendas, neón, etc.)
export function textPlane(text, { w = 2, h = 0.5, bg = '#111', fg = '#fff', font = 'bold 64px sans-serif', emissive = false, px = 512 } = {}) {
  const ratio = w / h;
  const cw = px, ch = Math.round(px / ratio);
  const tex = canvasTex(cw, ch, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, cw, ch); } else g.clearRect(0, 0, cw, ch);
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (emissive) { g.shadowColor = fg; g.shadowBlur = 18; }
    let size = parseInt(font.match(/(\d+)px/)[1], 10);
    while (g.measureText(text).width > cw * 0.9 && size > 10) { size -= 2; g.font = font.replace(/\d+px/, size + 'px'); }
    g.fillText(text, cw / 2, ch / 2);
  });
  const m = emissive
    ? new THREE.MeshBasicMaterial({ map: tex, transparent: !bg, toneMapped: false })
    : new THREE.MeshStandardMaterial({ map: tex, transparent: !bg, roughness: 0.8 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  return mesh;
}

// Colisionadores AABB en el plano XZ
export function aabb(minX, minZ, maxX, maxZ) { return { minX, minZ, maxX, maxZ }; }
export function aabbFromObject(obj, pad = 0) {
  const b = new THREE.Box3().setFromObject(obj);
  return aabb(b.min.x - pad, b.min.z - pad, b.max.x + pad, b.max.z + pad);
}

// Reescala las UV de una caja para que la textura se repita por metro (evita estiramientos).
export function worldUV(mesh, unit = 1) {
  const g = mesh.geometry;
  const { width: w, height: h, depth: d } = g.parameters;
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * dims[f][0] / unit, uv.getY(i) * dims[f][1] / unit);
  }
  uv.needsUpdate = true;
  return mesh;
}
