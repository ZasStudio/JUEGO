// Modelo 3D de una PC a partir de sus piezas. Se usa en el escritorio y en el banco de trabajo.
import * as THREE from 'three';
import { part } from '../data/parts.js';
import { mat, box, cyl, glow } from './util.js';

// Posiciones (espacio local, caja de 1 de alto) de cada ranura para animaciones y selección.
export const SLOT_POS = {
  case: new THREE.Vector3(0, 0.5, 0),
  mb: new THREE.Vector3(-0.19, 0.64, -0.05),
  cpu: new THREE.Vector3(-0.17, 0.78, -0.1),
  cooler: new THREE.Vector3(-0.07, 0.78, -0.1),
  ram: new THREE.Vector3(-0.14, 0.78, 0.075),
  gpu: new THREE.Vector3(-0.1, 0.55, -0.05),
  storage: new THREE.Vector3(0, 0.08, 0.26),
  psu: new THREE.Vector3(0, 0.1, -0.26),
};
export const SLOT_SIZE = {
  case: [0.45, 1, 0.9], mb: [0.04, 0.66, 0.62], cpu: [0.06, 0.1, 0.1], cooler: [0.18, 0.2, 0.14],
  ram: [0.08, 0.2, 0.05], gpu: [0.16, 0.08, 0.55], storage: [0.3, 0.06, 0.2], psu: [0.38, 0.17, 0.3],
};

function fan(parent, x, y, z, r, rgbColor, axis = 'z') {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.12, 6, 20), rgbColor ? glow(rgbColor, 2) : mat('#222'));
  g.add(frame);
  const hub = cyl(r * 0.3, r * 0.3, 0.02, '#111', 0, 0, 0, g, 12); hub.rotation.x = Math.PI / 2;
  const blades = new THREE.Group(); g.add(blades);
  for (let i = 0; i < 7; i++) {
    const b = box(r * 0.75, r * 0.2, 0.005, mat(rgbColor ? '#dddddd' : '#333', { transparent: !!rgbColor, opacity: rgbColor ? 0.6 : 1 }), 0, 0, 0, blades);
    b.geometry.translate(r * 0.4, 0, 0);
    b.rotation.z = (i / 7) * Math.PI * 2; b.rotation.x = 0.3;
  }
  if (axis === 'x') g.rotation.y = Math.PI / 2;
  if (axis === 'y') g.rotation.x = Math.PI / 2;
  g.userData.blades = blades;
  return g;
}

/**
 * @param {object} parts ids por ranura
 * @param {object} opts {open:boolean, rgb:string, paste:boolean, powered:boolean}
 */
export function buildPCModel(parts, opts = {}) {
  const root = new THREE.Group();
  const meshes = {};
  const fans = [];
  const rgb = opts.rgb || '#8a2be2';
  const cs = part(parts.case);

  if (cs) {
    const g = new THREE.Group(); root.add(g); meshes.case = g;
    const shell = mat(cs.color, { roughness: 0.5, metalness: 0.3 });
    box(0.45, 0.03, 0.9, shell, 0, 0.015, 0, g); // piso
    box(0.45, 0.03, 0.9, shell, 0, 0.985, 0, g); // techo
    box(0.02, 1, 0.9, shell, -0.215, 0.5, 0, g); // lado trasero (donde va la placa)
    box(0.45, 1, 0.02, shell, 0, 0.5, -0.44, g); // trasera
    // frontal
    if (cs.style >= 2) {
      box(0.45, 1, 0.02, mat(cs.color, { roughness: 0.3 }), 0, 0.5, 0.44, g);
      if (cs.rgb) box(0.012, 0.9, 0.01, glow(rgb, 2.5), 0.2, 0.5, 0.452, g);
    } else {
      box(0.45, 1, 0.02, mat(cs.style === 1 && cs.id === 'case_office' ? '#1a1a1a' : cs.color, { roughness: 0.6 }), 0, 0.5, 0.44, g);
    }
    // Ventiladores frontales
    if (cs.rgb) {
      for (let i = 0; i < 3; i++) fans.push(fan(g, 0, 0.25 + i * 0.25, 0.42, 0.09, rgb));
    } else {
      fans.push(fan(g, 0, 0.35, 0.42, 0.09, null));
    }
    fans.push(fan(g, 0, 0.8, -0.42, 0.08, cs.rgb ? rgb : null));
    // PSU shroud
    box(0.43, 0.02, 0.9, mat(cs.color, { roughness: 0.6 }), 0, 0.2, 0, g).visible = cs.style >= 1 && cs.id !== 'case_office';
    // Panel lateral
    if (!opts.open) {
      if (cs.glass) {
        const glass = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.96, 0.86), new THREE.MeshPhysicalMaterial({ color: '#223344', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1 }));
        glass.position.set(0.22, 0.5, 0); g.add(glass);
        if (cs.style === 3) { // acuario: frente de vidrio
          g.children.forEach((c) => { if (Math.abs(c.position.z - 0.44) < 0.01 && c.geometry?.parameters?.height === 1) c.visible = false; });
          const fg = glass.clone(); fg.rotation.y = Math.PI / 2; fg.position.set(0, 0.5, 0.44); fg.scale.z = 0.52; g.add(fg);
        }
      } else {
        box(0.01, 0.96, 0.86, shell, 0.22, 0.5, 0, g);
        for (let i = 0; i < 6; i++) box(0.012, 0.01, 0.3, mat('#0a0a0a'), 0.222, 0.6 + i * 0.03, 0.1, g);
      }
    }
    // Botón de encendido
    box(0.04, 0.012, 0.04, opts.powered ? glow('#4dd2ff', 3) : mat('#555'), 0.1, 1.0, 0.35, g);
  }

  const mb = part(parts.mb);
  if (mb) {
    const g = new THREE.Group(); root.add(g); meshes.mb = g;
    const h = mb.form === 'ATX' ? 0.66 : 0.52;
    box(0.02, h, 0.62, mat(mb.color, { roughness: 0.6, metalness: 0.2 }), -0.19, 0.97 - h / 2 - 0.02, -0.05, g);
    // Detalles: socket, slots, disipadores VRM
    box(0.012, 0.12, 0.12, mat('#9a9a9a', { metalness: 0.7, roughness: 0.3 }), -0.178, 0.78, -0.1, g);
    box(0.03, 0.05, 0.2, mat('#333', { metalness: 0.6 }), -0.17, 0.9, -0.15, g);
    for (let i = 0; i < 4; i++) box(0.012, 0.2, 0.008, mat('#222'), -0.175, 0.78, 0.06 + i * 0.022, g);
    box(0.012, 0.012, 0.4, mat('#444'), -0.175, 0.55, -0.1, g);
    box(0.012, 0.012, 0.4, mat('#444'), -0.175, 0.45, -0.1, g);
    if (mb.rgb) box(0.01, 0.2, 0.01, glow(rgb, 2), -0.17, 0.62, 0.2, g);
  }

  const cpu = part(parts.cpu);
  if (cpu) {
    const g = new THREE.Group(); root.add(g); meshes.cpu = g;
    box(0.012, 0.08, 0.08, mat('#c9b27c', { metalness: 0.8, roughness: 0.25 }), -0.168, 0.78, -0.1, g);
    if (opts.paste) {
      const p = cyl(0.025, 0.025, 0.004, mat('#bfc4c9', { roughness: 0.9 }), -0.16, 0.78, -0.1, g, 12);
      p.rotation.z = Math.PI / 2;
    }
  }

  const cool = part(parts.cooler);
  if (cool) {
    const g = new THREE.Group(); root.add(g); meshes.cooler = g;
    if (cool.type === 'aio') {
      const pump = cyl(0.04, 0.04, 0.05, mat('#111'), -0.14, 0.78, -0.1, g, 20); pump.rotation.z = Math.PI / 2;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 6, 20), glow(rgb, 3)); ring.rotation.y = Math.PI / 2; ring.position.set(-0.114, 0.78, -0.1); g.add(ring);
      const rl = cool.capacity > 300 ? 0.62 : 0.44;
      box(0.12, 0.03, rl, mat('#151515'), -0.02, 0.95, -0.05, g);
      for (let i = 0; i < (rl > 0.5 ? 3 : 2); i++) fans.push(fan(g, -0.02, 0.925, -0.05 - rl / 2 + 0.1 + i * 0.2, 0.08, cool.rgb ? rgb : null, 'y'));
      // mangueras
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.12, 0.8, -0.08), new THREE.Vector3(-0.05, 0.88, -0.02), new THREE.Vector3(-0.02, 0.93, 0.05)]), 12, 0.012, 6), mat('#111'));
      g.add(tube);
    } else {
      const tall = cool.capacity >= 150;
      const sz = tall ? [0.14, 0.16, 0.08] : [0.05, 0.1, 0.1];
      const fins = new THREE.Group(); g.add(fins);
      const n = tall ? 14 : 6;
      for (let i = 0; i < n; i++) box(sz[0], 0.004, sz[2], mat('#b8bcc2', { metalness: 0.8, roughness: 0.3 }), -0.16 + sz[0] / 2 + 0.01, 0.78 - sz[1] / 2 + (i / n) * sz[1], -0.1, fins);
      if (tall) {
        for (let i = 0; i < 4; i++) cyl(0.005, 0.005, 0.18, mat('#b87333', { metalness: 0.9, roughness: 0.2 }), -0.1, 0.78, -0.13 + i * 0.02, g, 6).rotation.z = Math.PI / 2;
        fans.push(fan(g, -0.09, 0.78, -0.03, 0.07, cool.rgb ? rgb : null));
      } else {
        fans.push(fan(g, -0.1, 0.78, -0.1, 0.045, null, 'x'));
      }
    }
  }

  const ram = part(parts.ram);
  if (ram) {
    const g = new THREE.Group(); root.add(g); meshes.ram = g;
    const n = ram.gb >= 32 ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const z = 0.06 + i * 0.022;
      box(0.05, 0.19, 0.008, mat('#1c1c1c', { metalness: 0.5 }), -0.15, 0.78, z, g);
      if (ram.rgb) box(0.01, 0.19, 0.009, glow(rgb, 2.5), -0.12, 0.78, z, g);
    }
  }

  const gpu = part(parts.gpu);
  if (gpu) {
    const g = new THREE.Group(); root.add(g); meshes.gpu = g;
    const len = 0.6 * gpu.len;
    const thick = gpu.score > 60 ? 0.07 : 0.045;
    box(0.14, thick, len, mat('#1a1a1d', { metalness: 0.5, roughness: 0.4 }), -0.1, 0.55, -0.4 + len / 2, g);
    box(0.14, 0.004, len, mat('#2c2c33', { metalness: 0.7 }), -0.1, 0.55 + thick / 2, -0.4 + len / 2, g);
    const nf = gpu.score > 40 ? 3 : (gpu.score > 20 ? 2 : 1);
    for (let i = 0; i < nf; i++) fans.push(fan(g, -0.1, 0.55 - thick / 2 - 0.003, -0.4 + len * ((i + 0.5) / nf), Math.min(0.055, len / (nf * 2.3)), null, 'y'));
    if (gpu.rgb) box(0.004, 0.012, len * 0.8, glow(rgb, 3), -0.028, 0.55, -0.4 + len / 2, g);
    // Soporte PCIe
    box(0.02, 0.1, 0.02, mat('#999', { metalness: 0.8 }), -0.17, 0.53, -0.42, g);
  }

  const st = part(parts.storage);
  if (st) {
    const g = new THREE.Group(); root.add(g); meshes.storage = g;
    if (st.type === 'NVMe') {
      box(0.006, 0.02, 0.1, mat('#0b3d0b'), -0.176, 0.62, 0.02, g);
      box(0.004, 0.022, 0.07, mat('#111', { metalness: 0.6 }), -0.172, 0.62, 0.02, g);
    } else {
      box(0.25, 0.04, 0.15, mat(st.type === 'HDD' ? '#8c8c8c' : '#222', { metalness: 0.6, roughness: 0.35 }), 0.02, 0.07, 0.25, g);
      if (st.type === 'SSD') box(0.1, 0.002, 0.08, mat('#e33'), 0.02, 0.092, 0.25, g);
    }
  }

  const psu = part(parts.psu);
  if (psu) {
    const g = new THREE.Group(); root.add(g); meshes.psu = g;
    box(0.36, 0.16, 0.3, mat('#111', { metalness: 0.4, roughness: 0.5 }), 0, 0.1, -0.26, g);
    box(0.002, 0.08, 0.14, mat(psu.watts >= 850 ? '#d4af37' : '#666'), 0.181, 0.1, -0.26, g);
    // Cables
    if (mb) {
      const c = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.05, 0.18, -0.2), new THREE.Vector3(0.05, 0.4, 0.2), new THREE.Vector3(-0.15, 0.7, 0.25)]), 16, 0.012, 6), mat('#111'));
      g.add(c);
    }
  }

  // Luz interior
  if (cs?.rgb && opts.powered !== false) {
    const l = new THREE.PointLight(rgb, 0.6, 1.2, 2); l.position.set(0, 0.5, 0.1); root.add(l);
  }

  root.userData.fans = fans;
  root.userData.meshes = meshes;
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return root;
}

export function spinFans(model, dt, speed = 20) {
  for (const f of model.userData.fans || []) f.userData.blades.rotation.z += dt * speed;
}
