// Table models use coercible text while the shared shell reads the same translations explicitly.

import { getLang, sideOf } from "kernel"
import { isText } from 'kernel';
import { tr, T as words } from 'kernel/words';

export { tr };
export const isEn = () => getLang() === 'en';

class Txt {
  constructor(text) { Object.assign(this, text); }
  toString() { return isText(this) ? sideOf(this, getLang()) : String(this[getLang()]); }
  toJSON() { return this.toString(); }
}
class Lazy {
  constructor(fn) { this.fn = fn; }
  toString() { return String(this.fn()); }
  toJSON() { return this.toString(); }
}
export const asText = (text) => new Txt(text);
export const T = (...args) => asText(words(...args));
export const lazy = fn => new Lazy(fn);

/** A copy of plain data with display text wrapped for interpolation. */
export const hydrate = v => (isText(v) && (v.$key || typeof v.zh === 'string' && typeof v.en === 'string') ? new Txt(v) : Array.isArray(v) ? v.map(hydrate) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, hydrate(x)])) : v);
