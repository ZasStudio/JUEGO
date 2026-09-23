// Efectos de sonido sintetizados con WebAudio (sin archivos externos).
import { S } from './state.js';

let ctx = null;
let master = null;
let musicNodes = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  master.gain.value = S?.settings?.volume ?? 0.6;
  return ctx;
}

function tone(freq, dur = 0.12, type = 'sine', vol = 0.2, delay = 0, slide = 0) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur = 0.2, vol = 0.15, filterFreq = 1200, delay = 0) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = filterFreq;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
}

export const sfx = {
  click: () => tone(900, 0.05, 'square', 0.05),
  hover: () => tone(1400, 0.03, 'sine', 0.02),
  open: () => { tone(500, 0.08, 'sine', 0.1); tone(800, 0.1, 'sine', 0.1, 0.06); },
  close: () => { tone(700, 0.08, 'sine', 0.1); tone(400, 0.1, 'sine', 0.1, 0.06); },
  notify: () => { tone(880, 0.1, 'triangle', 0.15); tone(1320, 0.15, 'triangle', 0.12, 0.1); },
  money: () => { tone(1200, 0.08, 'square', 0.08); tone(1600, 0.08, 'square', 0.08, 0.08); tone(2000, 0.15, 'square', 0.08, 0.16); },
  error: () => { tone(200, 0.2, 'sawtooth', 0.12); tone(150, 0.25, 'sawtooth', 0.12, 0.12); },
  follow: () => { tone(660, 0.1, 'triangle', 0.15); tone(990, 0.2, 'triangle', 0.15, 0.1); },
  sub: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.15, i * 0.08)); },
  donation: () => { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.2, 'sine', 0.18, i * 0.07)); },
  raid: () => { [220, 330, 440, 660, 880].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.08, i * 0.1)); },
  levelup: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, 'square', 0.08, i * 0.09)); },
  hit: () => { tone(1500, 0.06, 'square', 0.07); noise(0.08, 0.1, 3000); },
  miss: () => tone(180, 0.12, 'sawtooth', 0.08, 0, -80),
  install: () => { noise(0.08, 0.2, 800); tone(300, 0.08, 'square', 0.08, 0.05); },
  boot: () => { tone(440, 0.15, 'sine', 0.12); tone(660, 0.15, 'sine', 0.12, 0.15); tone(880, 0.3, 'sine', 0.12, 0.3); },
  fail: () => { tone(400, 0.2, 'square', 0.1, 0, -200); tone(200, 0.4, 'square', 0.1, 0.2, -100); },
  door: () => { noise(0.25, 0.25, 400); tone(120, 0.2, 'sine', 0.2); },
  step: () => noise(0.05, 0.03, 500),
  eat: () => { noise(0.08, 0.1, 1500); noise(0.08, 0.1, 1500, 0.15); noise(0.08, 0.1, 1500, 0.3); },
  shower: () => noise(1.2, 0.12, 5000),
  scare: () => { tone(90, 0.6, 'sawtooth', 0.2); noise(0.5, 0.3, 2000); },
  cash: () => { noise(0.05, 0.2, 6000); tone(2400, 0.2, 'sine', 0.1, 0.05); },
};

// Música ambiental lo-fi muy simple generada por acordes suaves.
export function startMusic() {
  const c = ac(); if (!c || musicNodes) return;
  const g = c.createGain(); g.gain.value = 0.035; g.connect(master);
  const chords = [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];
  let i = 0;
  const play = () => {
    const t = c.currentTime;
    chords[i % chords.length].forEach((f) => {
      const o = c.createOscillator(); const og = c.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(1, t + 0.4);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 3.8);
      o.connect(og); og.connect(g); o.start(t); o.stop(t + 4);
    });
    i++;
  };
  play();
  const id = setInterval(play, 4000);
  musicNodes = { g, id };
}
export function stopMusic() {
  if (!musicNodes) return;
  clearInterval(musicNodes.id); musicNodes.g.disconnect(); musicNodes = null;
}
export function setVolume(v) { S.settings.volume = v; if (master) master.gain.value = v; }
