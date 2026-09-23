// Pantalla de creación de personaje.
import { h, $, clear, btn } from './dom.js';
import { LOOK_OPTIONS, defaultLook, randomLook } from '../world/character.js';

const LABELS = {
  skin: 'Tono de piel', hairStyle: 'Peinado', hairColor: 'Color de pelo', shirtStyle: 'Ropa', shirtColor: 'Color de ropa',
  pantsColor: 'Pantalón', shoesColor: 'Zapatillas', eyeColor: 'Ojos',
};

export function openCreator({ character, onDone, onBack, initial, wardrobe = false }) {
  const look = { ...defaultLook(), ...(initial?.look || {}) };
  let name = initial?.name || '', channel = initial?.channel || '';
  const root = h('div#creator');
  $('#ui').appendChild(root);

  const apply = () => character.setLook(look);
  const render = () => {
    clear(root);
    const panel = h('div.creator-panel', {},
      h('h2', {}, wardrobe ? '👕 Armario' : '✨ Crea a tu streamer'),
      wardrobe ? null : h('label', {}, 'Tu nombre'),
      wardrobe ? null : h('input.inp', { value: name, maxLength: 16, placeholder: 'Ej: Alex', oninput: (e) => { name = e.target.value; } }),
      wardrobe ? null : h('label', {}, 'Nombre del canal'),
      wardrobe ? null : h('input.inp', { value: channel, maxLength: 18, placeholder: 'Ej: AlexPlaysTV', oninput: (e) => { channel = e.target.value; } }),
      ...Object.keys(LABELS).map((k) => h('div.opt', {},
        h('label', {}, LABELS[k]),
        h('div.opt-row', {}, LOOK_OPTIONS[k].map((v) => v.startsWith('#')
          ? h('button.swatch', { style: { background: v }, class: look[k] === v ? 'sel' : '', onclick: () => { look[k] = v; apply(); render(); } })
          : h('button.chip', { class: look[k] === v ? 'sel' : '', onclick: () => { look[k] = v; apply(); render(); } }, v))),
      )),
      h('div.opt', {}, h('label', {}, 'Accesorios'), h('div.opt-row', {},
        ...[['glasses', '👓 Lentes'], ['beard', '🧔 Barba'], ['headset', '🎧 Audífonos']].map(([k, n]) => h('button.chip', { class: look[k] ? 'sel' : '', onclick: () => { look[k] = !look[k]; apply(); render(); } }, n)))),
      h('div.opt', {}, h('label', {}, `Altura`), h('input', { type: 'range', min: 0.88, max: 1.12, step: 0.01, value: look.height, oninput: (e) => { look.height = +e.target.value; apply(); } })),
      h('div.opt', {}, h('label', {}, `Complexión`), h('input', { type: 'range', min: 0.85, max: 1.2, step: 0.01, value: look.build, oninput: (e) => { look.build = +e.target.value; apply(); } })),
      h('div.row', {},
        btn('🎲 Aleatorio', () => { Object.assign(look, randomLook()); apply(); render(); }),
        onBack ? btn('← Volver', () => { root.remove(); onBack(); }) : null,
        btn(wardrobe ? '✔ Listo' : '▶ Comenzar', () => {
          const n = name.trim() || 'Streamer';
          const c = channel.trim() || `${n}TV`;
          root.remove();
          onDone({ name: n, channel: c, look: { ...look } });
        }, 'big good'),
      ),
    );
    root.append(panel, h('div.creator-hint', {}, 'Arrastra para girar el personaje'));
  };
  apply();
  render();
  return root;
}
