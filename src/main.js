// Streamer Life 3D - punto de entrada: render, bucle de juego, jugador, cámara e interacciones.
import * as THREE from 'three';
import './style.css';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { S, setState, newState, save, loadSave, hasSave, deleteSave, bus, notify, clamp, now, addMoney, addXP, skill, fmtMoney, fmtClock, rand, randi, lerp, SKILL_NAMES } from './core/state.js';
import { sfx, startMusic, setVolume } from './core/audio.js';
import { Character } from './world/character.js';
import { Apartment } from './world/apartment.js';
import { Street, STREET_ORIGIN } from './world/street.js';
import { mat, box, cyl, glow } from './world/util.js';
import { updateTrends, GAME } from './data/games.js';
import { FOOD, MEAL, BOOKS, peripheral } from './data/items.js';
import { PARTS, part, partsBySlot, SLOT_ORDER, SLOT_NAMES, SLOT_ICONS, partDesc } from './data/parts.js';
import { QUESTS } from './data/progress.js';
import { sim, tick, realtimeTick, refreshDerived, eat, applyFood, openPackages, pushEmail, makeJobEmail, checkProgress, receiveItems, mood } from './game/sim.js';
import { StreamSession } from './game/stream.js';
import { PETS, BARISTA, LABELS, randomOrder, isBanned } from './game/extras.js';
import { Pet } from './world/pet.js';
import { h, $, clear, btn, bar } from './ui/dom.js';
import { initHUD, showHUD, updateHUD, setPrompt, toast, bigMessage, fade, modal, modalOpen, closeTopModal, choose, progressOverlay, skillsPanel, moodText } from './ui/hud.js';
import { openComputer, closeComputer, computerOpen, computerBack } from './ui/computer.js';
import { openStreamUI, closeStreamUI, streamFrame, streamMinute, streamUI } from './ui/streamui.js';
import { openBench, closeBench, benchOpen } from './ui/bench.js';
import { openCreator } from './ui/creator.js';

// ---------------- Render ----------------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 400);
let scene = null;

// Postprocesado: bloom para LEDs, neones y pantallas
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
const renderPass = new RenderPass(null, camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.45, 1.7);
composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(new OutputPass());
let hiQuality = true;
function draw(sc) {
  if (hiQuality) { renderPass.scene = sc; composer.render(); } else renderer.render(sc, camera);
}
// Reflejos de entorno (metales, vidrio, pantallas)
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

function resize() {
  const w = window.innerWidth, hh = window.innerHeight;
  renderer.setSize(w, hh, false);
  composer.setSize(w, hh); composer.setPixelRatio(renderer.getPixelRatio());
  camera.aspect = w / hh; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Cámara web del directo (renderizador aparte)
const faceRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
faceRenderer.setSize(320, 240); faceRenderer.setPixelRatio(1);
faceRenderer.toneMapping = THREE.ACESFilmicToneMapping;
faceRenderer.domElement.className = 'facecam-canvas';
const faceCam = new THREE.PerspectiveCamera(45, 4 / 3, 0.05, 20);

// ---------------- Escena de menú (vitrina) ----------------
const showroom = new THREE.Scene();
showroom.background = new THREE.Color('#120d1f');
showroom.fog = new THREE.Fog('#120d1f', 8, 20);
{
  const ped = cyl(1.1, 1.2, 0.3, mat('#1e1633', { roughness: 0.4, metalness: 0.4 }), 0, 0.15, 0, showroom, 48);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.03, 8, 64), glow('#9146ff', 3)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; showroom.add(ring);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(20, 48), mat('#0d0a17', { roughness: 0.6 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; showroom.add(floor);
  showroom.add(new THREE.HemisphereLight('#b9a3ff', '#1a1030', 0.8));
  const key = new THREE.SpotLight('#ffffff', 60, 15, 0.6, 0.5, 1.5); key.position.set(3, 6, 4); key.castShadow = true; showroom.add(key);
  const rim = new THREE.PointLight('#e84393', 20, 8); rim.position.set(-3, 3, -2); showroom.add(rim);
  const rim2 = new THREE.PointLight('#00e5ff', 15, 8); rim2.position.set(3, 2, -3); showroom.add(rim2);
  for (let i = 0; i < 40; i++) { const s = box(0.05, 0.05, 0.05, glow(['#9146ff', '#00e5ff', '#e84393'][i % 3], 3), rand(-8, 8), rand(0.5, 6), rand(-10, -3), showroom); s.castShadow = false; }
}
const showChar = new Character();
showChar.group.position.y = 0.3;
showroom.add(showChar.group);

// ---------------- Mundo de juego ----------------
const world = new THREE.Scene();
world.background = new THREE.Color('#0f1016');
world.environment = envTex;
world.environmentIntensity = 0.35;
showroom.environment = envTex;
showroom.environmentIntensity = 0.4;
let apt = null, street = null, player = null;
const P = { pos: new THREE.Vector3(-2, 0, -2), rotY: 0, vel: new THREE.Vector3(), yaw: Math.PI * 0.85, pitch: 0.55, dist: 6.5 };
let mode = 'menu'; // menu | creator | walk | pc | stream | bench | busy | paused
let session = null;
let paused = false;
const keys = {};

function buildWorld() {
  apt = new Apartment(world);
  street = new Street(world);
  player = new Character(S.player.look);
  player.onStep = () => { if (Math.random() < 0.5) sfx.step(); };
  world.add(player.group);
  refreshAll();
}

let pet = null;
function refreshPet() {
  if (pet) { world.remove(pet.group); pet = null; }
  if (S.pet) { pet = new Pet(S.pet.type, S.pet.color); world.add(pet.group); }
}

function refreshAll() {
  refreshDerived();
  apt.refreshPC(S);
  apt.refreshPeripherals(S);
  apt.refreshDeco(S);
  apt.refreshPackages(S);
  apt.refreshBench(S);
}

bus.on('packages', () => apt && apt.refreshPackages(S));
bus.on('inventory', () => { if (!apt) return; apt.refreshPeripherals(S); apt.refreshDeco(S); });
bus.on('deco', () => apt && apt.refreshDeco(S));
bus.on('pc', () => { if (apt) { apt.refreshPC(S); apt.refreshBench(S); } });
bus.on('led', () => { if (apt) { apt.refreshPC(S); apt.refreshPeripherals(S); apt.refreshDeco(S); apt.refreshBench(S); } });
bus.on('skiptime', (m) => tick(m));
bus.on('hour', () => { save(); });
bus.on('faint', () => faint());
bus.on('gameover', (why) => gameOver(why));
bus.on('email', (m) => { if (mode !== 'menu') { toast(`✉️ Nuevo correo: ${m.subject}`, 'info'); sfx.notify(); } });

// ---------------- Entrada ----------------
let dragging = false, lastX = 0, lastY = 0;
canvas.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  if (mode === 'creator' || mode === 'menu') { showChar.group.rotation.y += dx * 0.01; return; }
  P.yaw -= dx * 0.006;
  P.pitch = clamp(P.pitch + dy * 0.004, 0.12, 1.35);
});
canvas.addEventListener('wheel', (e) => { P.dist = clamp(P.dist + e.deltaY * 0.004, 2.2, 11); }, { passive: true });
// Soporte táctil básico
let touch = null;
canvas.addEventListener('touchstart', (e) => { const t = e.touches[0]; touch = { x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY }; }, { passive: true });
canvas.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (!touch) return; P.yaw -= (t.clientX - touch.x) * 0.006; P.pitch = clamp(P.pitch + (t.clientY - touch.y) * 0.004, 0.12, 1.35); touch.x = t.clientX; touch.y = t.clientY; }, { passive: true });
canvas.addEventListener('touchend', () => { touch = null; });

window.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  keys[e.code] = true;
  if (e.code === 'Escape') { e.preventDefault(); onEscape(); }
  if (mode === 'walk' && !modalOpen()) {
    if (e.code === 'KeyE') interact();
    if (e.code === 'Tab') { e.preventDefault(); openPhone(); }
  } else if (e.code === 'Tab') e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

function onEscape() {
  if (modalOpen()) { closeTopModal(); return; }
  if (mode === 'pc') { if (!computerBack()) closeComputer(); return; }
  if (mode === 'bench') { closeBench(); return; }
  if (mode === 'walk') openPauseMenu();
}

// ---------------- Menú principal ----------------
function mainMenu() {
  mode = 'menu'; scene = showroom;
  showHUD(false);
  const root = h('div#mainmenu', {},
    h('div.mm-logo', {}, h('div.mm-title', {}, 'STREAMER', h('span', {}, 'LIFE'), ' 3D'), h('div.mm-sub', {}, 'De streamer novato a leyenda del directo')),
    h('div.mm-buttons', {},
      hasSave() ? btn('▶ Continuar', () => { const s = loadSave(); if (!s) { toast('No se pudo cargar la partida', 'bad'); return; } root.remove(); startGame(s); }, 'big good') : null,
      btn('✨ Nueva partida', () => {
        if (hasSave()) {
          modal({ title: '¿Empezar de cero?', content: h('p', {}, 'Se borrará tu partida guardada.'), actions: [{ text: 'Cancelar' }, { text: 'Sí, nueva partida', cls: 'danger', fn: () => { deleteSave(); root.remove(); creator(); } }] });
        } else { root.remove(); creator(); }
      }, 'big'),
      btn('🎮 Cómo se juega', () => howToPlay()),
    ),
    h('div.mm-foot', {}, 'Hecho con Three.js · Todo el juego es 3D y generado por código'),
  );
  $('#ui').appendChild(root);
}

function howToPlay() {
  modal({
    title: '🎮 Cómo se juega', wide: true,
    content: h('div.howto', {},
      h('p', {}, 'Eres un streamer que empieza desde cero en un pequeño apartamento. Tu meta: llegar a 100.000 seguidores sin quedarte sin dinero para la renta.'),
      h('h4', {}, 'Controles'),
      h('ul', {}, h('li', {}, 'WASD / Flechas: moverse · Shift: correr'), h('li', {}, 'Arrastrar con el ratón: girar la cámara · Rueda: zoom'), h('li', {}, 'E: interactuar con objetos · Tab: teléfono · Esc: menú / volver')),
      h('h4', {}, 'Bucle de juego'),
      h('ul', {},
        h('li', {}, '📡 Transmite desde tu PC (app Streamix): elige juego, título y resolución. Analiza tendencias y competencia.'),
        h('li', {}, '🎮 Durante el directo: haz jugadas (minijuegos), responde preguntas, agradece donaciones, banea trolls, pon anuncios y menciona patrocinadores.'),
        h('li', {}, '🔧 Gana dinero armando y reparando PCs para clientes en el banco de trabajo (pedidos en el Correo).'),
        h('li', {}, '🧩 Compra piezas y arma tu propia PC más potente: mejor calidad, más juegos, más espectadores.'),
        h('li', {}, '🎬 Edita tus VODs en VidCut y sube videos/shorts para crecer mientras duermes.'),
        h('li', {}, '🍕 Cuida tus necesidades: comer, dormir, ducharte y divertirte. Tu ánimo afecta tus directos.'),
        h('li', {}, '🏠 Paga la renta cada 7 días. ¡Tres semanas sin pagar y te desalojan!'),
      ),
    ),
    actions: [{ text: '¡Entendido!', cls: 'good' }],
  });
}

function creator() {
  mode = 'creator';
  scene = showroom;
  openCreator({
    character: showChar,
    onBack: () => mainMenu(),
    onDone: (pl) => {
      const s = newState(pl);
      updateTrends(s, true);
      startGame(s, true);
    },
  });
}

// ---------------- Inicio de partida ----------------
function startGame(state, fresh = false) {
  if (!apt) {
    const ld = h('div.loading', {}, h('div.ld-spin'), h('div', {}, 'Construyendo el mundo 3D y sus texturas...'));
    $('#ui').appendChild(ld);
    setTimeout(() => { startGameNow(state, fresh); ld.remove(); }, 60);
    return;
  }
  startGameNow(state, fresh);
}
function startGameNow(state, fresh) {
  setState(state);
  setVolume(S.settings.volume);
  hiQuality = S.settings.hiQuality !== false;
  if (!apt) buildWorld();
  else { player.setLook(S.player.look); refreshAll(); }
  refreshPet();
  if (!Object.keys(S.trends).length) updateTrends(S, true);
  scene = world;
  S.location = 'home';
  P.pos.set(-2, 0, -2); P.rotY = Math.PI; P.yaw = Math.PI * 0.85;
  player.group.position.copy(P.pos);
  mode = 'walk';
  showHUD(true);
  startMusic();
  if (fresh) {
    pushEmail({ from: 'Streamix', subject: '¡Bienvenido a Streamix! 💜', body: `Hola ${S.player.name},\n\nTu canal "${S.player.channel}" ya está creado. Empieza a transmitir desde la app Streamix.\n\nConsejos:\n• Transmite entre las 17:00 y 23:00 para tener más audiencia.\n• Los juegos muy populares tienen mucha competencia.\n• Llega a 50 seguidores y 3 directos para ser Afiliado.\n\n¡Mucha suerte!` });
    pushEmail(makeJobEmail('repair'));
    pushEmail(makeJobEmail('build'));
    pushEmail({ from: 'Café Byte · Don Ramón', subject: 'Sobre tu despido...', body: `${S.player.name}, sé que te despedí por jugar en el celular durante tu turno 😅\n\nSi necesitas dinero mientras creces como streamer, pasa por Café Byte (sal a la calle) y cubre turnos de barista de medio tiempo.\n\n¡Suerte con eso del stream!` });
    setTimeout(() => bigMessage('Te despidieron del café ☕', `Hoy ${S.player.name} apuesta todo por ser streamer. Sigue las misiones de la esquina superior derecha.`), 600);
    save();
  }
  updateHUD();
}

// ---------------- Jugador ----------------
function colliders() { return S.location === 'home' ? apt.colliders : street.colliders; }
function interactables() {
  if (S.location !== 'home') return street.interactables;
  if (!pet) return apt.interactables;
  return [...apt.interactables, { id: 'pet', x: pet.group.position.x, z: pet.group.position.z, r: 0.5, label: `${S.pet.name} (${S.pet.type === 'cat' ? 'gato' : 'perro'})` }];
}

function movePlayer(dt) {
  let ix = 0, iz = 0;
  if (keys.KeyW || keys.ArrowUp) iz -= 1;
  if (keys.KeyS || keys.ArrowDown) iz += 1;
  if (keys.KeyA || keys.ArrowLeft) ix -= 1;
  if (keys.KeyD || keys.ArrowRight) ix += 1;
  const run = keys.ShiftLeft || keys.ShiftRight;
  const tired = S.needs.energy < 15 ? 0.7 : 1;
  const speed = (run ? 5.2 : 2.8) * tired;
  let moving = false;
  if (ix || iz) {
    const len = Math.hypot(ix, iz); ix /= len; iz /= len;
    // relativo a la cámara
    const sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
    const dx = ix * cos + iz * sin;
    const dz = -ix * sin + iz * cos;
    P.pos.x += dx * speed * dt; P.pos.z += dz * speed * dt;
    const target = Math.atan2(dx, dz);
    let d = target - P.rotY; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    P.rotY += d * Math.min(1, dt * 12);
    moving = true;
  }
  // Colisiones círculo vs AABB
  const r = 0.28;
  for (let it = 0; it < 2; it++) {
    for (const c of colliders()) {
      const cx = clamp(P.pos.x, c.minX, c.maxX), cz = clamp(P.pos.z, c.minZ, c.maxZ);
      const dx = P.pos.x - cx, dz = P.pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) { const d = Math.sqrt(d2); P.pos.x += (dx / d) * (r - d); P.pos.z += (dz / d) * (r - d); }
        else { // dentro: empujar por el eje mínimo
          const pens = [[P.pos.x - c.minX + r, -1, 0], [c.maxX - P.pos.x + r, 1, 0], [P.pos.z - c.minZ + r, 0, -1], [c.maxZ - P.pos.z + r, 0, 1]].sort((a, b) => a[0] - b[0]);
          P.pos.x += pens[0][1] * pens[0][0]; P.pos.z += pens[0][2] * pens[0][0];
        }
      }
    }
  }
  // Altura (aceras)
  let y = 0;
  if (S.location === 'street') { const lz = P.pos.z - STREET_ORIGIN.z; if (Math.abs(lz) > 3 && Math.abs(lz) < 6) y = 0.15; }
  P.pos.y += (y - P.pos.y) * Math.min(1, dt * 15);
  player.group.position.copy(P.pos);
  player.group.rotation.y = P.rotY;
  player.setPose(moving ? 'walk' : 'idle');
  player.update(dt, moving ? speed : 0);
}

const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
let camOverride = null; // {pos, look}
function updateCamera(dt) {
  if (camOverride) {
    camPos.lerp(camOverride.pos, Math.min(1, dt * 4));
    camTarget.lerp(camOverride.look, Math.min(1, dt * 4));
  } else {
    const tgt = new THREE.Vector3(P.pos.x, P.pos.y + 1.3, P.pos.z);
    const off = new THREE.Vector3(Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), Math.cos(P.yaw) * Math.cos(P.pitch)).multiplyScalar(P.dist);
    const desired = tgt.clone().add(off);
    if (S.location === 'home') desired.y = Math.min(desired.y, 9);
    camPos.lerp(desired, Math.min(1, dt * 8));
    camTarget.lerp(tgt, Math.min(1, dt * 10));
  }
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
  if (S.location === 'home' && apt) apt.updateCutaway(camera.position, camOverride ? camTarget : P.pos);
}

// ---------------- Interacciones ----------------
let nearest = null;
function findInteractable() {
  let best = null, bd = 1e9;
  for (const i of interactables()) {
    const d = Math.hypot(P.pos.x - i.x, P.pos.z - i.z);
    if (d < i.r + 0.4 && d < bd) { bd = d; best = i; }
  }
  nearest = best;
  setPrompt(best && mode === 'walk' && !modalOpen() ? (typeof best.label === 'function' ? best.label() : best.label) : null);
}

async function passTime(minutes, text, opts = {}) {
  mode = 'busy';
  if (opts.pose) player.setPose(opts.pose);
  await progressOverlay(text, Math.min(2.5, 0.6 + minutes / 60));
  for (let i = 0; i < minutes; i++) { tick(1); opts.perMinute?.(); }
  mode = 'walk';
  player.setPose('idle');
  updateHUD();
}

function interact() {
  const it = nearest; if (!it) return;
  const N = S.needs;
  switch (it.id) {
    case 'pc': return sitAtPC();
    case 'pctower': return towerMenu();
    case 'bench': return goBench();
    case 'fridge': return fridgeMenu();
    case 'stove': return cook();
    case 'coffee': {
      if (now() - S.lastCoffee < 180) { notify('☕ Ya tomaste café hace poco. Espera un par de horas.', 'bad'); return; }
      S.lastCoffee = now();
      sfx.eat();
      return passTime(5, '☕ Preparando café...', { perMinute: () => { N.energy = clamp(N.energy + 3, 0, 100); } });
    }
    case 'bed': return sleepMenu();
    case 'shower': sfx.shower(); return passTime(20, '🚿 Duchándote...', { perMinute: () => { N.hygiene = clamp(N.hygiene + 6, 0, 100); N.fun = clamp(N.fun + 0.2, 0, 100); } });
    case 'sink': return passTime(3, '💧 Lavándote la cara...', { perMinute: () => { N.hygiene = clamp(N.hygiene + 4, 0, 100); N.energy = clamp(N.energy + 0.5, 0, 100); } });
    case 'toilet': return passTime(5, '🚽 ...', { perMinute: () => { N.fun = clamp(N.fun + 0.3, 0, 100); } });
    case 'sofa': return tvMenu();
    case 'bookshelf': return studyMenu();
    case 'wardrobe': return wardrobe();
    case 'door': return goOutside();
    case 'package': openPackages(); sfx.open(); return;
    case 'guitar': return passTime(30, '🎸 Tocando la guitarra...', { pose: 'work', perMinute: () => { N.fun = clamp(N.fun + 0.8, 0, 100); addXP('charisma', 0.3); } });
    case 'arcade': return passTime(30, '🕹️ Jugando en el arcade...', { pose: 'work', perMinute: () => { N.fun = clamp(N.fun + 1.1, 0, 100); addXP('gaming', 0.4); } });
    // Calle
    case 'pet': return petMenu();
    case 'petshop': return petShopMenu();
    case 'home': return goHome();
    case 'market': return marketMenu();
    case 'pcshop': return pcShopMenu();
    case 'cafe': return cafeMenu();
    case 'gym': {
      if (S.money < 10) { notify('La entrada cuesta $10', 'bad'); return; }
      addMoney(-10, 'Gimnasio');
      return passTime(60, '🏋️ Entrenando...', { perMinute: () => { N.fun = clamp(N.fun + 0.3, 0, 100); N.energy = clamp(N.energy - 0.2, 0, 100); N.hygiene = clamp(N.hygiene - 0.5, 0, 100); addXP('charisma', 0.25); } }).then(() => notify('💪 ¡Te sientes con más confianza! (+Carisma)', 'good'));
    }
    case 'fountain': return passTime(15, '⛲ Descansando en la fuente...', { perMinute: () => { N.fun = clamp(N.fun + 0.4, 0, 100); } });
    case 'bench_park': return passTime(30, '🌳 Tomando aire fresco...', { pose: 'couch', perMinute: () => { N.fun = clamp(N.fun + 0.35, 0, 100); N.energy = clamp(N.energy + 0.1, 0, 100); } });
    default: break;
  }
}

async function fridgeMenu() {
  const opts = Object.keys(S.inventory.food).filter((id) => FOOD[id] && !FOOD[id].cook).map((id) => ({ value: id, icon: FOOD[id].icon, label: `${FOOD[id].name} x${S.inventory.food[id]}`, sub: `Hambre +${FOOD[id].hunger}${FOOD[id].energy ? ' · Energía +' + FOOD[id].energy : ''}${FOOD[id].fun ? ' · Diversión +' + FOOD[id].fun : ''}` }));
  if (!opts.length) { modal({ title: '🧊 La nevera está vacía', content: h('p', {}, 'Compra comida en el Supermercado (sal a la calle), pide delivery desde el teléfono (Tab) o desde TecnoMarket.'), actions: [{ text: 'OK' }] }); return; }
  const id = await choose('🧊 ¿Qué quieres comer?', opts);
  if (!id) return;
  const f = FOOD[id];
  S.inventory.food[id]--; if (!S.inventory.food[id]) delete S.inventory.food[id];
  await passTime(f.time || 5, `${f.icon} Comiendo ${f.name.toLowerCase()}...`, { pose: 'eat' });
  applyFood(f);
  updateHUD();
}

async function cook() {
  if (!(S.inventory.food.ingredients > 0)) { notify('🥕 Necesitas ingredientes (Supermercado)', 'bad'); return; }
  S.inventory.food.ingredients--; if (!S.inventory.food.ingredients) delete S.inventory.food.ingredients;
  apt.stoveGlow.material.emissiveIntensity = 3;
  await passTime(30, '🍳 Cocinando una comida casera...', { pose: 'work' });
  apt.stoveGlow.material.emissiveIntensity = 0;
  applyFood(MEAL);
  S.stats._cooked = (S.stats._cooked || 0) + 1;
  notify('🍲 ¡Comida casera deliciosa! (+Diversión)', 'good');
}

async function sleepMenu() {
  const h8 = (((8 * 60 - S.minute) + 1440) % 1440) || 1440;
  const v = await choose('🛏️ Dormir', [
    { value: 120, icon: '😴', label: 'Siesta de 2 horas', sub: '+Energía moderada' },
    { value: 360, icon: '🌙', label: 'Dormir 6 horas' },
    { value: h8, icon: '⏰', label: `Hasta las 08:00 (${Math.round(h8 / 60)}h)`, sub: 'Descanso completo' },
  ], `Energía actual: ${Math.round(S.needs.energy)}%`);
  if (!v) return;
  await doSleep(v);
}
async function doSleep(minutes, text = '💤 Durmiendo...') {
  mode = 'busy';
  const bp = apt.bedPos;
  player.group.position.set(bp.x, bp.y, bp.z + 0.3);
  player.group.rotation.y = 0;
  player.setPose('sleep');
  await fade(async () => {
    for (let i = 0; i < minutes; i++) {
      tick(1);
      const N = S.needs;
      N.energy = clamp(N.energy + 0.25, 0, 100);
      N.hunger = clamp(N.hunger + 0.03, 0, 100); // el sueño gasta menos
      N.fun = clamp(N.fun + 0.02, 0, 100);
    }
  }, 700);
  bigMessage(minutes >= 360 ? '☀️ ¡Buenos días!' : '😴 Siesta terminada', `${fmtClock(S.minute)} · Energía ${Math.round(S.needs.energy)}%`);
  P.pos.set(5.6, 0, -3.3); player.group.position.copy(P.pos);
  player.setPose('idle');
  mode = 'walk';
  save();
}

async function tvMenu() {
  const v = await choose('📺 Sofá', [
    { value: 30, icon: '📺', label: 'Ver TV 30 min', sub: '+Diversión' },
    { value: 60, icon: '🍿', label: 'Maratón de series 1 hora', sub: '+Diversión' },
    { value: 'nap', icon: '😴', label: 'Siesta en el sofá (1h)', sub: '+Energía' },
  ]);
  if (!v) return;
  const sp = apt.sofaPos;
  player.group.position.set(sp.x, 0, sp.z); player.group.rotation.y = 0;
  if (v === 'nap') { await passTime(60, '😴 Durmiendo en el sofá...', { pose: 'couch', perMinute: () => { S.needs.energy = clamp(S.needs.energy + 0.22, 0, 100); } }); }
  else {
    apt.tvOn = true;
    await passTime(v, '📺 Viendo la tele...', { pose: 'couch', perMinute: () => { S.needs.fun = clamp(S.needs.fun + 0.6, 0, 100); } });
    apt.tvOn = false; apt.drawTV(0);
  }
  P.pos.set(sp.x, 0, sp.z + 0.8);
}

async function studyMenu() {
  const opts = BOOKS.filter((b) => S.inventory.books.includes(b.id)).map((b) => ({ value: b.id, icon: b.icon, label: b.name, sub: `1 hora · +XP ${SKILL_NAMES[b.skill]} (Nv ${skill(b.skill)})` }));
  opts.push({ value: 'mag', icon: '📰', label: 'Leer revistas de tecnología (30 min)', sub: '+Diversión, +XP Hardware pequeño' });
  const v = await choose('📚 Librero', opts, S.inventory.books.length ? '' : 'Compra libros en TecnoMarket para subir habilidades más rápido.');
  if (!v) return;
  if (v === 'mag') return passTime(30, '📰 Leyendo...', { pose: 'eat', perMinute: () => { S.needs.fun = clamp(S.needs.fun + 0.3, 0, 100); addXP('hardware', 0.3); } });
  const b = BOOKS.find((x) => x.id === v);
  await passTime(60, `${b.icon} Estudiando "${b.name}"...`, { pose: 'eat', perMinute: () => { addXP(b.skill, 0.9); S.needs.fun = clamp(S.needs.fun - 0.05, 0, 100); S.needs.energy = clamp(S.needs.energy - 0.05, 0, 100); } });
}

function wardrobe() {
  mode = 'busy';
  showHUD(false);
  const saved = { pos: camPos.clone() };
  camOverride = { pos: new THREE.Vector3(P.pos.x + 0.3, 1.5, P.pos.z + 2.6), look: new THREE.Vector3(P.pos.x, 1.1, P.pos.z) };
  player.group.rotation.y = 0.2;
  player.setPose('idle');
  openCreator({
    character: player, wardrobe: true, initial: S.player,
    onDone: (pl) => { S.player.look = pl.look; camOverride = null; showHUD(true); mode = 'walk'; save(); },
  });
}

async function towerMenu() {
  const v = await choose('🖥️ Torre de tu PC', [
    { value: 'clean', icon: '💨', label: 'Limpiar el polvo con aire comprimido', sub: `Polvo actual: ${Math.round(S.pc.dust)}% · 15 min` },
    { value: 'info', icon: 'ℹ️', label: 'Ver especificaciones', sub: 'Abre la app Mi PC' },
  ]);
  if (v === 'clean') {
    await passTime(15, '💨 Limpiando el polvo...', { pose: 'work' });
    S.pc.dust = 0; addXP('hardware', 5);
    notify('✨ ¡PC limpia! Temperaturas más bajas.', 'good');
  } else if (v === 'info') sitAtPC('mypc');
}

// ---------------- Computadora ----------------
const DESK_CAM = { pos: new THREE.Vector3(-4.3, 1.7, -3.7), look: new THREE.Vector3(-5, 1.15, -5.6) };
function sitAtPC(app) {
  if (!S.pc.parts.cpu) { notify('Tu PC está desmontada. Instálala desde el banco de trabajo.', 'bad'); return; }
  mode = 'pc';
  showHUD(false); setPrompt(null);
  seatPlayer('type');
  camOverride = DESK_CAM;
  openComputer({ app, onClose: () => standUp(), onStartStream: (st) => startStream(st) });
}
function seatPlayer(pose) {
  const c = apt.chairPos;
  player.group.position.set(c.x, 0, c.z + 0.05);
  player.group.rotation.y = Math.PI;
  player.setPose(pose);
  apt.dyn.chair.rotation.y = 0;
}
function standUp() {
  camOverride = null;
  mode = 'walk';
  P.pos.set(apt.chairPos.x + 0.2, 0, apt.chairPos.z + 0.75);
  player.group.position.copy(P.pos);
  player.setPose('idle');
  showHUD(true);
  updateHUD();
  save();
}

// ---------------- Directo ----------------
function startStream(st) {
  S.streamSettings = { ...st };
  session = new StreamSession(st);
  mode = 'stream';
  seatPlayer('game');
  camOverride = DESK_CAM;
  if (apt.dyn.greenscreen) apt.dyn.greenscreen.visible = true;
  openStreamUI(session, { faceCam: faceRenderer.domElement, character: player });
  streamMinute();
  sfx.boot();
  const off = bus.on('stream:end', (summary) => { off(); endStream(summary); });
}

function endStream(sm) {
  closeStreamUI();
  if (apt.dyn.greenscreen) apt.dyn.greenscreen.visible = false;
  session = null;
  const money = sm.donations + sm.ads + sm.subs * (S.flags.partner ? 3.5 : 2.5);
  modal({
    title: sm.crashed ? '💥 Directo interrumpido' : '📊 Resumen del directo',
    content: h('div', {},
      sm.crashed ? h('div.bad', {}, sm.crashed) : null,
      h('div.stat-grid', {},
        statC('Duración', `${Math.floor(sm.minutes / 60)}h ${sm.minutes % 60}m`), statC('Media', sm.avg + ' 👀'), statC('Pico', sm.peak + ' 👀'),
        statC('Nuevos seguidores', '+' + sm.followers), statC('Nuevos subs', S.flags.affiliate ? '+' + sm.subs : '—'), statC('Ganancias', fmtMoney(money)),
      ),
      sm.bots ? h('div', { class: sm.botResult ? 'bad' : 'warn' }, sm.botResult === 'ban' ? '⛔ Streamix detectó tus bots: canal SUSPENDIDO 3 días.' : sm.botResult === 'strike' ? `⚠️ Streamix detectó bots: advertencia ${S.bots.strikes}/3.` : `🤖 ${sm.bots} bots inflaron tus espectadores sin que nadie lo notara... esta vez.`) : null,
      sm.minutes >= 20 ? h('p.muted', {}, '🎬 Se guardó el VOD. Edítalo en VidCut para subir un video.') : h('p.muted', {}, 'Directo muy corto: no se guardó VOD.'),
      sm.minutes < 30 ? h('p.muted', {}, '⚠️ Los directos de menos de 30 min no cuentan para Afiliado.') : null,
    ),
    actions: [{ text: 'Continuar', cls: 'good' }],
    onClose: () => { checkProgress(); save(); },
  });
  standUp();
}
function statC(n, v) { return h('div.stat-card', {}, h('div.sc-v', {}, v), h('div.sc-n', {}, n)); }

// ---------------- Banco ----------------
const BENCH_CAM = { pos: new THREE.Vector3(-0.62, 1.95, -4.15), look: new THREE.Vector3(-0.64, 1.12, -5.45) };
function goBench() {
  mode = 'bench';
  showHUD(false); setPrompt(null);
  P.pos.set(0.55, 0, -4.75); player.group.position.copy(P.pos); player.group.rotation.y = Math.PI * 1.2; player.setPose('work');
  camOverride = BENCH_CAM;
  let popT = 0;
  openBench({
    onUpdate: (slot) => {
      apt.refreshBench(S);
      const m = apt.benchModel?.userData.meshes?.[slot];
      if (m) { m.position.x += 0.6; m.userData.pop = 0.35; benchAnim.push(m); }
      if (slot === 'power' && apt.benchModel) benchPower = 2.5;
    },
    onClose: () => { camOverride = null; mode = 'walk'; player.setPose('idle'); showHUD(true); save(); },
  });
}
const benchAnim = [];
let benchPower = 0;

// ---------------- Calle ----------------
async function goOutside() {
  sfx.door();
  await fade(() => {
    S.location = 'street';
    P.pos.copy(street.spawn); P.rotY = Math.PI; P.yaw = 0; P.pitch = 0.45;
    player.group.position.copy(P.pos);
    camPos.set(P.pos.x, 4, P.pos.z + 7);
    tick(2);
  });
  notify('🏙️ Barrio Luna · Visita el Supermercado, PC Zone, Café Byte y el Gimnasio', 'info');
}
async function goHome() {
  sfx.door();
  await fade(() => {
    S.location = 'home';
    P.pos.set(-7, 0, 0.55); P.rotY = Math.PI / 2; P.yaw = -Math.PI / 2; P.pitch = 0.55;
    player.group.position.copy(P.pos);
    camPos.set(P.pos.x - 4, 4, P.pos.z);
    tick(2);
  });
}

async function marketMenu() {
  const items = ['noodles', 'sandwich', 'salad', 'burger', 'pizza', 'ingredients', 'chips', 'soda', 'energy'];
  modal({
    title: '🛒 Supermercado', wide: true,
    content: (b) => {
      const render = () => {
        clear(b);
        b.append(h('p.muted', {}, `Precios de tienda (más baratos que el delivery). Dinero: ${fmtMoney(S.money)}`));
        b.append(h('div.shop-grid', {}, items.map((id) => {
          const f = FOOD[id];
          return h('div.shop-card', {}, h('div.sc-icon', {}, f.icon), h('b', {}, f.name), h('small', {}, f.cook ? 'Para cocinar en casa' : `Hambre +${f.hunger}${f.energy ? ' · Energía +' + f.energy : ''}`), h('small.extra', {}, `Tienes: ${S.inventory.food[id] || 0}`), h('div.price', {}, fmtMoney(f.price)),
            h('div.row', {}, btn('x1', () => buyFood(id, 1)), btn('x5', () => buyFood(id, 5))));
        })));
      };
      const buyFood = (id, n) => {
        const cost = FOOD[id].price * n * (n >= 5 ? 0.9 : 1);
        if (S.money < cost) { notify('Sin dinero suficiente', 'bad'); sfx.error(); return; }
        addMoney(-cost, `Supermercado: ${FOOD[id].name} x${n}`); sfx.cash();
        S.inventory.food[id] = (S.inventory.food[id] || 0) + n;
        render();
      };
      render();
    },
    actions: [{ text: 'Salir' }],
  });
}

function pcShopMenu() {
  let tab = 'buy', slot = 'gpu';
  modal({
    title: '🖥️ PC Zone', wide: true,
    content: (b) => {
      const render = () => {
        clear(b);
        b.append(h('div.tabs', {}, [['buy', 'Comprar (sin espera, -5%)'], ['sell', 'Vender piezas usadas']].map(([k, n]) => h('button.tab', { class: tab === k ? 'active' : '', onclick: () => { tab = k; render(); } }, n))));
        if (tab === 'buy') {
          b.append(h('div.subtabs', {}, SLOT_ORDER.map((s) => h('button.chip', { class: slot === s ? 'sel' : '', onclick: () => { slot = s; render(); } }, `${SLOT_ICONS[s]} ${SLOT_NAMES[s]}`))));
          b.append(h('div.shop-grid', {}, partsBySlot(slot).map((p) => {
            const price = Math.round(p.price * 0.95);
            return h('div.shop-card', {}, h('div.sc-icon', {}, SLOT_ICONS[p.slot]), h('b', {}, p.name), h('small', {}, partDesc(p)), h('div.price', {}, fmtMoney(price)),
              btn('Comprar', () => { if (S.money < price) { notify('Sin dinero suficiente', 'bad'); sfx.error(); return; } addMoney(-price, `PC Zone: ${p.name}`); sfx.cash(); receiveItems([{ kind: 'part', id: p.id }]); notify(`🧩 ${p.name} al inventario`, 'good'); render(); }));
          })));
        } else {
          const inv = S.inventory.parts;
          if (!inv.length) b.append(h('p.muted', {}, 'No tienes piezas para vender.'));
          b.append(h('div.shop-grid', {}, inv.map((ip) => {
            const p = part(ip.id); const price = Math.round(p.price * 0.55);
            return h('div.shop-card', {}, h('div.sc-icon', {}, SLOT_ICONS[p.slot]), h('b', {}, p.name), h('small', {}, 'Usada'), h('div.price', {}, fmtMoney(price)),
              btn('Vender', () => { S.inventory.parts = S.inventory.parts.filter((x) => x.uid !== ip.uid); addMoney(price, `Venta: ${p.name}`); sfx.cash(); render(); }));
          })));
        }
      };
      render();
    },
    actions: [{ text: 'Salir' }],
  });
}

async function cafeMenu() {
  const v = await choose('☕ Café Byte', [
    { value: 'coffee', icon: '☕', label: 'Café latte · $4', sub: 'Energía +20 · Diversión +3' },
    { value: 'cake', icon: '🍰', label: 'Pastel y jugo · $8', sub: 'Hambre +35 · Diversión +10' },
    { value: 'wifi', icon: '💻', label: 'Networking con otros creadores (1h) · $6', sub: '+Carisma, a veces nuevos seguidores' },
    { value: 'work', icon: '🧑‍🍳', label: 'Trabajar un turno de barista (4h)', sub: `Tu antiguo jefe te deja cubrir turnos · $40 + propinas · ${S.barista.shifts} turnos hechos` },
  ]);
  if (v === 'work') return baristaShift();
  if (!v) return;
  const cost = { coffee: 4, cake: 8, wifi: 6 }[v] || 0;
  if (S.money < cost) { notify('Sin dinero suficiente', 'bad'); return; }
  addMoney(-cost, 'Café Byte');
  if (v === 'coffee') await passTime(10, '☕ Tomando café...', { perMinute: () => { S.needs.energy = clamp(S.needs.energy + 2, 0, 100); S.needs.fun = clamp(S.needs.fun + 0.3, 0, 100); } });
  if (v === 'cake') { await passTime(15, '🍰 Merendando...', { pose: 'eat' }); applyFood({ hunger: 35, fun: 10 }); }
  if (v === 'wifi') { await passTime(60, '🤝 Conversando con otros creadores...', { perMinute: () => { addXP('charisma', 0.5); S.needs.fun = clamp(S.needs.fun + 0.2, 0, 100); } }); const g = randi(0, 3 + Math.floor(skill('charisma') / 2)); S.stats.followers += g; if (g) notify(`🤝 Conociste gente: +${g} seguidores`, 'good'); }
}

// ---------------- Barista ----------------
function baristaShift() {
  if (S.needs.energy < 20) { notify('Estás muy cansado para trabajar', 'bad'); return; }
  const N_ORD = 8;
  let idx = 0, correct = 0, tips = 0, order = randomOrder(), sel = {}, t0 = performance.now(), timer = null, fillEl = null;
  mode = 'busy';
  const m = modal({
    title: '☕ Turno de barista en Café Byte', wide: true, closable: false,
    content: (b) => {
      const render = () => {
        clear(b);
        const left = Math.max(0, 14 - (performance.now() - t0) / 1000);
        b.append(
          h('div.row.between', {}, h('b', {}, `Pedido ${idx + 1}/${N_ORD}`), h('span', {}, `✅ ${correct} · 💵 propinas ${fmtMoney(tips)}`)),
          h('div.order', {}, h('div.order-cup', {}, '☕'), h('div', {}, h('div.muted', {}, `Cliente: ${['Ana', 'Leo', 'Sara', 'Iván', 'Nora', 'Hugo', 'Eva', 'Tito'][idx % 8]} quiere:`), h('div.order-txt', {}, `${order.drink} ${order.size.toLowerCase()} · leche ${order.milk.toLowerCase()} · extra: ${order.extra.toLowerCase()}`))),
          h('div.pbar', {}, fillEl = h('div.pfill', { style: { width: `${(left / 14) * 100}%` } })),
          ...Object.keys(BARISTA).map((k) => h('div.opt', {}, h('label', {}, LABELS[k]), h('div.opt-row', {}, BARISTA[k].map((o) => h('button.chip', { class: sel[k] === o ? 'sel' : '', onclick: () => { sel[k] = o; render(); } }, o))))),
          h('div.row', {}, btn('🛎️ Servir', () => serve(), 'big good', Object.keys(sel).length < 4)),
        );
      };
      const serve = () => {
        const hits = Object.keys(BARISTA).filter((k) => sel[k] === order[k]).length;
        const secs = (performance.now() - t0) / 1000;
        if (hits === 4) { correct++; const tip = Math.max(0, Math.round((14 - secs) / 3)); tips += tip; sfx.money(); } else sfx.error();
        idx++;
        if (idx >= N_ORD) { clearInterval(timer); finish(); return; }
        order = randomOrder(); sel = {}; t0 = performance.now(); render();
      };
      timer = setInterval(() => {
        const left = 14 - (performance.now() - t0) / 1000;
        if (left <= 0) serve();
        else if (fillEl) { fillEl.style.width = `${(left / 14) * 100}%`; fillEl.style.background = left < 4 ? '#e74c3c' : ''; }
      }, 200);
      render();
    },
  });
  const finish = () => {
    m.close();
    const pay = 40 + correct * 3 + tips;
    for (let i = 0; i < 240; i++) tick(1);
    S.needs.energy = clamp(S.needs.energy - 12, 0, 100); S.needs.fun = clamp(S.needs.fun - 6, 0, 100); S.needs.hygiene = clamp(S.needs.hygiene - 8, 0, 100);
    addMoney(pay, 'Turno de barista');
    S.barista.shifts++; S.barista.best = Math.max(S.barista.best, correct);
    addXP('charisma', 8 + correct);
    mode = 'walk';
    modal({ title: '☕ Turno terminado', content: h('p', {}, `Serviste ${correct}/${N_ORD} pedidos perfectos. Ganaste ${fmtMoney(pay)} (${fmtMoney(tips)} en propinas). Pasaron 4 horas.`), actions: [{ text: 'OK', cls: 'good' }] });
    updateHUD();
  };
}

// ---------------- Mascotas ----------------
function petShopMenu() {
  modal({
    title: '🐾 Tienda de mascotas', wide: true,
    content: (b, close) => {
      const render = () => {
        clear(b);
        b.append(h('p.muted', {}, 'Una mascota te alegra el día y a veces aparece en tus directos (+hype). Necesita comida y cariño.'));
        if (!S.pet) {
          b.append(h('div.shop-grid', {}, PETS.map((p) => h('div.shop-card', {}, h('div.sc-icon', {}, p.type === 'cat' ? '🐱' : '🐶'), h('b', {}, `Adoptar ${p.name.toLowerCase()}`),
            h('div.opt-row', {}, p.colors.map((c) => h('button.swatch', { style: { background: c }, class: p._c === c ? 'sel' : '', onclick: () => { p._c = c; render(); } }))),
            h('input.inp', { id: `petname-${p.type}`, placeholder: 'Nombre', maxLength: 12 }),
            h('div.price', {}, fmtMoney(p.price)),
            btn('Adoptar', () => {
              if (S.money < p.price) { notify('Sin dinero suficiente', 'bad'); return; }
              const name = document.getElementById(`petname-${p.type}`).value.trim() || (p.type === 'cat' ? 'Michi' : 'Toby');
              addMoney(-p.price, `Adopción: ${name}`);
              S.pet = { type: p.type, name, color: p._c || p.colors[0], hunger: 80, happy: 80 };
              S.inventory.food.petfood = (S.inventory.food.petfood || 0) + 3;
              refreshPet(); sfx.levelup();
              bigMessage(`🐾 ¡Bienvenido, ${name}!`, 'Ya vive en tu apartamento. Acércate y pulsa E para cuidarlo.');
              close();
            })))));
        } else b.append(h('p', {}, `Ya tienes a ${S.pet.name}.`));
        b.append(h('div.row', {}, btn(`🥫 Comida para mascota x5 · $12 (tienes ${S.inventory.food.petfood || 0})`, () => {
          if (S.money < 12) return; addMoney(-12, 'Comida de mascota'); S.inventory.food.petfood = (S.inventory.food.petfood || 0) + 5; sfx.cash(); render();
        })));
      };
      render();
    },
    actions: [{ text: 'Salir' }],
  });
}
async function petMenu() {
  const p = S.pet;
  const v = await choose(`🐾 ${p.name}`, [
    { value: 'pet', icon: '🤲', label: 'Acariciar', sub: '+Diversión' },
    { value: 'feed', icon: '🥫', label: `Dar de comer (tienes ${S.inventory.food.petfood || 0})`, disabled: !(S.inventory.food.petfood > 0) },
    { value: 'play', icon: '🧶', label: 'Jugar 20 min', sub: '+Diversión, +felicidad' },
  ], `Hambre ${Math.round(p.hunger)}% · Felicidad ${Math.round(p.happy)}%`);
  if (v === 'pet') { S.needs.fun = clamp(S.needs.fun + 6, 0, 100); p.happy = clamp(p.happy + 8, 0, 100); notify(`${p.type === 'cat' ? '😺 Prrrr...' : '🐶 ¡Guau!'}`, 'good'); }
  if (v === 'feed') { S.inventory.food.petfood--; p.hunger = 100; p.happy = clamp(p.happy + 5, 0, 100); sfx.eat(); notify(`🥫 ${p.name} comió feliz`, 'good'); }
  if (v === 'play') await passTime(20, `🧶 Jugando con ${p.name}...`, { perMinute: () => { S.needs.fun = clamp(S.needs.fun + 0.8, 0, 100); p.happy = clamp(p.happy + 1, 0, 100); } });
}

// ---------------- Teléfono / pausa ----------------
function openPhone() {
  let tab = 'status';
  const m = modal({
    title: `📱 Teléfono de ${S.player.name}`, wide: true, cls: 'phone',
    content: (b) => {
      const render = () => {
        clear(b);
        b.append(h('div.tabs', {}, [['status', '❤️ Estado'], ['inv', '🎒 Inventario'], ['quests', '🎯 Misiones'], ['food', '🍕 Delivery'], ['settings', '⚙️ Ajustes']].map(([k, n]) => h('button.tab', { class: tab === k ? 'active' : '', onclick: () => { tab = k; render(); } }, n))));
        const N = S.needs;
        if (tab === 'status') {
          b.append(h('div.cols', {},
            h('div.col', {}, h('h3', {}, 'Necesidades'),
              ...[['🍔 Hambre', N.hunger], ['⚡ Energía', N.energy], ['🚿 Higiene', N.hygiene], ['🎮 Diversión', N.fun]].map(([n, v]) => h('div.kv', {}, h('span', {}, `${n} ${Math.round(v)}%`), bar(v, v > 60 ? '#2ecc71' : v > 30 ? '#f1c40f' : '#e74c3c'))),
              h('p', {}, `Ánimo: ${moodText(mood())}`),
              h('p.muted', {}, 'El ánimo afecta cuántos espectadores se quedan en tus directos.')),
            h('div.col', {}, h('h3', {}, 'Habilidades'), skillsPanel(),
              h('p.muted', {}, 'Carisma: más hype y seguidores · Gaming: mejores jugadas · Edición: mejores videos · Hardware: mejores pagos y diagnósticos')),
          ));
        } else if (tab === 'inv') {
          const food = Object.entries(S.inventory.food).filter(([id]) => FOOD[id]).map(([id, n]) => `${FOOD[id]?.icon} ${FOOD[id]?.name} x${n}`);
          const parts = {}; S.inventory.parts.forEach((p) => { parts[p.id] = (parts[p.id] || 0) + 1; });
          b.append(
            h('h3', {}, '🍕 Comida'), h('p', {}, food.join(' · ') || 'Nada'),
            h('h3', {}, '🧩 Piezas'), h('p', {}, Object.entries(parts).map(([id, n]) => `${SLOT_ICONS[part(id).slot]} ${part(id).name} x${n}`).join(' · ') || 'Nada'),
            h('h3', {}, '🎧 Periféricos'), h('p', {}, Object.values(S.peripherals).filter(Boolean).map((id) => peripheral(id)?.name).join(' · ')),
            h('h3', {}, '🎮 Juegos'), h('p', {}, S.inventory.games.map((g) => GAME[g].name).join(' · ')),
            h('h3', {}, '📦 Pedidos en camino'), h('p', {}, S.deliveries.length ? `${S.deliveries.length} paquete(s), llegan a las ${S.deliveries.map((d) => fmtClock(d.at % 1440)).join(', ')}` : 'Ninguno'),
          );
        } else if (tab === 'quests') {
          b.append(h('div.quest-list', {}, QUESTS.map((q, i) => h('div.qitem', { class: i < S.quests.index ? 'done' : i === S.quests.index ? 'cur' : '' }, h('b', {}, `${i < S.quests.index ? '✅' : i === S.quests.index ? '🎯' : '🔒'} ${q.title}`), h('small', {}, i <= S.quests.index ? q.desc : '???'), h('span.price', {}, fmtMoney(q.reward))))));
        } else if (tab === 'food') {
          b.append(h('p.muted', {}, 'Pide comida a domicilio (llega a tu puerta en ~1h).'));
          b.append(h('div.shop-grid', {}, ['pizza', 'burger', 'sandwich', 'salad', 'energy'].map((id) => {
            const f = FOOD[id]; const price = Math.round(f.price * 1.3 + 2);
            return h('div.shop-card', {}, h('div.sc-icon', {}, f.icon), h('b', {}, f.name), h('div.price', {}, fmtMoney(price)), btn('Pedir', () => {
              if (S.money < price) { notify('Sin dinero', 'bad'); return; }
              addMoney(-price, `Delivery: ${f.name}`); sfx.cash();
              S.deliveries.push({ items: [{ kind: 'food', id, qty: 1 }], at: now() + randi(35, 70) }); notify(`🛵 ${f.name} en camino`, 'info');
            }));
          })));
        } else {
          b.append(
            h('div.kv', {}, h('span', {}, 'Volumen'), h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: S.settings.volume, oninput: (e) => setVolume(+e.target.value) })),
            h('div.kv', {}, h('span', {}, 'Calidad gráfica (bloom + antialias)'), btn(hiQuality ? 'Alta' : 'Rendimiento', () => { hiQuality = !hiQuality; S.settings.hiQuality = hiQuality; render(); })),
            h('div.kv', {}, h('span', {}, 'Sombras'), btn(S.settings.shadows ? 'Activadas' : 'Desactivadas', () => { S.settings.shadows = !S.settings.shadows; renderer.shadowMap.enabled = S.settings.shadows; world.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); render(); })),
            h('div.row', {}, btn('💾 Guardar partida', () => { save(); notify('💾 Partida guardada', 'good'); })),
          );
        }
      };
      render();
    },
  });
  return m;
}

function openPauseMenu() {
  paused = true;
  modal({
    title: '⏸️ Pausa',
    content: h('div.choice-list', {},
      h('button.choice', { onclick: () => closeTopModal() }, h('span.choice-icon', {}, '▶'), h('span.choice-text', {}, h('b', {}, 'Continuar'))),
      h('button.choice', { onclick: () => { save(); notify('💾 Partida guardada', 'good'); } }, h('span.choice-icon', {}, '💾'), h('span.choice-text', {}, h('b', {}, 'Guardar partida'))),
      h('button.choice', { onclick: () => { closeTopModal(); howToPlay(); } }, h('span.choice-icon', {}, '❓'), h('span.choice-text', {}, h('b', {}, 'Cómo se juega'))),
      h('button.choice', { onclick: () => { save(); location.reload(); } }, h('span.choice-icon', {}, '🚪'), h('span.choice-text', {}, h('b', {}, 'Guardar y salir al menú'))),
    ),
    onClose: () => { paused = false; },
  });
}

async function faint() {
  if (mode === 'busy' || mode === 'menu') return;
  if (session) session.crash('Te desmayaste de cansancio en pleno directo 😵');
  if (computerOpen()) closeComputer();
  if (benchOpen()) closeBench();
  camOverride = null;
  if (S.location === 'street') { S.location = 'home'; }
  notify('😵 Te desmayaste de cansancio...', 'bad');
  S.needs.energy = 1;
  await doSleep(600, '😵 Desmayado...');
  S.needs.fun = clamp(S.needs.fun - 20, 0, 100);
}

function gameOver(why) {
  mode = 'busy';
  deleteSave();
  modal({
    title: '💀 FIN DEL JUEGO', closable: false,
    content: h('div', {}, h('p', {}, why), h('p', {}, `Llegaste a ${S.stats.followers} seguidores en ${S.day + 1} días.`)),
    actions: [{ text: 'Volver al menú', fn: () => location.reload() }],
  });
}

// ---------------- Monitor del escritorio ----------------
let monT = 0;
function drawMonitor(t) {
  if (!apt) return;
  monT += 1;
  if (monT % 4) return;
  const streamCanvas = document.querySelector('#streamui canvas');
  if (mode === 'stream' && streamCanvas) { apt.drawMonitor((g, w, hh) => g.drawImage(streamCanvas, 0, 0, w, hh)); apt.screenLight.color.set('#ff66cc'); return; }
  if (!S.pc.parts.cpu) { apt.drawMonitor((g, w, hh) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, hh); }); return; }
  apt.drawMonitor((g, w, hh) => {
    const gr = g.createLinearGradient(0, 0, w, hh);
    gr.addColorStop(0, '#2b1055'); gr.addColorStop(1, '#7597de');
    g.fillStyle = gr; g.fillRect(0, 0, w, hh);
    g.fillStyle = 'rgba(255,255,255,0.1)';
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc((i * 130 + t * 10) % (w + 100) - 50, 60 + i * 40, 30 + i * 6, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center';
    g.fillText(S.player.channel, w / 2, hh / 2);
    g.font = '18px sans-serif'; g.fillText(`${fmtClock(S.minute)} · ${S.stats.followers} seguidores`, w / 2, hh / 2 + 30);
    g.textAlign = 'left'; g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, hh - 22, w, 22);
  });
  apt.screenLight.color.set('#88aaff');
}

// ---------------- Bucle ----------------
let lastT = performance.now();
let hudT = 0, faceT = 0, elapsed = 0;
function loop() {
  requestAnimationFrame(loop);
  const tNow = performance.now();
  const dt = Math.min(0.1, (tNow - lastT) / 1000);
  lastT = tNow;
  elapsed += dt;
  if (mode === 'menu' || mode === 'creator') {
    showChar.update(dt, 0);
    if (!dragging && mode === 'menu') showChar.group.rotation.y += dt * 0.4;
    camera.position.set(0, 1.55, mode === 'creator' ? 3.3 : 4.2);
    camera.lookAt(mode === 'creator' ? -0.55 : 0, 1.15, 0);
    draw(showroom);
    return;
  }
  if (!S) return;
  const timeFlows = !paused && !(mode === 'busy');
  if (timeFlows) {
    if (mode === 'stream' && session) {
      realtimeTick(dt, streamUI.speed, () => { if (session && !session.ended) { session.minuteTick(); streamMinute(); } });
    } else realtimeTick(dt, 1);
  }
  if (mode === 'stream') streamFrame(dt);
  if (mode === 'walk' && !paused && !modalOpen()) movePlayer(dt);
  else player.update(dt, 0);

  // Mundo
  const tod = apt.setTimeOfDay(S.minute);
  street.setTimeOfDay(tod.night, S.minute);
  apt.update(dt, elapsed);
  if (pet) { pet.group.visible = S.location === 'home'; if (S.location === 'home') pet.update(dt, P.pos, mode === 'walk'); }
  street.update(dt, elapsed, S.location === 'street');
  if (S.location === 'street') {
    world.background.copy(street.horizonColor);
    if (!world.fog) world.fog = new THREE.Fog('#cfe9ff', 45, 150);
    world.fog.color.copy(street.horizonColor);
    world.environmentIntensity = 0.25 + (1 - tod.night) * 0.35;
  } else { world.background.set('#0f1016'); world.fog = null; world.environmentIntensity = 0.35; }
  // Sol siguiendo al jugador para sombras
  const sunBase = S.location === 'street' ? P.pos : new THREE.Vector3(0, 0, 0);
  apt.sun.position.set(sunBase.x + 6, 14, sunBase.z - 10);
  apt.sun.target.position.copy(sunBase);
  // Animación de piezas en el banco
  for (let i = benchAnim.length - 1; i >= 0; i--) {
    const m = benchAnim[i];
    m.userData.pop -= dt;
    m.position.x += (0 - m.position.x) * Math.min(1, dt * 10);
    if (m.userData.pop <= 0) { m.position.x = 0; benchAnim.splice(i, 1); }
  }
  if (apt.benchModel && benchPower > 0) { benchPower -= dt; for (const f of apt.benchModel.userData.fans) f.userData.blades.rotation.z += dt * 30; }

  updateCamera(dt);
  if (mode === 'walk') findInteractable(); else setPrompt(null);
  drawMonitor(elapsed);

  hudT += dt;
  if (hudT > 0.25) { hudT = 0; if (mode === 'walk' || mode === 'busy') updateHUD(); }
  if (Math.floor(elapsed) % 20 === 0 && !loop._saved) { loop._saved = true; } else if (Math.floor(elapsed) % 20 !== 0) loop._saved = false;

  draw(world);
  // Facecam
  if (mode === 'stream' && S.peripherals.webcam) {
    faceT += dt;
    if (faceT > 1 / 15) {
      faceT = 0;
      const head = new THREE.Vector3(); player.head.getWorldPosition(head);
      faceCam.position.set(apt.chairPos.x + 0.05, head.y + 0.35, apt.chairPos.z - 1.1);
      faceCam.lookAt(head.x, head.y - 0.1, head.z);
      faceRenderer.render(world, faceCam);
    }
  }
}

// ---------------- Arranque ----------------
initHUD();
mainMenu();
loop();
window.__game = { get S() { return S; }, tick, P, get mode() { return mode; }, interact: () => { findInteractable(); interact(); }, get nearest() { return nearest; } };
