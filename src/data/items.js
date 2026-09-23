// Comida, periféricos, decoración, libros y planes de internet.

export const FOOD = {
  noodles: { name: 'Fideos instantáneos', icon: '🍜', hunger: 30, energy: 0, fun: 0, price: 3, time: 10 },
  chips: { name: 'Papas fritas', icon: '🍟', hunger: 12, energy: 0, fun: 6, price: 2, time: 3, snack: true },
  sandwich: { name: 'Sándwich', icon: '🥪', hunger: 35, energy: 3, fun: 2, price: 5, time: 5 },
  salad: { name: 'Ensalada fresca', icon: '🥗', hunger: 38, energy: 6, fun: 0, price: 7, time: 5 },
  burger: { name: 'Hamburguesa', icon: '🍔', hunger: 55, energy: 0, fun: 8, price: 10, time: 12 },
  pizza: { name: 'Pizza familiar', icon: '🍕', hunger: 70, energy: 0, fun: 12, price: 14, time: 15 },
  ingredients: { name: 'Ingredientes (cocinar)', icon: '🥕', hunger: 0, price: 6, cook: true },
  energy: { name: 'Bebida energética VoltX', icon: '⚡', hunger: 3, energy: 28, fun: 4, price: 4, time: 2, snack: true },
  soda: { name: 'Refresco', icon: '🥤', hunger: 5, energy: 8, fun: 5, price: 2, time: 2, snack: true },
};
export const MEAL = { name: 'Comida casera', icon: '🍲', hunger: 65, energy: 8, fun: 10 };

// Periféricos: cada ranura tiene un nivel de calidad q (0..1)
export const PERIPHERALS = {
  webcam: [
    { id: 'cam_hd', name: 'Webcam HD 720p', q: 0.45, price: 40, icon: '📷' },
    { id: 'cam_fhd', name: 'Webcam FullHD 60fps', q: 0.75, price: 95, icon: '📷' },
    { id: 'cam_4k', name: 'Cámara 4K Pro', q: 1, price: 280, icon: '🎥' },
  ],
  mic: [
    { id: 'mic_headset', name: 'Headset básico', q: 0.2, price: 20, icon: '🎧' },
    { id: 'mic_usb', name: 'Micrófono USB Condensador', q: 0.6, price: 65, icon: '🎙️' },
    { id: 'mic_xlr', name: 'Micrófono XLR + Interfaz', q: 1, price: 230, icon: '🎙️' },
  ],
  light: [
    { id: 'light_ring', name: 'Aro de luz', q: 0.5, price: 35, icon: '💡' },
    { id: 'light_panel', name: 'Paneles LED Pro', q: 1, price: 130, icon: '💡' },
  ],
  monitor2: [
    { id: 'mon_2', name: 'Segundo monitor 24"', q: 1, price: 150, icon: '🖥️', desc: 'Lees el chat mejor: más tiempo para eventos' },
  ],
  chair: [
    { id: 'chair_basic', name: 'Silla de oficina', q: 0, price: 30, icon: '🪑' },
    { id: 'chair_gamer', name: 'Silla Gamer', q: 0.2, price: 180, icon: '🪑', desc: '-20% cansancio al transmitir' },
    { id: 'chair_pro', name: 'Silla Ergonómica Pro', q: 0.35, price: 420, icon: '🪑', desc: '-35% cansancio al transmitir' },
  ],
  keyboard: [
    { id: 'kb_mech', name: 'Teclado mecánico RGB', q: 1, price: 80, icon: '⌨️', desc: '+tiempo en minijuegos QTE/timing' },
  ],
  mouse: [
    { id: 'mouse_pro', name: 'Ratón gamer 26K DPI', q: 1, price: 55, icon: '🖱️', desc: 'Objetivos más grandes en minijuego de puntería' },
  ],
  deck: [
    { id: 'deck', name: 'Stream Panel (15 teclas)', q: 1, price: 150, icon: '🎛️', desc: 'Desbloquea alertas de sonido y escenas (+hype)' },
  ],
  greenscreen: [
    { id: 'green', name: 'Pantalla verde', q: 1, price: 90, icon: '🟩', desc: '+calidad de escena' },
  ],
};
export const PERIPHERAL_SLOT_NAMES = {
  webcam: 'Cámara', mic: 'Micrófono', light: 'Iluminación', monitor2: 'Segundo monitor', chair: 'Silla',
  keyboard: 'Teclado', mouse: 'Ratón', deck: 'Stream Panel', greenscreen: 'Pantalla verde',
};
export const peripheral = (id) => {
  for (const slot of Object.keys(PERIPHERALS)) {
    const f = PERIPHERALS[slot].find((p) => p.id === id);
    if (f) return { ...f, slot };
  }
  return null;
};

export const DECO = [
  { id: 'poster', name: 'Póster gamer', price: 20, setup: 2, icon: '🖼️' },
  { id: 'plant', name: 'Plantas', price: 30, setup: 2, icon: '🪴' },
  { id: 'ledstrip', name: 'Tira LED RGB', price: 40, setup: 4, icon: '🌈' },
  { id: 'shelf', name: 'Estante con figuras', price: 120, setup: 6, icon: '🗿' },
  { id: 'neon', name: 'Letrero neón con tu canal', price: 150, setup: 9, icon: '✨' },
  { id: 'rug', name: 'Alfombra gamer', price: 60, setup: 2, icon: '🟪' },
  { id: 'aquarium', name: 'Acuario', price: 300, setup: 7, icon: '🐠' },
  { id: 'panels', name: 'Paneles acústicos', price: 85, setup: 5, icon: '🔷' },
  { id: 'guitar', name: 'Guitarra eléctrica', price: 140, setup: 4, icon: '🎸', desc: 'Tócala para divertirte' },
  { id: 'arcade', name: 'Máquina arcade', price: 450, setup: 8, icon: '🕹️', desc: 'Diversión en casa' },
];
export const DECO_BY_ID = Object.fromEntries(DECO.map((d) => [d.id, d]));

export const BOOKS = [
  { id: 'book_hw', name: 'Hardware para todos', skill: 'hardware', price: 25, icon: '📘' },
  { id: 'book_ch', name: 'Carisma frente a cámara', skill: 'charisma', price: 25, icon: '📕' },
  { id: 'book_ed', name: 'Edición de video Pro', skill: 'editing', price: 30, icon: '📗' },
  { id: 'book_gm', name: 'Mentalidad Pro Gamer', skill: 'gaming', price: 30, icon: '📙' },
];

export const INTERNET = [
  { id: 'net_basic', name: 'Básico 20/5 Mbps', upload: 5, price: 30 },
  { id: 'net_fiber', name: 'Fibra 300/30 Mbps', upload: 30, price: 60 },
  { id: 'net_pro', name: 'Fibra Pro 1G/500 Mbps', upload: 500, price: 110 },
];
export const RESOLUTIONS = {
  '720p': { upload: 3.5, encode: 22, mult: 0.85 },
  '1080p': { upload: 6.5, encode: 45, mult: 1.0 },
  '1440p': { upload: 12, encode: 70, mult: 1.1 },
};

export const RENT = 300;
