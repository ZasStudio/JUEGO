// Mini helper para construir DOM.
import { sfx } from '../core/audio.js';

export function h(tag, props = {}, ...children) {
  const [head, ...cls] = tag.split('.');
  const [t, id] = head.split('#');
  const el = document.createElement(t || 'div');
  if (id) el.id = id;
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      const ev = k.slice(2).toLowerCase();
      if (ev === 'click') el.addEventListener('click', (e) => { if (!el.disabled) sfx.click(); v(e); });
      else el.addEventListener(ev, v);
    } else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && k !== 'list') { try { el[k] = v; } catch (e) { el.setAttribute(k, v); } }
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export const $ = (s, r = document) => r.querySelector(s);
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
export function bar(value, color, label) {
  return h('div.bar', {}, label ? h('span.bar-label', {}, label) : null, h('div.bar-fill', { style: { width: `${Math.max(0, Math.min(100, value))}%`, background: color } }));
}
export const btn = (text, onClick, cls = '', disabled = false) => h('button.btn', { class: cls, onclick: onClick, disabled }, text);

// Evita que append() nativo inserte "null"/"false" como texto cuando se pasan valores condicionales.
const nativeAppend = Element.prototype.append;
Element.prototype.append = function (...nodes) { return nativeAppend.apply(this, nodes.filter((n) => n != null && n !== false)); };
const nativePrepend = Element.prototype.prepend;
Element.prototype.prepend = function (...nodes) { return nativePrepend.apply(this, nodes.filter((n) => n != null && n !== false)); };
