// Apartamento 3D del streamer: habitaciones, muebles, colisiones, interacciones y elementos dinámicos.
import * as THREE from 'three';
import { mat, glow, box, cyl, sphere, textPlane, aabb, canvasTex, worldUV } from './util.js';
import { buildPCModel, spinFans } from './pcmodel.js';
import { pbr, withRepeat } from './textures.js';
import { Character } from './character.js';

const WALL_H = 2.8;

export class Apartment {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.colliders = [];
    this.walls = [];
    this.interactables = [];
    this.dyn = {}; // grupos dinámicos
    this.lights = [];
    this.build();
  }

  addCol(minX, minZ, maxX, maxZ) { const c = aabb(minX, minZ, maxX, maxZ); this.colliders.push(c); return c; }
  addInt(id, x, z, label, r = 1.1, extra = {}) { const i = { id, x, z, r, label, ...extra }; this.interactables.push(i); return i; }

  wall(axis, pos, from, to, color = '#d9d4e7', gaps = [], h = WALL_H) {
    // axis 'z': pared en z=pos, se extiende en x. axis 'x': pared en x=pos, se extiende en z.
    const segs = [];
    let cur = from;
    const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
    for (const [a, b] of sorted) { if (a > cur) segs.push([cur, a]); cur = b; }
    if (cur < to) segs.push([cur, to]);
    const tiled = color === '#bfe0e8';
    const m = tiled ? pbr('tiles', { color, tiles: 8, unique: true }) : pbr('plaster', { color, unique: true });
    const unit = tiled ? 1.4 : 2.5;
    m.transparent = true; m.opacity = 1;
    const meshes = [];
    for (const [a, b] of segs) {
      const len = b - a, mid = (a + b) / 2;
      const mesh = axis === 'z'
        ? box(len, h, 0.2, m, mid, h / 2, pos, this.group)
        : box(0.2, h, len, m, pos, h / 2, mid, this.group);
      worldUV(mesh, unit);
      meshes.push(mesh);
      if (axis === 'z') this.addCol(a, pos - 0.12, b, pos + 0.12); else this.addCol(pos - 0.12, a, pos + 0.12, b);
    }
    // Dintel sobre las puertas
    for (const [a, b] of sorted) {
      const len = b - a, mid = (a + b) / 2;
      const mesh = axis === 'z' ? box(len, h - 2.2, 0.2, m, mid, 2.2 + (h - 2.2) / 2, pos, this.group) : box(0.2, h - 2.2, len, m, pos, 2.2 + (h - 2.2) / 2, mid, this.group);
      worldUV(mesh, unit);
      meshes.push(mesh);
    }
    this.walls.push({ axis, pos, min: from, max: to, mat: m, meshes });
    // Zócalo
    return meshes;
  }

  build() {
    const G = this.group;
    // ---------- Piso ----------
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), pbr('wood', { repeat: [5, 4] }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; G.add(floor);
    const bathFloor = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 3.5), pbr('tiles', { color: '#eef3f6', repeat: [2, 2], tiles: 6 }));
    bathFloor.rotation.x = -Math.PI / 2; bathFloor.position.set(6.25, 0.005, 4.25); bathFloor.receiveShadow = true; G.add(bathFloor);
    const kitFloor = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.4), pbr('tiles', { color: '#3f3f4f', repeat: [3, 2], tiles: 4 }));
    kitFloor.rotation.x = -Math.PI / 2; kitFloor.position.set(-5.5, 0.004, 4.3); kitFloor.receiveShadow = true; G.add(kitFloor);

    // Suelo exterior oscuro
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat('#1b1d24'));
    outside.rotation.x = -Math.PI / 2; outside.position.y = -0.02; outside.receiveShadow = true; G.add(outside);

    // ---------- Paredes ----------
    this.wall('z', -6, -8.1, 8.1, '#cfc8e6', [[1.5, 3.1]]); // norte (ventana)
    this.wall('z', 6, -8.1, 8.1, '#e3dccf');
    this.wall('x', -8, -6, 6, '#cfc8e6', [[0, 1.1]]); // oeste: puerta principal
    this.wall('x', 8, -6, 6, '#d5e0e6', [[-1.2, 0.2]]); // este: ventana
    this.wall('x', 4.5, 2.5, 6, '#bfe0e8', [[3.2, 4.2]]); // baño
    this.wall('z', 2.5, 4.5, 8, '#bfe0e8');
    // Ventanas: marco + vidrio + cielo exterior
    this.skyMats = [];
    const win = (x, y, z, w, h, rotY) => {
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; G.add(g);
      const frame = mat('#f5f5f5');
      box(w + 0.1, 0.08, 0.25, frame, 0, -h / 2, 0, g); box(w + 0.1, 0.08, 0.25, frame, 0, h / 2, 0, g);
      box(0.08, h, 0.25, frame, -w / 2, 0, 0, g); box(0.08, h, 0.25, frame, w / 2, 0, 0, g); box(0.05, h, 0.1, frame, 0, 0, 0, g);
      const sky = new THREE.MeshBasicMaterial({ color: '#87ceeb' });
      this.skyMats.push(sky);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), sky); p.position.z = -0.3; g.add(p);
      // skyline
      const sk = new THREE.Group(); sk.position.z = -0.25; g.add(sk);
      for (let i = 0; i < 7; i++) {
        const bh = 0.3 + Math.random() * 0.7;
        const b = new THREE.Mesh(new THREE.PlaneGeometry(0.22, bh), new THREE.MeshBasicMaterial({ color: '#445066' }));
        b.position.set(-w / 2 + 0.15 + i * (w / 7), -h / 2 + bh / 2, 0); sk.add(b);
        for (let k = 0; k < 4; k++) {
          const lw = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.04), glow('#ffd97a', 1));
          lw.position.set(b.position.x - 0.05 + (k % 2) * 0.1, -h / 2 + 0.1 + Math.floor(k / 2) * 0.15 + Math.random() * bh * 0.5, 0.01); sk.add(lw);
          (this.windowLights ??= []).push(lw);
        }
      }
      // repisa
      box(w + 0.2, 0.05, 0.35, frame, 0, -h / 2 - 0.05, 0.1, g);
      // cortinas
      const cur = mat('#6d5ba8', { roughness: 1 });
      box(0.35, h + 0.4, 0.05, cur, -w / 2 - 0.2, 0.1, 0.2, g); box(0.35, h + 0.4, 0.05, cur, w / 2 + 0.2, 0.1, 0.2, g);
      return g;
    };
    // Relleno de pared bajo y sobre la ventana norte
    const wm = this.walls[0].mat;
    const nb = box(1.6, 0.9, 0.2, wm, 2.3, 0.45, -6, G); const nt = box(1.6, 0.6, 0.2, wm, 2.3, 2.5, -6, G);
    this.walls[0].meshes.push(nb, nt);
    this.addCol(1.5, -6.12, 3.1, -5.88);
    win(2.3, 1.55, -6, 1.5, 1.2, 0);
    const em = this.walls[3].mat;
    const eb = box(0.2, 0.9, 1.4, em, 8, 0.45, -0.5, G); const et = box(0.2, 0.6, 1.4, em, 8, 2.5, -0.5, G);
    this.walls[3].meshes.push(eb, et);
    this.addCol(7.88, -1.2, 8.12, 0.2);
    win(8, 1.55, -0.5, 1.3, 1.2, -Math.PI / 2);

    // Zócalos
    const base = mat('#f0f0f0');
    box(16, 0.1, 0.03, base, 0, 0.05, -5.88, G); box(16, 0.1, 0.03, base, 0, 0.05, 5.88, G);

    // Puerta principal
    this.doorPivot = new THREE.Group(); this.doorPivot.position.set(-8, 0, 0); G.add(this.doorPivot);
    box(0.08, 2.15, 1.1, mat('#6b4423', { roughness: 0.6 }), 0, 1.075, 0.55, this.doorPivot);
    sphere(0.04, mat('#d4af37', { metalness: 0.9, roughness: 0.2 }), 0.08, 1.05, 0.95, this.doorPivot);
    this.addCol(-8.2, 0, -7.95, 1.1);
    const mat2 = box(0.9, 0.02, 0.6, mat('#7a5230'), -7.5, 0.01, 0.55, G); mat2.receiveShadow = true;
    this.addInt('door', -7.4, 0.55, 'Salir a la calle', 1.0);
    this.packageSpot = new THREE.Vector3(-7.2, 0, 1.6);
    this.dyn.packages = new THREE.Group(); G.add(this.dyn.packages);

    this.buildStreamCorner();
    this.buildBench();
    this.buildBedroom();
    this.buildBathroom();
    this.buildKitchen();
    this.buildLiving();

    // ---------- Luces ----------
    const hemi = new THREE.HemisphereLight('#dfe8ff', '#3a2c20', 0.5); G.add(hemi); this.hemi = hemi;
    const sun = new THREE.DirectionalLight('#fff3dd', 1.6);
    sun.position.set(6, 12, -10); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -12; sun.shadow.camera.right = 12; sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
    G.add(sun); G.add(sun.target); this.sun = sun;
    const lamps = [[-5, -3.5, '#ffe2b5'], [0.5, 2.5, '#fff0d6'], [-5.5, 4, '#ffffff'], [5.5, -3, '#ffd7a8'], [6.2, 4.2, '#ffffff'], [0, -3.5, '#fff0d6']];
    for (const [x, z, c] of lamps) {
      const l = new THREE.PointLight(c, 0, 9, 1.6); l.position.set(x, 2.6, z); G.add(l); this.lights.push(l);
      const fixture = cyl(0.25, 0.3, 0.08, glow(c, 0.1), x, 2.75, z, G, 20);
      fixture.castShadow = false; l.userData.fixture = fixture;
    }
  }

  // ---------- Rincón de streaming ----------
  buildStreamCorner() {
    const G = this.group;
    const dx = -5, dz = -5.55;
    const desk = new THREE.Group(); desk.position.set(dx, 0, dz); G.add(desk);
    const top = pbr('darkwood', { rows: 4 });
    box(1.9, 0.05, 0.8, top, 0, 0.75, 0, desk);
    box(0.05, 0.75, 0.7, mat('#111'), -0.9, 0.375, 0, desk); box(0.05, 0.75, 0.7, mat('#111'), 0.9, 0.375, 0, desk);
    box(1.9, 0.004, 0.02, glow('#8a2be2', 2), 0, 0.73, 0.4, desk).userData.led = true;
    this.deskLed = desk.children[desk.children.length - 1];
    // Alfombrilla, teclado, ratón
    box(1.0, 0.005, 0.38, mat('#15151a'), 0.05, 0.778, 0.15, desk);
    this.dyn.keyboard = new THREE.Group(); desk.add(this.dyn.keyboard);
    this.dyn.mouse = new THREE.Group(); desk.add(this.dyn.mouse);
    // Monitor principal con pantalla dinámica
    const mon = new THREE.Group(); mon.position.set(0, 0.78, -0.18); desk.add(mon);
    box(0.25, 0.02, 0.18, mat('#111'), 0, 0.01, 0, mon);
    box(0.05, 0.3, 0.04, mat('#111'), 0, 0.16, -0.03, mon);
    box(1.0, 0.58, 0.04, mat('#0c0c0c', { roughness: 0.3 }), 0, 0.5, 0, mon);
    this.monitorCanvas = document.createElement('canvas');
    this.monitorCanvas.width = 512; this.monitorCanvas.height = 288;
    this.monitorTex = new THREE.CanvasTexture(this.monitorCanvas); this.monitorTex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.54), new THREE.MeshBasicMaterial({ map: this.monitorTex, toneMapped: false }));
    screen.position.set(0, 0.5, 0.021); mon.add(screen);
    this.screenLight = new THREE.PointLight('#88aaff', 0.5, 2.5, 2); this.screenLight.position.set(dx, 1.3, dz + 0.3); G.add(this.screenLight);
    this.drawMonitor((g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); });

    this.dyn.monitor2 = new THREE.Group(); desk.add(this.dyn.monitor2);
    this.dyn.webcam = new THREE.Group(); desk.add(this.dyn.webcam);
    this.dyn.mic = new THREE.Group(); desk.add(this.dyn.mic);
    this.dyn.light = new THREE.Group(); G.add(this.dyn.light);
    this.dyn.greenscreen = new THREE.Group(); G.add(this.dyn.greenscreen);
    this.dyn.deck = new THREE.Group(); desk.add(this.dyn.deck);
    this.dyn.chair = new THREE.Group(); this.dyn.chair.position.set(dx, 0, -4.55); G.add(this.dyn.chair);
    this.chairPos = new THREE.Vector3(dx, 0, -4.55);

    // Taza y snacks
    cyl(0.04, 0.035, 0.1, mat('#e74c3c'), 0.75, 0.83, 0.05, desk, 12);
    box(0.15, 0.2, 0.08, mat('#ffcc00'), -0.75, 0.88, -0.2, desk);

    this.addCol(dx - 0.97, dz - 0.42, dx + 0.97, dz + 0.42);
    this.addCol(dx - 0.3, -4.85, dx + 0.3, -4.3); // silla

    // PC en el piso al lado del escritorio
    this.dyn.pc = new THREE.Group(); this.dyn.pc.position.set(-3.75, 0, -5.55); this.dyn.pc.rotation.y = -Math.PI / 2; G.add(this.dyn.pc);
    this.addCol(-4.0, -5.8, -3.5, -5.3);
    this.addInt('pc', dx, -4.1, 'Usar PC', 1.0);
    this.addInt('pctower', -3.4, -4.9, 'Revisar torre de la PC', 0.7);
  }

  drawMonitor(fn) {
    const g = this.monitorCanvas.getContext('2d');
    fn(g, this.monitorCanvas.width, this.monitorCanvas.height);
    this.monitorTex.needsUpdate = true;
  }

  refreshPC(S) {
    const g = this.dyn.pc; g.clear();
    const m = buildPCModel(S.pc.parts, { powered: true, rgb: S.ledColor, paste: S.pc.paste });
    m.scale.setScalar(0.5); g.add(m); this.pcModel = m;
  }

  refreshPeripherals(S) {
    const P = S.peripherals;
    const D = this.dyn;
    ['keyboard', 'mouse', 'monitor2', 'webcam', 'mic', 'light', 'greenscreen', 'deck'].forEach((k) => D[k].clear());
    // Teclado
    if (P.keyboard) {
      box(0.46, 0.025, 0.15, mat('#111'), -0.05, 0.79, 0.15, D.keyboard);
      box(0.44, 0.004, 0.13, glow(S.ledColor, 1.5), -0.05, 0.804, 0.15, D.keyboard);
    } else {
      box(0.44, 0.02, 0.14, mat('#d8d8d8'), -0.05, 0.788, 0.15, D.keyboard);
    }
    if (P.mouse) {
      const ms = sphere(0.035, mat('#111'), 0.35, 0.795, 0.15, D.mouse, 12); ms.scale.set(0.8, 0.45, 1.3);
      box(0.01, 0.003, 0.03, glow(S.ledColor, 2), 0.35, 0.81, 0.14, D.mouse);
    } else {
      const ms = sphere(0.032, mat('#d8d8d8'), 0.35, 0.79, 0.15, D.mouse, 12); ms.scale.set(0.8, 0.45, 1.3);
    }
    if (P.monitor2) {
      const m2 = new THREE.Group(); m2.position.set(-0.78, 0.78, -0.12); m2.rotation.y = 0.45; D.monitor2.add(m2);
      box(0.2, 0.02, 0.15, mat('#111'), 0, 0.01, 0, m2); box(0.04, 0.28, 0.04, mat('#111'), 0, 0.15, -0.02, m2);
      box(0.62, 0.38, 0.03, mat('#0c0c0c'), 0, 0.42, 0, m2);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.59, 0.35), new THREE.MeshBasicMaterial({ map: this.chatTex(), toneMapped: false }));
      scr.position.set(0, 0.42, 0.016); m2.add(scr);
    }
    if (P.webcam) {
      const q = P.webcam === 'cam_4k';
      box(q ? 0.12 : 0.09, 0.04, 0.04, mat('#111'), 0, q ? 1.4 : 1.1, -0.17, D.webcam);
      const lens = cyl(0.014, 0.014, 0.01, mat('#335', { metalness: 0.9, roughness: 0.1 }), 0, q ? 1.4 : 1.1, -0.145, D.webcam, 12); lens.rotation.x = Math.PI / 2;
      sphere(0.004, glow('#ff2222', 3), 0.03, q ? 1.41 : 1.11, -0.148, D.webcam, 6);
      if (q) { cyl(0.01, 0.01, 0.6, mat('#222'), 0, 1.08, -0.2, D.webcam, 8); }
    }
    if (P.mic) {
      if (P.mic === 'mic_headset') { /* el headset va en la cabeza */ } else {
        const arm = new THREE.Group(); arm.position.set(0.7, 0.78, -0.3); D.mic.add(arm);
        cyl(0.012, 0.012, 0.5, mat('#111'), 0, 0.25, 0, arm, 8);
        const a2 = cyl(0.01, 0.01, 0.5, mat('#111'), -0.15, 0.55, 0.15, arm, 8); a2.rotation.set(0.7, 0, 0.6);
        const micM = cyl(0.035, 0.03, 0.14, mat(P.mic === 'mic_xlr' ? '#2c2c2c' : '#555', { metalness: 0.6, roughness: 0.3 }), -0.3, 0.7, 0.35, arm, 16);
        micM.rotation.x = 0.3;
        if (P.mic === 'mic_xlr') { const pop = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), new THREE.MeshStandardMaterial({ color: '#111', transparent: true, opacity: 0.6, side: THREE.DoubleSide })); pop.position.set(-0.32, 0.7, 0.45); arm.add(pop); }
      }
    }
    if (P.light) {
      if (P.light === 'light_ring') {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 32), glow('#ffffff', 2)); ring.position.set(-4.1, 1.55, -5.3); ring.rotation.y = -0.4; D.light.add(ring);
        cyl(0.012, 0.012, 1.4, mat('#111'), -4.1, 0.7, -5.3, D.light, 8);
        const l = new THREE.PointLight('#fff5ee', 1.2, 3, 2); l.position.set(-4.3, 1.5, -5.0); D.light.add(l);
      } else {
        for (const x of [-6.2, -3.8]) {
          box(0.35, 0.25, 0.04, glow('#ffffff', 2), x, 1.7, -5.1, D.light).rotation.y = x < -5 ? 0.5 : -0.5;
          cyl(0.012, 0.012, 1.6, mat('#111'), x, 0.8, -5.12, D.light, 8);
          const l = new THREE.SpotLight('#ffffff', 5, 5, 0.8, 0.5, 1.5); l.position.set(x, 1.7, -5.0); l.target.position.set(-5, 1.3, -4.3); D.light.add(l); D.light.add(l.target);
        }
      }
    }
    if (P.greenscreen) {
      box(1.6, 1.6, 0.03, mat('#18c93c', { roughness: 1 }), -5, 1.6, -4.0, D.greenscreen).castShadow = false;
      D.greenscreen.visible = false; // se muestra solo al transmitir
    }
    if (P.deck) {
      box(0.16, 0.03, 0.1, mat('#111'), 0.55, 0.79, 0.12, D.deck);
      for (let i = 0; i < 15; i++) box(0.022, 0.006, 0.022, glow(['#ff4757', '#2ed573', '#1e90ff', '#ffa502', '#a55eea'][i % 5], 1.5), 0.495 + (i % 5) * 0.028, 0.808, 0.095 + Math.floor(i / 5) * 0.028, D.deck);
    }
    // Silla
    this.buildChair(P.chair, S.ledColor);
  }

  buildChair(id, led) {
    const c = this.dyn.chair; c.clear();
    const color = id === 'chair_gamer' ? '#c0392b' : id === 'chair_pro' ? '#2d3436' : '#3d3d46';
    const m = mat(color, { roughness: 0.7 });
    cyl(0.04, 0.04, 0.4, mat('#222', { metalness: 0.6 }), 0, 0.25, 0, c, 8);
    for (let i = 0; i < 5; i++) { const leg = box(0.32, 0.04, 0.05, mat('#222'), 0, 0.05, 0, c); leg.geometry.translate(0.16, 0, 0); leg.rotation.y = (i / 5) * Math.PI * 2; }
    box(0.55, 0.1, 0.52, m, 0, 0.48, 0, c);
    const back = box(0.52, id === 'chair_basic' ? 0.55 : 0.85, 0.08, m, 0, id === 'chair_basic' ? 0.82 : 0.96, 0.27, c);
    back.rotation.x = -0.1;
    if (id === 'chair_gamer') { box(0.1, 0.8, 0.09, mat('#111'), 0, 0.97, 0.275, c); box(0.3, 0.12, 0.1, mat('#111'), 0, 1.25, 0.24, c); }
    if (id === 'chair_pro') { box(0.54, 0.82, 0.02, mat('#555', { roughness: 1, transparent: true, opacity: 0.8 }), 0, 0.95, 0.24, c); }
    box(0.06, 0.2, 0.3, mat('#222'), 0.3, 0.63, 0, c); box(0.06, 0.2, 0.3, mat('#222'), -0.3, 0.63, 0, c);
  }

  chatTex() {
    return canvasTex(256, 150, (g, w, h) => {
      g.fillStyle = '#18181b'; g.fillRect(0, 0, w, h);
      g.font = '11px sans-serif';
      const cols = ['#ff6b6b', '#4dd2ff', '#a3ff6b', '#ffd36b', '#d06bff'];
      for (let i = 0; i < 10; i++) { g.fillStyle = cols[i % 5]; g.fillText('usuario' + i + ':', 6, 14 + i * 13); g.fillStyle = '#ddd'; g.fillText(['hola!', 'GG', 'jajaja', 'buen stream', '🔥🔥'][i % 5], 70, 14 + i * 13); }
    });
  }

  // ---------- Banco de trabajo ----------
  buildBench() {
    const G = this.group;
    const bx = -0.5, bz = -5.5;
    const b = new THREE.Group(); b.position.set(bx, 0, bz); G.add(b);
    box(2.2, 0.06, 0.9, pbr('wood', { rows: 3 }), 0, 0.9, 0, b);
    for (const [x, z] of [[-1.05, -0.4], [1.05, -0.4], [-1.05, 0.4], [1.05, 0.4]]) box(0.06, 0.9, 0.06, mat('#333'), x, 0.45, z, b);
    box(2.1, 0.03, 0.8, mat('#555'), 0, 0.3, 0, b);
    box(1.0, 0.004, 0.6, mat('#1e5fa8', { roughness: 0.9 }), -0.1, 0.934, 0.05, b); // tapete antiestático
    // Tablero de herramientas
    box(2.0, 1.0, 0.04, mat('#c9b48d'), 0, 1.75, -0.42, b);
    for (let i = 0; i < 6; i++) { box(0.03, 0.25, 0.03, mat(['#e74c3c', '#f1c40f', '#3498db'][i % 3]), -0.8 + i * 0.3, 1.8, -0.38, b); }
    // Lámpara
    cyl(0.02, 0.02, 0.6, mat('#222'), 0.9, 1.2, -0.25, b, 8);
    const shade = cyl(0.03, 0.12, 0.12, mat('#222'), 0.8, 1.48, -0.1, b, 16); shade.rotation.x = 0.4;
    const bl = new THREE.SpotLight('#fff6e0', 4, 3, 0.9, 0.5, 1.5); bl.position.set(bx + 0.7, 1.45, bz); bl.target.position.set(bx - 0.1, 0.9, bz + 0.1); G.add(bl); G.add(bl.target);
    this.benchLight = bl;
    // Caja de herramientas
    box(0.4, 0.2, 0.2, mat('#c0392b', { metalness: 0.3 }), 0.8, 1.03, 0.2, b);
    this.dyn.bench = new THREE.Group(); this.dyn.bench.position.set(bx - 0.15, 0.935, bz + 0.05); this.dyn.bench.rotation.y = 0; G.add(this.dyn.bench);
    this.benchAnchor = this.dyn.bench;
    this.addCol(bx - 1.12, bz - 0.47, bx + 1.12, bz + 0.47);
    this.addInt('bench', bx, -4.5, 'Banco de trabajo (armar PCs)', 1.0);
  }

  refreshBench(S) {
    const g = this.dyn.bench; g.clear();
    if (!Object.keys(S.bench.parts).length) return;
    const m = buildPCModel(S.bench.parts, { open: true, rgb: S.ledColor, paste: S.bench.paste, powered: false });
    m.scale.setScalar(0.55); m.rotation.y = -Math.PI / 2; g.add(m); this.benchModel = m;
  }

  // ---------- Dormitorio ----------
  buildBedroom() {
    const G = this.group;
    const bed = new THREE.Group(); bed.position.set(6.2, 0, -4.95); G.add(bed);
    box(1.7, 0.35, 2.15, pbr('darkwood'), 0, 0.18, 0, bed);
    box(1.6, 0.22, 2.0, mat('#f5f5f5', { roughness: 1 }), 0, 0.46, 0.02, bed);
    box(1.62, 0.1, 1.3, pbr('fabric', { color: '#4a69bd', repeat: [3, 3] }), 0, 0.6, 0.35, bed);
    box(0.6, 0.14, 0.35, mat('#ffffff', { roughness: 1 }), -0.4, 0.64, -0.75, bed);
    box(0.6, 0.14, 0.35, mat('#ffffff', { roughness: 1 }), 0.4, 0.64, -0.75, bed);
    box(1.7, 1.0, 0.1, pbr('darkwood'), 0, 0.5, -1.07, bed);
    this.bedPos = new THREE.Vector3(6.2, 0.6, -5.2);
    this.addCol(5.3, -6, 7.1, -3.85);
    this.addInt('bed', 5.8, -3.4, 'Dormir', 1.0);
    // Mesa de noche + lámpara
    box(0.5, 0.5, 0.45, pbr('darkwood'), 7.55, 0.25, -5.6, G);
    cyl(0.05, 0.08, 0.3, mat('#ddd'), 7.55, 0.65, -5.6, G, 12);
    cyl(0.14, 0.18, 0.2, glow('#ffd28a', 0.8), 7.55, 0.88, -5.6, G, 16);
    this.addCol(7.3, -5.85, 7.8, -5.35);
    // Armario
    const wd = new THREE.Group(); wd.position.set(7.6, 0, -2.5); G.add(wd);
    box(0.6, 2.1, 1.3, pbr('wood', { rows: 3 }), 0, 1.05, 0, wd);
    box(0.02, 1.9, 0.01, mat('#3a2a1a'), -0.31, 1.05, 0, wd);
    sphere(0.03, mat('#d4af37', { metalness: 0.9 }), -0.32, 1.05, 0.1, wd); sphere(0.03, mat('#d4af37', { metalness: 0.9 }), -0.32, 1.05, -0.1, wd);
    this.addCol(7.25, -3.2, 7.95, -1.8);
    this.addInt('wardrobe', 6.9, -2.5, 'Cambiarte de ropa', 0.9);
  }

  // ---------- Baño ----------
  buildBathroom() {
    const G = this.group;
    // Ducha
    const sh = new THREE.Group(); sh.position.set(7.2, 0, 5.2); G.add(sh);
    box(1.4, 0.1, 1.4, mat('#ffffff', { roughness: 0.2 }), 0, 0.05, 0, sh);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.02, 2.0, 1.4), new THREE.MeshPhysicalMaterial({ color: '#bfe9ff', transparent: true, opacity: 0.25, roughness: 0.05 }));
    glass.position.set(-0.7, 1.05, 0); sh.add(glass);
    cyl(0.015, 0.015, 1.9, mat('#ccc', { metalness: 0.9, roughness: 0.2 }), 0.6, 1.0, 0.6, sh, 8);
    cyl(0.12, 0.12, 0.03, mat('#ccc', { metalness: 0.9, roughness: 0.2 }), 0.45, 1.95, 0.45, sh, 16);
    this.showerPos = new THREE.Vector3(7.2, 0, 5.2);
    this.addCol(7.5, 4.5, 8, 6);
    this.addInt('shower', 6.1, 5.0, 'Ducharse', 0.9);
    // Lavabo y espejo
    box(0.7, 0.8, 0.45, mat('#ffffff', { roughness: 0.3 }), 5.2, 0.4, 5.72, G);
    cyl(0.18, 0.12, 0.08, mat('#e8f4f8', { roughness: 0.1 }), 5.2, 0.84, 5.7, G, 16);
    box(0.6, 0.8, 0.03, new THREE.MeshStandardMaterial({ color: '#dfefff', metalness: 1, roughness: 0.05 }), 5.2, 1.6, 5.9, G);
    this.addCol(4.8, 5.45, 5.6, 6);
    this.addInt('sink', 5.2, 5.0, 'Lavarte la cara', 0.7);
    // Inodoro
    const t = new THREE.Group(); t.position.set(6.3, 0, 5.65); G.add(t);
    cyl(0.18, 0.15, 0.4, mat('#fff', { roughness: 0.2 }), 0, 0.2, 0, t, 16);
    box(0.4, 0.35, 0.18, mat('#fff', { roughness: 0.2 }), 0, 0.55, 0.18, t);
    cyl(0.2, 0.2, 0.04, mat('#f4f4f4'), 0, 0.42, -0.03, t, 16);
    this.addCol(6.05, 5.35, 6.55, 6);
    this.addInt('toilet', 6.3, 4.9, 'Usar el baño', 0.6);
  }

  // ---------- Cocina ----------
  buildKitchen() {
    const G = this.group;
    // Nevera
    const fr = new THREE.Group(); fr.position.set(-7.5, 0, 5.5); G.add(fr);
    box(0.85, 1.9, 0.75, mat('#dfe6e9', { metalness: 0.4, roughness: 0.3 }), 0, 0.95, 0, fr);
    box(0.02, 0.5, 0.03, mat('#888', { metalness: 0.9 }), 0.3, 1.3, -0.39, fr);
    box(0.84, 0.01, 0.02, mat('#999'), 0, 1.25, -0.38, fr);
    this.addCol(-7.95, 5.1, -7.05, 6);
    this.addInt('fridge', -7.4, 4.5, 'Nevera (comer)', 0.9);
    // Encimera
    const ct = withRepeat(pbr('marble'), 3, 0.6);
    box(3.2, 0.9, 0.62, pbr('darkwood', { rows: 2 }), -5.35, 0.45, 5.66, G);
    box(3.25, 0.05, 0.66, ct, -5.35, 0.92, 5.64, G);
    this.addCol(-6.97, 5.3, -3.73, 6);
    // Estufa
    box(0.6, 0.02, 0.5, mat('#111', { roughness: 0.2 }), -5.2, 0.955, 5.64, G);
    for (const [x, z] of [[-5.35, 5.52], [-5.05, 5.52], [-5.35, 5.78], [-5.05, 5.78]]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.01, 6, 16), mat('#444')); r.rotation.x = Math.PI / 2; r.position.set(x, 0.97, z); G.add(r);
    }
    this.stoveGlow = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), glow('#ff4500', 0)); this.stoveGlow.rotation.x = -Math.PI / 2; this.stoveGlow.position.set(-5.35, 0.968, 5.52); G.add(this.stoveGlow);
    const pan = cyl(0.12, 0.1, 0.06, mat('#222', { metalness: 0.6 }), -5.05, 1.0, 5.78, G, 16);
    this.addInt('stove', -5.2, 4.7, 'Cocinar', 0.8);
    // Fregadero
    box(0.5, 0.02, 0.4, mat('#aab', { metalness: 0.9, roughness: 0.2 }), -6.3, 0.95, 5.64, G);
    cyl(0.015, 0.015, 0.3, mat('#ccc', { metalness: 0.9 }), -6.3, 1.1, 5.88, G, 8);
    // Cafetera
    const cm = new THREE.Group(); cm.position.set(-4.2, 0.95, 5.7); G.add(cm);
    box(0.25, 0.35, 0.25, mat('#2d3436', { metalness: 0.4 }), 0, 0.175, 0, cm);
    cyl(0.05, 0.045, 0.08, mat('#fff'), 0, 0.05, -0.08, cm, 12);
    sphere(0.01, glow('#00ff66', 2), 0.08, 0.28, -0.13, cm, 6);
    this.addInt('coffee', -4.2, 4.8, 'Preparar café', 0.7);
    // Microondas
    box(0.5, 0.28, 0.35, mat('#222'), -6.8, 1.09, 5.7, G);
    box(0.32, 0.2, 0.01, mat('#113', { roughness: 0.1 }), -6.87, 1.09, 5.52, G);
    // Mesa comedor
    const tb = new THREE.Group(); tb.position.set(-5.4, 0, 3.3); G.add(tb);
    cyl(0.6, 0.6, 0.05, pbr('wood', { rows: 4 }), 0, 0.75, 0, tb, 24);
    cyl(0.06, 0.2, 0.75, mat('#333'), 0, 0.375, 0, tb, 12);
    for (const a of [0, Math.PI]) {
      const ch = new THREE.Group(); ch.position.set(Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85); ch.rotation.y = -a + Math.PI / 2; tb.add(ch);
      box(0.42, 0.05, 0.42, mat('#a0785a'), 0, 0.45, 0, ch);
      box(0.42, 0.5, 0.05, mat('#a0785a'), 0, 0.72, 0.2, ch);
      for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) box(0.04, 0.45, 0.04, mat('#333'), x, 0.225, z, ch);
    }
    this.addCol(-6.4, 2.75, -4.4, 3.85);
    // Frutero
    cyl(0.15, 0.1, 0.06, mat('#ddd'), -5.4, 0.8, 3.3, G, 12);
    sphere(0.05, mat('#e74c3c'), -5.45, 0.85, 3.3, G, 8); sphere(0.05, mat('#f1c40f'), -5.35, 0.85, 3.33, G, 8); sphere(0.05, mat('#27ae60'), -5.4, 0.86, 3.24, G, 8);
  }

  // ---------- Sala ----------
  buildLiving() {
    const G = this.group;
    // Alfombra
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), pbr('carpet', { color: '#6c5b7b', repeat: [3, 2] })); rug.rotation.x = -Math.PI / 2; rug.position.set(0.5, 0.01, 3.8); rug.receiveShadow = true; G.add(rug);
    // Sofá mirando al sur (TV)
    const sofa = new THREE.Group(); sofa.position.set(0.5, 0, 2.6); G.add(sofa);
    const sm = pbr('fabric', { color: '#3b6978', repeat: [2, 1] });
    box(2.4, 0.42, 0.95, sm, 0, 0.21, 0, sofa);
    box(2.4, 0.7, 0.25, sm, 0, 0.6, -0.4, sofa);
    box(0.25, 0.6, 0.95, sm, -1.2, 0.35, 0, sofa); box(0.25, 0.6, 0.95, sm, 1.2, 0.35, 0, sofa);
    box(1.05, 0.14, 0.75, mat('#4a8497', { roughness: 1 }), -0.55, 0.49, 0.08, sofa); box(1.05, 0.14, 0.75, mat('#4a8497', { roughness: 1 }), 0.55, 0.49, 0.08, sofa);
    box(0.35, 0.3, 0.12, mat('#f8b195'), -0.8, 0.7, -0.22, sofa).rotation.z = 0.2;
    this.sofaPos = new THREE.Vector3(0.2, 0, 2.7);
    this.addCol(-0.8, 2.1, 1.8, 3.1);
    this.addInt('sofa', 0.2, 3.5, 'Ver TV en el sofá', 0.9);
    // Mesa de centro
    box(1.0, 0.05, 0.55, mat('#2d2d2d', { roughness: 0.3 }), 0.5, 0.4, 3.9, G);
    for (const [x, z] of [[0.05, 3.7], [0.95, 3.7], [0.05, 4.1], [0.95, 4.1]]) cyl(0.02, 0.02, 0.4, mat('#111'), x, 0.2, z, G, 6);
    box(0.25, 0.03, 0.15, mat('#111'), 0.4, 0.44, 3.9, G); // control
    this.addCol(0, 3.62, 1.0, 4.18);
    // TV
    box(1.8, 0.45, 0.45, pbr('darkwood'), 0.5, 0.225, 5.7, G);
    box(1.6, 0.9, 0.05, mat('#0a0a0a', { roughness: 0.2 }), 0.5, 1.15, 5.8, G);
    this.tvCanvas = document.createElement('canvas'); this.tvCanvas.width = 256; this.tvCanvas.height = 144;
    this.tvTex = new THREE.CanvasTexture(this.tvCanvas); this.tvTex.colorSpace = THREE.SRGBColorSpace;
    const tvs = new THREE.Mesh(new THREE.PlaneGeometry(1.54, 0.85), new THREE.MeshBasicMaterial({ map: this.tvTex, toneMapped: false })); tvs.position.set(0.5, 1.15, 5.77); tvs.rotation.y = Math.PI; G.add(tvs);
    this.tvOn = false; this.drawTV(0);
    this.addCol(-0.4, 5.45, 1.4, 6);
    // Consola
    box(0.3, 0.06, 0.25, mat('#fff'), 0.9, 0.48, 5.65, G);
    // Librero
    const bs = new THREE.Group(); bs.position.set(2.9, 0, 5.7); G.add(bs);
    box(1.2, 2.0, 0.35, pbr('darkwood'), 0, 1.0, 0, bs);
    const cols = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'];
    for (let s = 0; s < 4; s++) {
      box(1.1, 0.03, 0.3, mat('#4a3322'), 0, 0.3 + s * 0.45, -0.03, bs);
      for (let i = 0; i < 8; i++) if (Math.random() > 0.2) box(0.08, 0.28 + Math.random() * 0.08, 0.22, mat(cols[(i + s) % 7]), -0.45 + i * 0.12, 0.46 + s * 0.45, -0.05, bs);
    }
    this.addCol(2.25, 5.5, 3.55, 6);
    this.addInt('bookshelf', 2.9, 4.9, 'Leer / estudiar', 0.9);
    // Planta fija
    cyl(0.2, 0.15, 0.4, mat('#b7472a'), -2.4, 0.2, 5.6, G, 12);
    for (let i = 0; i < 6; i++) { const l = sphere(0.18, mat('#2e7d32'), -2.4 + Math.sin(i) * 0.12, 0.6 + i * 0.08, 5.6 + Math.cos(i) * 0.12, G, 8); l.scale.set(1, 1.5, 0.5); }
    this.addCol(-2.65, 5.35, -2.15, 5.85);

    // Decoraciones compradas
    this.dyn.deco = new THREE.Group(); G.add(this.dyn.deco);
    this.dyn.plaques = new THREE.Group(); G.add(this.dyn.plaques);
  }

  refreshDeco(S) {
    const D = this.dyn.deco; D.clear();
    // Quitar colisiones/interacciones de decoración previas
    this.colliders = this.colliders.filter((c) => !c.deco);
    this.interactables = this.interactables.filter((i) => !i.deco);
    const has = (id) => S.inventory.deco.includes(id);
    const led = S.ledColor;
    if (has('poster')) {
      const p = textPlane('GAME ON', { w: 0.7, h: 1.0, bg: '#1a1a2e', fg: '#ff2e63', font: 'bold 120px Impact, sans-serif' });
      p.position.set(-6.8, 1.8, -5.88); D.add(p);
      const p2 = textPlane('LEVEL UP', { w: 0.6, h: 0.85, bg: '#08d9d6', fg: '#252a34', font: 'bold 110px Impact, sans-serif' });
      p2.position.set(-3.3, 1.9, -5.88); D.add(p2);
    }
    if (has('plant')) {
      for (const [x, z] of [[-2.8, -5.5], [7.5, 1.8]]) {
        cyl(0.18, 0.13, 0.35, mat('#ecf0f1'), x, 0.175, z, D, 12);
        for (let i = 0; i < 8; i++) { const l = sphere(0.15, mat('#27ae60'), x + Math.sin(i * 2) * 0.12, 0.5 + i * 0.07, z + Math.cos(i * 2) * 0.12, D, 8); l.scale.set(0.6, 1.4, 0.4); l.rotation.z = Math.sin(i) * 0.5; }
        const c = aabb(x - 0.2, z - 0.2, x + 0.2, z + 0.2); c.deco = true; this.colliders.push(c);
      }
    }
    if (has('ledstrip')) {
      box(5.6, 0.03, 0.03, glow(led, 3), -5, 2.7, -5.86, D);
      box(0.03, 0.03, 4, glow(led, 3), -7.86, 2.7, -4, D);
      const l = new THREE.PointLight(led, 1.5, 6, 2); l.position.set(-5, 2.4, -5.3); D.add(l);
    }
    if (has('shelf')) {
      box(1.0, 0.04, 0.25, mat('#fff'), -2.9, 1.5, -5.8, D);
      const fc = ['#e74c3c', '#f1c40f', '#3498db', '#9b59b6'];
      for (let i = 0; i < 4; i++) { const f = new THREE.Group(); f.position.set(-3.3 + i * 0.26, 1.52, -5.8); D.add(f); cyl(0.04, 0.05, 0.12, mat(fc[i]), 0, 0.06, 0, f, 8); sphere(0.05, mat('#ffe0bd'), 0, 0.16, 0, f, 8); }
    }
    if (has('neon')) {
      const n = textPlane(S.player.channel || 'MI CANAL', { w: 1.8, h: 0.45, bg: null, fg: led, font: 'bold 90px "Segoe Script", cursive', emissive: true });
      n.position.set(-5, 2.25, -5.87); D.add(n);
      const l = new THREE.PointLight(led, 0.8, 3, 2); l.position.set(-5, 2.2, -5.5); D.add(l);
    }
    if (has('rug')) {
      const r = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32), mat('#2c2c54', { roughness: 1 })); r.rotation.x = -Math.PI / 2; r.position.set(-5, 0.012, -4.5); r.receiveShadow = true; D.add(r);
      const r2 = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.86, 32), glow(led, 0.8)); r2.rotation.x = -Math.PI / 2; r2.position.set(-5, 0.014, -4.5); D.add(r2);
    }
    if (has('aquarium')) {
      box(1.0, 0.7, 0.4, mat('#222'), 4.1, 0.35, -5.6, D);
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.5, 0.36), new THREE.MeshPhysicalMaterial({ color: '#4fc3f7', transparent: true, opacity: 0.45, roughness: 0.05, emissive: '#0a3a55', emissiveIntensity: 0.5 }));
      w.position.set(4.1, 0.96, -5.6); D.add(w);
      this.fish = [];
      for (let i = 0; i < 4; i++) { const f = sphere(0.03, mat(['#ff7f11', '#ffd32a', '#ff4d6d', '#18dcff'][i]), 4.1, 0.9 + i * 0.05, -5.6, D, 8); f.scale.set(1.8, 1, 0.6); this.fish.push(f); }
      const c = aabb(3.6, -5.8, 4.6, -5.4); c.deco = true; this.colliders.push(c);
    } else this.fish = null;
    if (has('panels')) {
      for (let i = 0; i < 6; i++) { const p = box(0.05, 0.4, 0.4, mat(i % 2 ? '#2c3e50' : led, { roughness: 1 }), -7.87, 1.3 + (i % 2) * 0.45, -4.5 + Math.floor(i / 2) * 0.45, D); p.castShadow = false; }
    }
    if (has('guitar')) {
      const g = new THREE.Group(); g.position.set(-2.7, 0, -3.6); g.rotation.z = 0.15; D.add(g);
      const body = sphere(0.2, mat('#c0392b', { roughness: 0.3 }), 0, 0.3, 0, g, 16); body.scale.set(1, 1.2, 0.25);
      box(0.05, 0.7, 0.03, mat('#5a3b1f'), 0, 0.8, 0, g);
      box(0.08, 0.14, 0.03, mat('#111'), 0, 1.2, 0, g);
      const c = aabb(-2.9, -3.8, -2.5, -3.4); c.deco = true; this.colliders.push(c);
      const it = { id: 'guitar', x: -2.7, z: -3.0, r: 0.8, label: 'Tocar guitarra', deco: true }; this.interactables.push(it);
    }
    if (has('arcade')) {
      const a = new THREE.Group(); a.position.set(-7.4, 0, -1.4); a.rotation.y = Math.PI / 2; D.add(a);
      box(0.7, 1.8, 0.7, mat('#1e3799'), 0, 0.9, 0, a);
      box(0.6, 0.45, 0.02, glow('#00ffcc', 1.2), 0, 1.35, 0.36, a);
      box(0.7, 0.1, 0.35, mat('#111'), 0, 1.0, 0.45, a);
      sphere(0.03, glow('#ff0044', 2), -0.15, 1.07, 0.5, a, 8); sphere(0.03, glow('#ffee00', 2), 0.1, 1.07, 0.5, a, 8);
      const top = textPlane('ARCADE', { w: 0.65, h: 0.2, bg: '#000', fg: '#ff00aa', emissive: true }); top.position.set(0, 1.7, 0.36); a.add(top);
      const c = aabb(-7.8, -1.8, -7.0, -1.0); c.deco = true; this.colliders.push(c);
      this.interactables.push({ id: 'arcade', x: -6.6, z: -1.4, r: 0.8, label: 'Jugar arcade', deco: true });
    }
    // Placas
    const P = this.dyn.plaques; P.clear();
    const plq = { '1k': ['#b0b0b0', 'PLATA'], '10k': ['#d4af37', 'ORO'], '100k': ['#b9f2ff', 'DIAMANTE'] };
    (S.flags.plaques || []).forEach((k, i) => {
      const [c, n] = plq[k] || ['#aaa', '?'];
      box(0.04, 0.6, 0.5, mat(c, { metalness: 0.95, roughness: 0.15 }), 7.87, 1.8, 0.8 + i * 0.7, P);
      const t = textPlane(`${n} ${k}`, { w: 0.45, h: 0.12, bg: '#111', fg: '#fff' }); t.position.set(7.84, 1.4, 0.8 + i * 0.7); t.rotation.y = -Math.PI / 2; P.add(t);
    });
    // Color LED del escritorio
    this.deskLed.material = glow(led, 2);
  }

  refreshPackages(S) {
    const g = this.dyn.packages; g.clear();
    this.interactables = this.interactables.filter((i) => i.id !== 'package');
    const n = S.doorPackages.length;
    for (let i = 0; i < Math.min(n, 6); i++) {
      const b = box(0.45, 0.32, 0.38, mat('#c8a165', { roughness: 0.95 }), this.packageSpot.x + (i % 2) * 0.5, 0.16 + Math.floor(i / 2) * 0.33, this.packageSpot.z + (i % 3) * 0.05, g);
      box(0.46, 0.33, 0.06, mat('#e8d5a8'), b.position.x, b.position.y, b.position.z, g);
    }
    if (n) this.interactables.push({ id: 'package', x: this.packageSpot.x + 0.3, z: this.packageSpot.z + 0.5, r: 1.0, label: `Abrir paquetes (${n})` });
  }

  drawTV(t) {
    const g = this.tvCanvas.getContext('2d');
    const w = 256, h = 144;
    if (!this.tvOn) { g.fillStyle = '#050505'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(20, 10, 60, 120); }
    else {
      const hue = (t * 40) % 360;
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, `hsl(${hue},70%,45%)`); gr.addColorStop(1, `hsl(${(hue + 80) % 360},70%,25%)`);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 5; i++) { g.beginPath(); g.arc((t * 60 + i * 60) % (w + 40) - 20, 70 + Math.sin(t * 3 + i) * 30, 12, 0, 7); g.fill(); }
      g.fillStyle = '#fff'; g.font = 'bold 14px sans-serif'; g.fillText('CANAL 7 · EN VIVO', 10, 20);
    }
    this.tvTex.needsUpdate = true;
  }

  // Luz según hora del día (minuto 0..1440)
  setTimeOfDay(minute) {
    const h = minute / 60;
    const day = Math.max(0, Math.sin(((h - 6) / 14) * Math.PI)); // 6h-20h
    const sky = new THREE.Color();
    if (day > 0.05) sky.setHSL(0.56, 0.6, 0.35 + day * 0.35);
    else sky.setHSL(0.66, 0.5, 0.06);
    if (h > 17.5 && h < 20.5) sky.lerp(new THREE.Color('#ff8c5a'), 0.4 * Math.sin(((h - 17.5) / 3) * Math.PI));
    if (h > 5.5 && h < 7.5) sky.lerp(new THREE.Color('#ffb38a'), 0.4 * Math.sin(((h - 5.5) / 2) * Math.PI));
    this.skyMats.forEach((m) => m.color.copy(sky));
    this.sun.intensity = 0.15 + day * 1.8;
    this.sun.color.setHSL(0.1, 0.5, 0.6 + day * 0.35);
    this.hemi.intensity = 0.25 + day * 0.45;
    const night = 1 - Math.min(1, day * 2.5);
    this.lights.forEach((l) => { l.intensity = 0.4 + night * 5.5; l.userData.fixture.material.emissiveIntensity = 0.2 + night * 1.5; });
    (this.windowLights || []).forEach((l, i) => { l.visible = night > 0.3 && (i % 3 !== 0); });
    return { day, night, sky };
  }

  update(dt, t) {
    if (this.pcModel) spinFans(this.pcModel, dt, 25);
    if (this.fish) this.fish.forEach((f, i) => { const a = t * (0.5 + i * 0.2) + i; f.position.x = 4.1 + Math.sin(a) * 0.35; f.position.z = -5.6 + Math.cos(a * 1.3) * 0.1; f.rotation.y = Math.cos(a) > 0 ? Math.PI : 0; });
    if (this.tvOn) this.drawTV(t);
  }

  // Transparencia de paredes entre cámara y jugador
  updateCutaway(cam, target) {
    for (const w of this.walls) {
      let hide = false;
      if (w.axis === 'z') {
        const a = cam.z - w.pos, b = target.z - w.pos;
        if (a * b < 0) { const k = a / (a - b); const x = cam.x + (target.x - cam.x) * k; hide = x > w.min - 0.6 && x < w.max + 0.6; }
      } else {
        const a = cam.x - w.pos, b = target.x - w.pos;
        if (a * b < 0) { const k = a / (a - b); const z = cam.z + (target.z - cam.z) * k; hide = z > w.min - 0.6 && z < w.max + 0.6; }
      }
      const tgt = hide ? 0.12 : 1;
      w.mat.opacity += (tgt - w.mat.opacity) * 0.2;
      w.mat.depthWrite = w.mat.opacity > 0.9;
    }
  }
}

// NPC decorativo simple (se usa en la calle)
export function makeNPC(look) { return new Character(look); }
