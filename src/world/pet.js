// Mascota 3D (gato o perro) que pasea por el apartamento.
import * as THREE from 'three';
import { mat, box, sphere, cyl } from './util.js';

const SPOTS = [[-2, -2], [0.5, 1.2], [-3, 2], [2.5, -2.5], [-1, 4.3], [3, 0.5], [-6, 1.5], [5.5, -1], [-4, -3]];

export class Pet {
  constructor(type = 'cat', color = '#e0a458') {
    this.type = type;
    this.group = new THREE.Group();
    this.target = new THREE.Vector3(...[SPOTS[0][0], 0, SPOTS[0][1]]);
    this.wait = 2;
    this.t = 0;
    this.build(color);
    this.group.position.set(-1, 0, 1);
  }
  build(color) {
    const g = this.group;
    const fur = mat(color, { roughness: 0.95 });
    const dark = mat('#2b2b2b');
    const dog = this.type === 'dog';
    const s = dog ? 1.25 : 1;
    const body = sphere(0.16 * s, fur, 0, 0.25 * s, 0, g, 14); body.scale.set(0.85, 0.8, 1.6);
    const head = new THREE.Group(); head.position.set(0, 0.38 * s, 0.26 * s); g.add(head); this.head = head;
    sphere(0.11 * s, fur, 0, 0, 0, head, 14);
    if (dog) {
      const snout = sphere(0.06 * s, fur, 0, -0.03, 0.1 * s, head, 10); snout.scale.set(1, 0.8, 1.3);
      sphere(0.022, dark, 0, -0.01, 0.17 * s, head, 8);
      for (const x of [-1, 1]) { const ear = box(0.05, 0.12, 0.03, mat('#8d5b3a'), 0.09 * x, 0.02, -0.02, head); ear.rotation.z = 0.3 * x; }
    } else {
      for (const x of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, 4), fur); ear.position.set(0.06 * x, 0.1, 0); head.add(ear); }
      sphere(0.015, mat('#ff8fa3'), 0, -0.02, 0.105, head, 6);
      for (const x of [-1, 1]) for (const k of [-1, 1]) { const w = box(0.08, 0.004, 0.004, mat('#ffffff'), 0.07 * x, -0.03 + k * 0.01, 0.08, head); w.rotation.z = 0.15 * k * x; }
    }
    for (const x of [-1, 1]) { sphere(0.022, mat('#ffffff'), 0.045 * x, 0.03, 0.09 * s, head, 8); sphere(0.013, dark, 0.045 * x, 0.03, 0.105 * s, head, 6); }
    this.legs = [];
    for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const pivot = new THREE.Group(); pivot.position.set(0.08 * x * s, 0.2 * s, 0.14 * z * s); g.add(pivot);
      const leg = cyl(0.03 * s, 0.028 * s, 0.2 * s, fur, 0, -0.1 * s, 0, pivot, 8);
      leg.castShadow = true;
      this.legs.push(pivot);
    }
    this.tail = new THREE.Group(); this.tail.position.set(0, 0.3 * s, -0.24 * s); g.add(this.tail);
    const tl = cyl(0.02, 0.015, dog ? 0.18 : 0.3, fur, 0, dog ? 0.09 : 0.15, 0, this.tail, 8);
    this.tail.rotation.x = dog ? -0.6 : -0.3;
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }
  update(dt, playerPos, active) {
    this.t += dt;
    const g = this.group;
    const toT = new THREE.Vector3().subVectors(this.target, g.position); toT.y = 0;
    const d = toT.length();
    let moving = false;
    if (this.wait > 0) this.wait -= dt;
    else if (d > 0.15) {
      const sp = this.type === 'dog' ? 1.3 : 1.0;
      toT.normalize();
      g.position.addScaledVector(toT, Math.min(d, sp * dt));
      const ang = Math.atan2(toT.x, toT.z);
      let da = ang - g.rotation.y; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      g.rotation.y += da * Math.min(1, dt * 8);
      moving = true;
    } else {
      this.wait = 2 + Math.random() * 5;
      if (playerPos && active && Math.random() < 0.4) this.target.set(playerPos.x + (Math.random() - 0.5), 0, playerPos.z + 0.8);
      else { const p = SPOTS[Math.floor(Math.random() * SPOTS.length)]; this.target.set(p[0], 0, p[1]); }
    }
    this.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(this.t * 12 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.6 : 0; });
    this.tail.rotation.z = Math.sin(this.t * (this.type === 'dog' ? 12 : 3)) * (this.type === 'dog' ? 0.6 : 0.3);
    this.head.rotation.y = moving ? 0 : Math.sin(this.t * 0.8) * 0.4;
  }
}
