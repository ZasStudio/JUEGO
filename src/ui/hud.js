// HUD principal, notificaciones, diálogos, transiciones y mensajes grandes.
import { S, bus, fmtMoney, fmtNum, fmtClock, dayName, SKILL_NAMES, skill } from '../core/state.js';
import { h, $, clear, bar, btn } from './dom.js';
import { QUESTS } from '../data/progress.js';
import { sfx } from '../core/audio.js';
import { mood } from '../game/sim.js';

let root;
const refs = {};

export function initHUD() {
  root = $('#ui');
  refs.hud = h('div#hud.hidden', {},
    h('div.hud-top', {},
      refs.clock = h('div.hud-chip.clock'),
      refs.money = h('div.hud-chip.money'),
      refs.fol = h('div.hud-chip.fol'),
      refs.subs = h('div.hud-chip.subs'),
      refs.mail = h('div.hud-chip.mailchip', { title: 'Correos sin leer' }),
    ),
    refs.needs = h('div.needs'),
    refs.quest = h('div.quest'),
    refs.prompt = h('div.prompt.hidden'),
    h('div.help', {}, 'WASD mover · Shift correr · Arrastrar ratón: cámara · Rueda: zoom · E interactuar · Tab teléfono · Esc menú'),
  );
  refs.toasts = h('div#toasts');
  refs.modal = h('div#modal-root');
  refs.fade = h('div#fade');
  refs.big = h('div#bigmsg.hidden');
  root.append(refs.hud, refs.toasts, refs.modal, refs.fade, refs.big);

  bus.on('toast', ({ text, type }) => toast(text, type));
  bus.on('bigmsg', (t, s) => bigMessage(t, s));
  bus.on('levelup', (sk, lv) => { toast(`⬆️ ${SKILL_NAMES[sk]} subió a nivel ${lv}`, 'gold'); sfx.levelup(); });
}

export function showHUD(v) { refs.hud.classList.toggle('hidden', !v); }

export function updateHUD() {
  if (!S) return;
  refs.clock.textContent = `📅 Día ${S.day + 1} · ${dayName()} ${fmtClock(S.minute)}`;
  refs.money.textContent = `💵 ${fmtMoney(S.money)}`;
  refs.money.classList.toggle('neg', S.money < 0);
  refs.fol.textContent = `💜 ${fmtNum(S.stats.followers)} seguidores`;
  refs.subs.textContent = S.flags.affiliate ? `⭐ ${fmtNum(S.stats.subs)} subs` : '⭐ —';
  const unread = S.emails.filter((e) => !e.read).length;
  refs.mail.textContent = `✉️ ${unread}`;
  refs.mail.classList.toggle('unread', unread > 0);
  const N = S.needs;
  const col = (v) => (v > 60 ? '#2ecc71' : v > 30 ? '#f1c40f' : '#e74c3c');
  clear(refs.needs).append(
    needRow('🍔', 'Hambre', N.hunger, col(N.hunger)),
    needRow('⚡', 'Energía', N.energy, col(N.energy)),
    needRow('🚿', 'Higiene', N.hygiene, col(N.hygiene)),
    needRow('🎮', 'Diversión', N.fun, col(N.fun)),
    h('div.mood', {}, `Ánimo: ${moodText(mood())}`),
  );
  const q = QUESTS[S.quests.index];
  clear(refs.quest).append(q ? h('div', {}, h('div.q-title', {}, '🎯 ' + q.title), h('div.q-desc', {}, q.desc)) : h('div.q-title', {}, '🏆 ¡Completaste todas las misiones!'));
}
function needRow(icon, name, v, color) {
  return h('div.need', { title: `${name}: ${Math.round(v)}%` }, h('span.need-i', {}, icon), bar(v, color));
}
export function moodText(m) { return m > 75 ? '😄 Genial' : m > 55 ? '🙂 Bien' : m > 35 ? '😐 Regular' : m > 20 ? '😟 Mal' : '😫 Fatal'; }

export function setPrompt(text) {
  if (!text) { refs.prompt.classList.add('hidden'); return; }
  refs.prompt.classList.remove('hidden');
  refs.prompt.innerHTML = `<kbd>E</kbd> ${text}`;
}

export function toast(text, type = 'info') {
  const t = h('div.toast', { class: type }, text);
  refs.toasts.appendChild(t);
  if (refs.toasts.children.length > 6) refs.toasts.firstChild.remove();
  setTimeout(() => t.classList.add('out'), 4200);
  setTimeout(() => t.remove(), 4800);
}

export function bigMessage(title, sub) {
  const b = refs.big;
  clear(b).append(h('div.big-title', {}, title), h('div.big-sub', {}, sub || ''));
  b.classList.remove('hidden');
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(b._t);
  b._t = setTimeout(() => b.classList.add('hidden'), 4500);
}

export function fade(fn, ms = 350) {
  return new Promise((res) => {
    refs.fade.classList.add('on');
    setTimeout(async () => { await fn?.(); refs.fade.classList.remove('on'); setTimeout(res, ms); }, ms);
  });
}

// Modal genérico
let modalStack = [];
export function modal({ title, content, actions = [], wide = false, onClose, closable = true, cls = '' }) {
  sfx.open();
  const close = () => { sfx.close(); wrap.remove(); modalStack = modalStack.filter((m) => m !== api); onClose?.(); };
  const body = h('div.modal-body');
  if (typeof content === 'function') content(body, close); else if (content) body.append(content);
  const wrap = h('div.modal-wrap', { onclick: (e) => { if (e.target === wrap && closable) close(); } },
    h('div.modal', { class: (wide ? 'wide ' : '') + cls },
      h('div.modal-head', {}, h('div.modal-title', {}, title), closable ? h('button.x', { onclick: close }, '✕') : null),
      body,
      actions.length ? h('div.modal-actions', {}, actions.map((a) => btn(a.text, () => { if (a.keep) a.fn?.(); else { close(); a.fn?.(); } }, a.cls || '', a.disabled))) : null,
    ));
  refs.modal.appendChild(wrap);
  const api = { close, body, wrap };
  modalStack.push(api);
  return api;
}
export const modalOpen = () => modalStack.length > 0;
export function closeTopModal() { const m = modalStack[modalStack.length - 1]; if (m) { m.close(); return true; } return false; }

// Menú de opciones (lista de elecciones)
export function choose(title, options, desc) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title,
      content: (body, close) => {
        if (desc) body.append(h('p.muted', {}, desc));
        const list = h('div.choice-list');
        for (const o of options) {
          list.append(h('button.choice', {
            disabled: o.disabled,
            onclick: () => { done = true; close(); resolve(o.value); },
          }, h('span.choice-icon', {}, o.icon || '•'), h('span.choice-text', {}, h('b', {}, o.label), o.sub ? h('small', {}, o.sub) : null)));
        }
        body.append(list);
      },
      onClose: () => { if (!done) resolve(null); },
    });
    return m;
  });
}

export function progressOverlay(text, seconds) {
  return new Promise((res) => {
    const fill = h('div.pfill');
    const o = h('div.progress-overlay', {}, h('div.ptext', {}, text), h('div.pbar', {}, fill));
    root.appendChild(o);
    const t0 = performance.now();
    const step = () => {
      const k = (performance.now() - t0) / (seconds * 1000);
      fill.style.width = `${Math.min(100, k * 100)}%`;
      if (k >= 1) { o.remove(); res(); } else requestAnimationFrame(step);
    };
    step();
  });
}

export function skillsPanel() {
  return h('div.skills', {}, Object.keys(SKILL_NAMES).map((k) => {
    const lv = skill(k);
    const xp = S.skills[k];
    const cur = (lv - 1) ** 2 * 40, next = lv ** 2 * 40;
    return h('div.skill', {}, h('div.skill-h', {}, h('b', {}, SKILL_NAMES[k]), h('span', {}, `Nv ${lv}`)), bar(lv >= 10 ? 100 : ((xp - cur) / (next - cur)) * 100, '#9146ff'));
  }));
}
