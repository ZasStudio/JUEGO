// Personaje 3D low-poly personalizable y animado de forma procedural.
import * as THREE from 'three';
import { mat, box, sphere, capsule, cyl } from './util.js';

export const LOOK_OPTIONS = {
  skin: ['#ffe0c4', '#f5c9a0', '#e0ac7e', '#c68a5a', '#8d5a3a', '#5c3a26'],
  hairStyle: ['corto', 'largo', 'cresta', 'coleta', 'rizado', 'moño', 'gorra', 'calvo'],
  hairColor: ['#1b1b1b', '#4a2c17', '#8b5a2b', '#d9b86c', '#e8e8e8', '#c0392b', '#8e44ad', '#2e86de', '#16a085', '#ff6fa8'],
  shirtStyle: ['camiseta', 'sudadera', 'camisa'],
  shirtColor: ['#2d3436', '#e84393', '#0984e3', '#00b894', '#fdcb6e', '#d63031', '#6c5ce7', '#ffffff', '#ff7f11', '#1e272e'],
  pantsColor: ['#2d3436', '#1e3799', '#57606f', '#6ab04c', '#b33939', '#dcdde1', '#3d2b1f'],
  shoesColor: ['#f5f6fa', '#1e272e', '#e84118', '#0097e6', '#fbc531'],
  eyeColor: ['#2d1b0e', '#1e6fb5', '#2e8b57', '#6b4226', '#7f8fa6'],
};

export function defaultLook() {
  return {
    skin: '#f5c9a0', hairStyle: 'corto', hairColor: '#4a2c17', shirtStyle: 'sudadera', shirtColor: '#6c5ce7',
    pantsColor: '#2d3436', shoesColor: '#f5f6fa', eyeColor: '#2d1b0e', glasses: false, beard: false, headset: true,
    height: 1, build: 1,
  };
}
export function randomLook() {
  const r = (a) => a[Math.floor(Math.random() * a.length)];
  const o = LOOK_OPTIONS;
  return {
    skin: r(o.skin), hairStyle: r(o.hairStyle), hairColor: r(o.hairColor), shirtStyle: r(o.shirtStyle), shirtColor: r(o.shirtColor),
    pantsColor: r(o.pantsColor), shoesColor: r(o.shoesColor), eyeColor: r(o.eyeColor), glasses: Math.random() < 0.3,
    beard: Math.random() < 0.25, headset: Math.random() < 0.5, height: 0.92 + Math.random() * 0.16, build: 0.9 + Math.random() * 0.25,
  };
}

export class Character {
  constructor(look) {
    this.group = new THREE.Group();
    this.look = { ...defaultLook(), ...look };
    this.pose = 'idle';
    this.t = 0;
    this.blinkT = 2;
    this.emote = null; this.emoteT = 0;
    this.build();
  }

  build() {
    const L = this.look;
    const g = this.group;
    while (g.children.length) g.remove(g.children[0]);
    const skin = mat(L.skin, { roughness: 0.6 });
    const shirt = mat(L.shirtColor, { roughness: 0.85 });
    const pants = mat(L.pantsColor, { roughness: 0.9 });
    const shoes = mat(L.shoesColor, { roughness: 0.6 });
    const hair = mat(L.hairColor, { roughness: 0.9 });

    const root = new THREE.Group();
    root.scale.set(L.build, L.height, L.build);
    g.add(root);
    this.root = root;

    // Cadera
    const hips = new THREE.Group(); hips.position.y = 0.86; root.add(hips); this.hips = hips;
    box(0.36, 0.16, 0.2, pants, 0, 0, 0, hips);

    // Piernas (muslo + pierna con rodilla)
    const mkLeg = (side) => {
      const hip = new THREE.Group(); hip.position.set(0.1 * side, -0.02, 0); hips.add(hip);
      const thigh = capsule(0.075, 0.28, pants, hip); thigh.position.y = -0.2;
      const knee = new THREE.Group(); knee.position.y = -0.4; hip.add(knee);
      const shin = capsule(0.065, 0.28, pants, knee); shin.position.y = -0.2;
      const shoe = box(0.13, 0.08, 0.24, shoes, 0, -0.42, 0.04, knee);
      shoe.geometry.translate(0, 0, 0);
      return { hip, knee };
    };
    this.legL = mkLeg(1); this.legR = mkLeg(-1);

    // Torso
    const torso = new THREE.Group(); torso.position.y = 0.06; hips.add(torso); this.torso = torso;
    const chest = capsule(0.19, 0.22, shirt, torso); chest.position.y = 0.28; chest.scale.set(1.05, 1, 0.68);
    if (L.shirtStyle === 'sudadera') {
      const hood = sphere(0.14, shirt, 0, 0.5, -0.1, torso, 12); hood.scale.set(1.3, 0.7, 0.8);
      box(0.2, 0.08, 0.02, mat('#000000', { transparent: true, opacity: 0.25 }), 0, 0.18, 0.13, torso);
      cyl(0.006, 0.006, 0.14, mat('#eeeeee'), -0.04, 0.38, 0.13, torso, 6);
      cyl(0.006, 0.006, 0.14, mat('#eeeeee'), 0.04, 0.38, 0.13, torso, 6);
    } else if (L.shirtStyle === 'camisa') {
      box(0.02, 0.36, 0.01, mat('#ffffff'), 0, 0.28, 0.135, torso);
      const col = box(0.2, 0.05, 0.16, mat('#ffffff'), 0, 0.5, 0.0, torso);
      col.rotation.x = 0.1;
    } else {
      box(0.14, 0.1, 0.01, mat('#ffffff', { roughness: 1 }), 0, 0.32, 0.135, torso); // estampado
    }

    // Brazos
    const mkArm = (side) => {
      const sh = new THREE.Group(); sh.position.set(0.25 * side, 0.46, 0); torso.add(sh);
      const up = capsule(0.06, 0.2, shirt, sh); up.position.y = -0.14;
      const elbow = new THREE.Group(); elbow.position.y = -0.3; sh.add(elbow);
      const fore = capsule(0.052, 0.18, L.shirtStyle === 'camiseta' ? skin : shirt, elbow); fore.position.y = -0.12;
      const hand = sphere(0.06, skin, 0, -0.27, 0, elbow, 10); hand.scale.set(0.9, 1.1, 0.8);
      sh.rotation.z = 0.08 * side;
      return { sh, elbow };
    };
    this.armL = mkArm(1); this.armR = mkArm(-1);

    // Cabeza
    const neck = new THREE.Group(); neck.position.y = 0.56; torso.add(neck); this.neck = neck;
    cyl(0.06, 0.07, 0.1, skin, 0, 0.02, 0, neck, 10);
    const head = new THREE.Group(); head.position.y = 0.2; neck.add(head); this.head = head;
    const skull = sphere(0.19, skin, 0, 0, 0, head, 24); skull.scale.set(1, 1.08, 1);
    sphere(0.04, skin, 0.18, 0, 0, head, 8).scale.set(0.5, 1, 1);
    sphere(0.04, skin, -0.18, 0, 0, head, 8).scale.set(0.5, 1, 1);
    sphere(0.03, mat(L.skin, { roughness: 0.5 }), 0, -0.02, 0.19, head, 8); // nariz

    // Ojos
    const white = mat('#ffffff', { roughness: 0.3 });
    const iris = mat(L.eyeColor, { roughness: 0.2 });
    this.eyes = [];
    for (const s of [1, -1]) {
      const e = new THREE.Group(); e.position.set(0.07 * s, 0.03, 0.165); head.add(e);
      const w = sphere(0.035, white, 0, 0, 0, e, 12); w.scale.set(1, 1.15, 0.5);
      const ir = sphere(0.02, iris, 0, 0, 0.012, e, 10); ir.scale.set(1, 1, 0.5);
      sphere(0.009, mat('#000000'), 0, 0, 0.02, e, 6);
      this.eyes.push(e);
      const brow = box(0.07, 0.014, 0.02, hair, 0.07 * s, 0.1, 0.175, head);
      brow.rotation.z = -0.1 * s;
    }
    this.mouth = box(0.07, 0.014, 0.02, mat('#7a3b3b'), 0, -0.09, 0.172, head);

    if (L.beard) {
      const b = sphere(0.16, hair, 0, -0.08, 0.04, head, 16); b.scale.set(1.05, 0.7, 1);
      this.mouth.position.z = 0.19;
    }
    if (L.glasses) {
      const fr = mat('#111111', { metalness: 0.4, roughness: 0.3 });
      const lens = new THREE.MeshStandardMaterial({ color: '#99ccff', transparent: true, opacity: 0.25, roughness: 0.1 });
      for (const s of [1, -1]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 16), fr);
        ring.position.set(0.07 * s, 0.03, 0.2); head.add(ring);
        const l = new THREE.Mesh(new THREE.CircleGeometry(0.043, 16), lens); l.position.set(0.07 * s, 0.03, 0.199); head.add(l);
        box(0.08, 0.01, 0.01, fr, 0.15 * s, 0.04, 0.14, head).rotation.y = 1.3 * s;
      }
      box(0.05, 0.01, 0.01, fr, 0, 0.04, 0.2, head);
    }

    this.buildHair(head, hair, L.hairStyle);

    if (L.headset) {
      const hs = mat('#1a1a1a', { roughness: 0.4 });
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.018, 8, 24, Math.PI), hs);
      band.position.y = 0.02; head.add(band);
      for (const s of [1, -1]) {
        const cup = cyl(0.07, 0.07, 0.05, hs, 0.2 * s, 0, 0, head, 16); cup.rotation.z = Math.PI / 2;
        const ring = cyl(0.055, 0.055, 0.052, mat(this.look.shirtColor, { emissive: this.look.shirtColor, emissiveIntensity: 0.4 }), 0.2 * s, 0, 0, head, 16);
        ring.rotation.z = Math.PI / 2; ring.scale.set(1, 1.02, 1);
      }
      const micArm = cyl(0.006, 0.006, 0.2, hs, 0.16, -0.08, 0.1, head, 6);
      micArm.rotation.set(1.2, 0, 0.6);
      sphere(0.018, hs, 0.1, -0.12, 0.18, head, 8);
    }

    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  buildHair(head, hair, style) {
    const cap = (sx = 1.06, sy = 1.0, sz = 1.06, y = 0.03) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
      m.scale.set(sx, sy, sz); m.position.y = y; m.rotation.x = -0.25; head.add(m); return m;
    };
    switch (style) {
      case 'corto': cap(); box(0.3, 0.06, 0.1, hair, 0, 0.14, 0.14, head).rotation.x = 0.4; break;
      case 'largo': {
        cap(1.08, 1.02, 1.08);
        const back = box(0.38, 0.42, 0.14, hair, 0, -0.1, -0.12, head);
        back.geometry.translate(0, 0, 0);
        box(0.08, 0.36, 0.16, hair, 0.18, -0.1, 0.0, head);
        box(0.08, 0.36, 0.16, hair, -0.18, -0.1, 0.0, head);
        box(0.3, 0.07, 0.1, hair, 0, 0.15, 0.13, head).rotation.x = 0.5;
        break;
      }
      case 'cresta': {
        for (let i = 0; i < 5; i++) {
          const c = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 6), hair);
          c.position.set(0, 0.2 - Math.abs(i - 1) * 0.015, 0.12 - i * 0.07); c.rotation.x = -0.3 + i * 0.15; head.add(c);
        }
        break;
      }
      case 'coleta': {
        cap(1.06, 1, 1.06);
        const tail = capsule(0.06, 0.22, hair, head); tail.position.set(0, -0.02, -0.26); tail.rotation.x = 0.5;
        sphere(0.05, mat('#ff4d6d'), 0, 0.08, -0.2, head, 8);
        break;
      }
      case 'rizado': {
        for (let i = 0; i < 26; i++) {
          const a = Math.random() * Math.PI * 2, b = Math.random() * 1.2;
          const x = Math.sin(a) * Math.sin(b) * 0.2, y = Math.cos(b) * 0.2 + 0.03, z = Math.cos(a) * Math.sin(b) * 0.2 - 0.02;
          if (z > 0.12 && y < 0.12) continue;
          sphere(0.07, hair, x, y, z, head, 8);
        }
        break;
      }
      case 'moño': {
        cap(1.04, 0.96, 1.04);
        sphere(0.09, hair, 0, 0.23, -0.06, head, 12);
        break;
      }
      case 'gorra': {
        cap(1.02, 0.9, 1.02, 0.0);
        const c = mat(this.look.shirtColor, { roughness: 0.7 });
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), c);
        crown.position.y = 0.05; head.add(crown);
        const visor = cyl(0.14, 0.14, 0.02, c, 0, 0.07, 0.2, head, 20); visor.scale.set(1, 1, 0.7);
        break;
      }
      default: break;
    }
  }

  setLook(look) { this.look = { ...this.look, ...look }; this.build(); }
  setPose(p) { if (this.pose !== p) { this.pose = p; this.t = 0; } }
  doEmote(name, dur = 1.2) { this.emote = name; this.emoteT = dur; }

  update(dt, speed = 0) {
    this.t += dt;
    const t = this.t;
    const lerpR = (obj, axis, target, k = 12) => { obj.rotation[axis] += (target - obj.rotation[axis]) * Math.min(1, dt * k); };

    // Parpadeo
    this.blinkT -= dt;
    const blink = this.blinkT < 0.12;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3;
    this.eyes.forEach((e) => { e.scale.y = blink ? 0.1 : 1; });

    let legA = 0, kneeA = 0, armA = 0, elbowA = -0.15, torsoX = 0, hipsY = 0.86, rootRX = 0, headX = 0, headY = 0;
    let armZL = 0.08, armZR = -0.08, armXL = null, armXR = null;
    switch (this.pose) {
      case 'walk': {
        const f = speed > 3 ? 11 : 8;
        const amp = Math.min(0.9, 0.35 + speed * 0.12);
        legA = Math.sin(t * f) * amp;
        kneeA = Math.max(0, -Math.cos(t * f)) * amp * 0.9;
        armA = -Math.sin(t * f) * amp * 0.8;
        hipsY = 0.86 + Math.abs(Math.cos(t * f)) * 0.03;
        torsoX = speed > 3 ? 0.12 : 0.04;
        if (Math.sin(t * f) * Math.sin((t - dt) * f) < 0) this.onStep?.();
        break;
      }
      case 'sit': case 'type': case 'game': {
        hipsY = 0.52;
        lerpR(this.legL.hip, 'x', -1.5); lerpR(this.legR.hip, 'x', -1.5);
        lerpR(this.legL.knee, 'x', 1.5); lerpR(this.legR.knee, 'x', 1.5);
        armXL = -1.0 + (this.pose !== 'sit' ? Math.sin(t * 18) * 0.05 : 0);
        armXR = -1.0 + (this.pose !== 'sit' ? Math.sin(t * 15 + 1) * 0.08 : 0);
        elbowA = -0.6;
        torsoX = 0.08;
        headX = 0.05 + (this.pose === 'game' ? Math.sin(t * 2) * 0.03 : 0);
        headY = this.pose === 'game' ? Math.sin(t * 0.7) * 0.15 : 0;
        break;
      }
      case 'sleep': {
        rootRX = -Math.PI / 2; hipsY = 0.86;
        break;
      }
      case 'couch': {
        hipsY = 0.5; torsoX = -0.2;
        lerpR(this.legL.hip, 'x', -1.4); lerpR(this.legR.hip, 'x', -1.4);
        lerpR(this.legL.knee, 'x', 1.4); lerpR(this.legR.knee, 'x', 1.4);
        armZL = 0.3; armZR = -0.3;
        break;
      }
      case 'work': {
        armXL = -0.9 + Math.sin(t * 6) * 0.2; armXR = -0.9 + Math.cos(t * 6) * 0.2; elbowA = -0.8; headX = 0.35; torsoX = 0.15;
        break;
      }
      case 'eat': {
        armXR = -1.8 + Math.sin(t * 8) * 0.3; elbowA = -1.4; headX = 0.1;
        break;
      }
      default: { // idle
        armA = Math.sin(t * 1.5) * 0.03;
        hipsY = 0.86 + Math.sin(t * 2) * 0.005;
        headY = Math.sin(t * 0.5) * 0.2;
      }
    }

    if (!['sit', 'type', 'game', 'couch'].includes(this.pose)) {
      lerpR(this.legL.hip, 'x', legA); lerpR(this.legR.hip, 'x', -legA);
      lerpR(this.legL.knee, 'x', this.pose === 'walk' ? kneeA : 0);
      lerpR(this.legR.knee, 'x', this.pose === 'walk' ? Math.max(0, Math.cos(t * 8)) * 0.4 : 0);
    }
    lerpR(this.armL.sh, 'x', armXL ?? armA); lerpR(this.armR.sh, 'x', armXR ?? -armA);
    lerpR(this.armL.sh, 'z', armZL); lerpR(this.armR.sh, 'z', armZR);
    lerpR(this.armL.elbow, 'x', elbowA); lerpR(this.armR.elbow, 'x', elbowA);
    lerpR(this.torso, 'x', torsoX);
    lerpR(this.root, 'x', rootRX, 6);
    this.hips.position.y += (hipsY - this.hips.position.y) * Math.min(1, dt * 12);

    // Emotes
    if (this.emoteT > 0) {
      this.emoteT -= dt;
      if (this.emote === 'wave') { this.armR.sh.rotation.x = -2.6; this.armR.sh.rotation.z = -0.4 + Math.sin(t * 14) * 0.4; }
      if (this.emote === 'cheer') { this.armR.sh.rotation.x = -2.9; this.armL.sh.rotation.x = -2.9; this.hips.position.y += Math.abs(Math.sin(t * 10)) * 0.02; }
      if (this.emote === 'scare') { headX = -0.3; this.armR.sh.rotation.x = -2; this.armL.sh.rotation.x = -2; }
      if (this.emote === 'facepalm') { this.armR.sh.rotation.x = -2.2; this.armR.elbow.rotation.x = -1.8; headX = 0.4; }
    }
    lerpR(this.head, 'x', headX, 8); lerpR(this.head, 'y', headY, 4);
    this.mouth.scale.x = this.emote === 'cheer' && this.emoteT > 0 ? 1.4 : 1;
    this.mouth.scale.y = (this.emote === 'scare' || this.emote === 'cheer') && this.emoteT > 0 ? 4 : 1;
  }
}
