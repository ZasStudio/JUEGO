// Generación de nombres de espectadores y mensajes de chat.
import { pick, randi, chance } from '../core/state.js';

const A = ['dark', 'pro', 'xx', 'el', 'la', 'super', 'mega', 'lil', 'king', 'queen', 'noob', 'toxic', 'chill', 'epic', 'neo', 'cyber', 'turbo', 'mr', 'lady', 'don', 'zeta', 'kawaii', 'shadow', 'pixel'];
const B = ['gamer', 'panda', 'lobo', 'taco', 'ninja', 'gato', 'dragón', 'pollo', 'sniper', 'kiwi', 'rata', 'fénix', 'wolf', 'nacho', 'bot', 'zorro', 'mango', 'tiburón', 'player', 'cabra', 'churro', 'cactus', 'ghost', 'sushi'];
const COLORS = ['#ff4d4d', '#ff9f1a', '#ffd32a', '#32ff7e', '#18dcff', '#7d5fff', '#ff66c4', '#3ae374', '#67e6dc', '#c56cf0', '#ffb8b8', '#17c0eb'];

export function viewerName() {
  let n = pick(A) + (chance(0.5) ? '_' : '') + pick(B);
  if (chance(0.6)) n += randi(1, 999);
  return n.replace('á', 'a').replace('ó', 'o').replace('é', 'e');
}
export const nameColor = () => pick(COLORS);

const GENERIC = [
  'holaaa 👋', 'buenas!!', 'primera vez por aquí', 'que onda', 'saludos desde México 🇲🇽', 'saludos desde Argentina 🇦🇷',
  'saludos desde España 🇪🇸', 'saludos desde Colombia 🇨🇴', 'saludos desde Chile 🇨🇱', 'saludos desde Perú 🇵🇪',
  'jajajaja', 'JAJAJAJ', 'xd', 'XDDD', 'F', 'GG', 'gg wp', '😂😂', '🔥🔥🔥', 'buen stream', 'me encanta tu contenido',
  'que buen setup', 'cuantas horas llevas?', 'ya cenaste?', 'ánimo!!', 'te sigo desde el principio', 'lurkeando 👀',
  'eso estuvo bueno', 'clip it!!', 'hermoso', 'no puede ser', 'KEKW', 'POGGERS', 'nooo', 'sííí', 'dale dale dale', 'W', 'L',
  'que música es esa?', 'hola chat', 'alguien más viendo desde el cel?', '💜💜💜', 'modo tryhard activado', 'bro 💀',
];
const HYPE = ['ESTO ESTÁ ÉPICO 🔥', 'POGGGG', 'LOCURAAA', 'QUE JUGADAAA', 'CLIP CLIP CLIP', 'EL MEJOR STREAM', '🔥🔥🔥🔥', 'GOD', 'INSANO'];
const BORED = ['aburrido...', 'zzz', 'haz algo', 'me voy a dormir', 'muy lento esto', 'otro juego plz'];
const LAG = ['LAG', 'se traba mucho', 'baja la calidad', 'pixelado 😭', 'buffering...', 'se congeló?'];
const AUDIO = ['no se escucha bien', 'el micro suena raro', 'sube el volumen del mic', 'audio de lata jaja'];
const NOCAM = ['pon cámara!!', 'cam cuándo?', 'queremos ver tu cara'];
const TIRED = ['te ves cansado', 've a dormir jaja', 'descansa un rato'];
const TROLL = ['stream basura', 'nadie te ve jajaja', 'eres malísimo', 'unfollow', 've a trabajar', 'spam spam spam', 'kkkkkkkkk lol', 'visitame en bit.ly/free-skins', 'quien ve esto?'];

const BY_GENRE = {
  aim: ['headshot!!', 'apunta mejor', 'que aim', 'sensibilidad?', 'usa la escopeta', 'rotate rotate', 'estaba detrás!', 'victoria magistral?'],
  timing: ['casi!', 'uff por poco', 'que timing', 'record personal?', 'speedrun any% 😂', 'dale que sale'],
  qte: ['que miedo 😱', 'atrás atrás!', 'no abras esa puerta', 'combo!', 'esquiva!', 'el boss te va a destruir'],
  chat: ['cuéntanos algo', 'qué opinas de la pizza con piña?', 'jugamos algo después?', 'lee mi mensaje plz', 'tienes mascota?'],
};

export const QUESTIONS = [
  { q: '¿Qué specs tiene tu PC?', a: [{ t: 'Explicar las specs con detalle', h: 8, skill: 'hardware' }, { t: '"Una tostadora" 😂', h: 5 }, { t: 'Ignorar', h: -4 }] },
  { q: '¿Cuántos años llevas jugando?', a: [{ t: 'Contar tu historia gamer', h: 9 }, { t: '"Desde siempre"', h: 3 }, { t: 'Ignorar', h: -4 }] },
  { q: '¿Me saludas? es mi cumple 🎂', a: [{ t: '¡Cantar feliz cumpleaños!', h: 12 }, { t: '"Feliz cumple!"', h: 5 }, { t: 'Ignorar', h: -6 }] },
  { q: '¿Haces un reto: jugar sin mirar?', a: [{ t: 'Aceptar el reto 😎', h: 10, risk: true }, { t: '"Otro día"', h: 1 }, { t: 'Ignorar', h: -3 }] },
  { q: '¿Qué juego jugamos mañana?', a: [{ t: 'Hacer una encuesta', h: 9 }, { t: '"Sorpresa"', h: 4 }, { t: 'Ignorar', h: -3 }] },
  { q: '¿Tips para empezar a streamear?', a: [{ t: 'Dar consejos sinceros', h: 8 }, { t: '"Compra buen micro"', h: 4 }, { t: 'Ignorar', h: -3 }] },
  { q: '¿Te gusta el anime?', a: [{ t: 'Debatir sobre tu top 5', h: 7 }, { t: '"Un poco"', h: 2 }, { t: 'Ignorar', h: -3 }] },
  { q: '¿Nos muestras tu setup?', a: [{ t: 'Hacer tour del setup', h: 8, setup: true }, { t: '"Luego"', h: 1 }, { t: 'Ignorar', h: -3 }] },
  { q: '¿Cuál es tu comida favorita?', a: [{ t: 'Hablar de comida por 5 min', h: 6 }, { t: '"Pizza, obvio"', h: 4 }, { t: 'Ignorar', h: -3 }] },
  { q: '¿Juegas con subs algún día?', a: [{ t: 'Prometer noche de subs', h: 11 }, { t: '"Tal vez"', h: 3 }, { t: 'Ignorar', h: -5 }] },
];

const DONATION_MSG = [
  'para la pizza 🍕', 'sigue así!!', 'para el micro nuevo', 'saludos a mi abuela', 'te amo bro', 'lee esto con voz de pato',
  'por el clip de ayer jaja', 'para la luz', 'mejor streamer', 'di "papas" 10 veces', 'para la RTX nueva', 'primera donación!!',
];

export function genericMessage(ctx) {
  const pool = [...GENERIC];
  if (ctx.mini && BY_GENRE[ctx.mini]) pool.push(...BY_GENRE[ctx.mini], ...BY_GENRE[ctx.mini]);
  if (ctx.hype > 70) pool.push(...HYPE, ...HYPE);
  if (ctx.hype < 20) pool.push(...BORED);
  if (ctx.lag) pool.push(...LAG, ...LAG, ...LAG);
  if (ctx.micQ < 0.4) pool.push(...AUDIO);
  if (!ctx.cam) pool.push(...NOCAM);
  if (ctx.energy < 25) pool.push(...TIRED, ...TIRED);
  return pick(pool);
}
export const trollMessage = () => pick(TROLL);
export const donationMessage = () => pick(DONATION_MSG);

// Nombres para correos, clientes y streamers ficticios
export const CLIENTS = ['Andrés', 'Lucía', 'Marcos', 'Sofía', 'Diego', 'Valentina', 'Tomás', 'Camila', 'Joaquín', 'Martina', 'Mateo', 'Isabella', 'Bruno', 'Renata', 'Julián', 'Paula'];
export const BRANDS = ['VoltX Energy', 'HyperGear', 'NovaChairs', 'PixelSnacks', 'ZonaVPN', 'KeyStorm', 'AudioLab', 'CloudHost Pro'];
export const STREAMERS = ['@LaRataGamer', '@PandaPro', '@NinjaDeBarrio', '@QueenPixel', '@ZetaLoco', '@MangoStreams', '@ChurroKing', '@LunaByte'];
