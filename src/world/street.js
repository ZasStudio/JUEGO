// Calle exterior con tiendas, parque, peatones y autos.
import * as THREE from 'three';
import { mat, glow, box, cyl, sphere, textPlane, aabb, noiseTex } from './util.js';
import { Character, randomLook } from './character.js';

export const STREET_ORIGIN = new THREE.Vector3(200, 0, 0);

export class Street {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.position.copy(STREET_ORIGIN);
    scene.add(this.group);
    this.colliders = [];
    this.interactables = [];
    this.npcs = [];
    this.cars = [];
    this.lampMats = [];
    this.build();
  }

  col(minX, minZ, maxX, maxZ) { const o = STREET_ORIGIN; this.colliders.push(aabb(minX + o.x, minZ + o.z, maxX + o.x, maxZ + o.z)); }
  int(id, x, z, label, r = 1.3) { this.interactables.push({ id, x: x + STREET_ORIGIN.x, z: z + STREET_ORIGIN.z, r, label }); }

  building(x, z, w, d, h, color, sign, signColor, id, label, facing = 1) {
    const G = this.group;
    const b = new THREE.Group(); b.position.set(x, 0, z); G.add(b);
    const wallM = new THREE.MeshStandardMaterial({ map: noiseTex(color, 18), roughness: 0.9 });
    box(w, h, d, wallM, 0, h / 2, 0, b);
    // Ventanas
    for (let fy = 1; fy < Math.floor(h / 3); fy++) {
      for (let wx = -w / 2 + 1.2; wx < w / 2 - 0.8; wx += 2) {
        const win = box(1.1, 1.3, 0.05, mat('#223', { roughness: 0.1, metalness: 0.6, emissive: '#ffcc77', emissiveIntensity: 0 }), wx, fy * 3 + 1.2, (d / 2 + 0.02) * facing, b);
        (this.winMats ??= []).push(win.material);
      }
    }
    // Planta baja: escaparate y puerta
    const front = (d / 2 + 0.03) * facing;
    box(w * 0.8, 2.2, 0.05, mat('#9fd3ff', { roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.6 }), 0, 1.4, front, b);
    box(1.4, 2.4, 0.08, mat('#333'), 0, 1.2, front + 0.02 * facing, b);
    // Toldo
    const aw = box(w * 0.85, 0.1, 1.4, mat(signColor), 0, 2.9, front + 0.7 * facing, b); aw.rotation.x = -0.25 * facing;
    // Letrero
    if (sign) {
      const s = textPlane(sign, { w: Math.min(w * 0.8, 7), h: 1, bg: '#111', fg: signColor, emissive: true, font: 'bold 80px sans-serif' });
      s.position.set(0, 3.7, front + 0.05 * facing); if (facing < 0) s.rotation.y = Math.PI; b.add(s);
    }
    this.col(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
    if (id) this.int(id, x, z + (d / 2 + 1.1) * facing, label, 1.4);
    return b;
  }

  build() {
    const G = this.group;
    // Suelo
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), new THREE.MeshStandardMaterial({ map: (() => { const t = noiseTex('#5a7f4a', 30); t.repeat.set(20, 10); return t; })(), roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; G.add(ground);
    // Carretera
    const road = new THREE.Mesh(new THREE.PlaneGeometry(100, 6), new THREE.MeshStandardMaterial({ map: (() => { const t = noiseTex('#2f3033', 25); t.repeat.set(30, 2); return t; })(), roughness: 0.95 }));
    road.rotation.x = -Math.PI / 2; road.position.y = 0.01; road.receiveShadow = true; G.add(road);
    for (let x = -48; x < 50; x += 4) { const l = box(2, 0.01, 0.15, mat('#f5f5f5'), x, 0.02, 0, G); l.castShadow = false; }
    // Aceras
    for (const z of [-4.5, 4.5]) { const s = box(100, 0.15, 3, mat('#9a9aa0', { roughness: 0.9 }), 0, 0.075, z, G); s.castShadow = false; }
    // Paso de cebra
    for (let i = 0; i < 6; i++) box(0.5, 0.012, 5.6, mat('#eee'), -6 + i * 0.9, 0.02, 0, G).castShadow = false;

    // Edificios lado norte (fachada hacia +z)
    this.building(0, -11, 10, 8, 12, '#b56b5b', 'RESIDENCIAL LUNA', '#ffd166', 'home', 'Entrar a casa');
    this.building(-14, -11, 12, 8, 7, '#e8e2d0', 'SUPERMERCADO', '#2ecc71', 'market', 'Supermercado (comida)');
    this.building(14, -11, 12, 8, 7, '#2d3142', 'PC ZONE', '#00e5ff', 'pcshop', 'PC Zone (hardware)');
    this.building(-28, -11, 10, 8, 9, '#c9ada7', 'CAFÉ BYTE', '#ff9f43', 'cafe', 'Café Byte');
    this.building(28, -11, 10, 8, 6, '#5b6c8f', 'GYM FIT', '#ff4757', 'gym', 'Gimnasio');
    // Lado sur: parque y edificios de fondo
    this.building(-30, 14, 14, 8, 15, '#7d8597', null, '#fff', null, null, -1);
    this.building(30, 14, 14, 8, 11, '#a3a380', null, '#fff', null, null, -1);
    this.building(-42, -11, 8, 8, 18, '#6c757d', null, '#fff');
    this.building(42, -11, 8, 8, 14, '#8d99ae', null, '#fff');

    // Parque
    const park = new THREE.Mesh(new THREE.PlaneGeometry(36, 12), mat('#4caf50', { roughness: 1 })); park.rotation.x = -Math.PI / 2; park.position.set(0, 0.02, 13); park.receiveShadow = true; G.add(park);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(2, 12), mat('#c2b280')); path.rotation.x = -Math.PI / 2; path.position.set(0, 0.03, 13); G.add(path);
    const fountain = new THREE.Group(); fountain.position.set(0, 0, 13); G.add(fountain);
    cyl(2, 2.1, 0.5, mat('#bbb'), 0, 0.25, 0, fountain, 24);
    const water = cyl(1.85, 1.85, 0.05, mat('#4fc3f7', { roughness: 0.05, metalness: 0.3, emissive: '#0a4a6a', emissiveIntensity: 0.3 }), 0, 0.45, 0, fountain, 24); water.castShadow = false;
    cyl(0.25, 0.3, 1.5, mat('#bbb'), 0, 0.75, 0, fountain, 12);
    this.fountainWater = water;
    this.col(-2.1, 10.9, 2.1, 15.1);
    this.int('fountain', 0, 10.3, 'Descansar en la fuente', 1.2);
    for (const [x, z] of [[-12, 10], [-8, 16], [8, 10], [12, 16], [-16, 15], [16, 11], [-4, 18], [5, 18]]) this.tree(x, z);
    for (const [x, z, r] of [[-6, 10, 0], [6, 10, 0], [-6, 16, Math.PI], [6, 16, Math.PI]]) this.bench(x, z, r);
    this.int('bench_park', -6, 11, 'Sentarse en la banca', 1.0);

    // Farolas
    for (let x = -40; x <= 40; x += 10) {
      for (const z of [-5.6, 5.6]) {
        const g = new THREE.Group(); g.position.set(x + (z > 0 ? 5 : 0), 0, z); G.add(g);
        cyl(0.07, 0.1, 4, mat('#333', { metalness: 0.6 }), 0, 2, 0, g, 8);
        box(0.9, 0.08, 0.1, mat('#333'), z < 0 ? 0 : 0, 4, z < 0 ? 0.4 : -0.4, g).rotation.y = Math.PI / 2;
        const bulbM = glow('#ffe7a8', 0); this.lampMats.push(bulbM);
        box(0.35, 0.1, 0.25, bulbM, 0, 3.92, z < 0 ? 0.8 : -0.8, g);
        this.col(x + (z > 0 ? 5 : 0) - 0.12, z - 0.12, x + (z > 0 ? 5 : 0) + 0.12, z + 0.12);
      }
    }
    this.streetLights = [];
    for (const x of [-20, 0, 20]) { const l = new THREE.PointLight('#ffe0a0', 0, 22, 1.5); l.position.set(x, 4, 0); G.add(l); this.streetLights.push(l); }

    // Límites
    this.col(-50, -16, 50, -15); this.col(-50, 19, 50, 20); this.col(-50, -16, -49, 20); this.col(49, -16, 50, 20);

    // Autos
    const carCols = ['#e74c3c', '#3498db', '#f1c40f', '#ecf0f1', '#2c3e50', '#8e44ad'];
    for (let i = 0; i < 5; i++) {
      const c = this.car(carCols[i % carCols.length]);
      const lane = i % 2 ? 1.5 : -1.5;
      c.position.set(-45 + i * 22, 0, lane); c.rotation.y = lane > 0 ? -Math.PI / 2 : Math.PI / 2;
      c.userData = { lane, speed: 7 + Math.random() * 5, dir: lane > 0 ? -1 : 1 };
      G.add(c); this.cars.push(c);
    }

    // Peatones
    for (let i = 0; i < 9; i++) {
      const ch = new Character(randomLook());
      const side = i % 2 ? 4.5 : -4.5;
      ch.group.position.set(-35 + Math.random() * 70, 0.15, side + (Math.random() - 0.5));
      ch.setPose('walk');
      ch.data = { dir: Math.random() < 0.5 ? 1 : -1, speed: 1.1 + Math.random() * 0.8, pause: 0 };
      ch.group.rotation.y = ch.data.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      G.add(ch.group); this.npcs.push(ch);
    }

    this.spawn = new THREE.Vector3(STREET_ORIGIN.x, 0, STREET_ORIGIN.z - 5.5);
  }

  tree(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); this.group.add(g);
    cyl(0.18, 0.25, 2, mat('#6d4c33'), 0, 1, 0, g, 8);
    const leaf = mat(['#2e7d32', '#388e3c', '#43a047'][Math.floor(Math.random() * 3)], { roughness: 1 });
    sphere(1.3, leaf, 0, 2.8, 0, g, 10); sphere(0.9, leaf, 0.6, 3.4, 0.3, g, 8); sphere(0.9, leaf, -0.6, 3.2, -0.2, g, 8);
    this.col(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
  }
  bench(x, z, r) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = r; this.group.add(g);
    box(1.8, 0.08, 0.5, mat('#8b5a2b'), 0, 0.45, 0, g); box(1.8, 0.4, 0.06, mat('#8b5a2b'), 0, 0.75, -0.25, g);
    box(0.08, 0.45, 0.45, mat('#222'), -0.8, 0.22, 0, g); box(0.08, 0.45, 0.45, mat('#222'), 0.8, 0.22, 0, g);
    this.col(x - 0.95, z - 0.35, x + 0.95, z + 0.35);
  }
  car(color) {
    const g = new THREE.Group();
    const body = mat(color, { metalness: 0.6, roughness: 0.3 });
    box(1.8, 0.6, 4, body, 0, 0.6, 0, g);
    box(1.6, 0.55, 2.1, body, 0, 1.15, -0.2, g);
    box(1.62, 0.45, 2.0, mat('#1a2a3a', { roughness: 0.05, metalness: 0.8 }), 0, 1.15, -0.2, g).scale.set(1.001, 1, 0.9);
    for (const [x, z] of [[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]]) { const w = cyl(0.35, 0.35, 0.25, mat('#111'), x, 0.35, z, g, 14); w.rotation.z = Math.PI / 2; }
    box(0.4, 0.15, 0.05, glow('#fff9c4', 2), -0.6, 0.65, 2.0, g); box(0.4, 0.15, 0.05, glow('#fff9c4', 2), 0.6, 0.65, 2.0, g);
    box(0.4, 0.12, 0.05, glow('#ff1744', 2), -0.6, 0.7, -2.0, g); box(0.4, 0.12, 0.05, glow('#ff1744', 2), 0.6, 0.7, -2.0, g);
    return g;
  }

  setTimeOfDay(night) {
    this.lampMats.forEach((m) => { m.emissiveIntensity = night > 0.4 ? 3 : 0; });
    this.streetLights.forEach((l) => { l.intensity = night > 0.4 ? 40 : 0; });
    (this.winMats || []).forEach((m, i) => { m.emissiveIntensity = night > 0.4 && i % 3 !== 1 ? 0.8 : 0; });
  }

  update(dt, t, active) {
    if (!active) return;
    for (const c of this.cars) {
      c.position.x += c.userData.speed * c.userData.dir * dt;
      if (c.position.x > 55) c.position.x = -55;
      if (c.position.x < -55) c.position.x = 55;
    }
    for (const n of this.npcs) {
      const d = n.data;
      if (d.pause > 0) { d.pause -= dt; n.setPose('idle'); n.update(dt, 0); continue; }
      n.setPose('walk');
      n.group.position.x += d.dir * d.speed * dt;
      if (Math.abs(n.group.position.x) > 44 || Math.random() < 0.002) {
        d.dir *= -1; n.group.rotation.y = d.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (Math.random() < 0.5) d.pause = 1 + Math.random() * 3;
      }
      n.update(dt, d.speed);
    }
    this.fountainWater.position.y = 0.45 + Math.sin(t * 2) * 0.01;
  }
}
