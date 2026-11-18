// The games and Studio share a language preference. The browser language supplies the default.

import { uiLocales } from 'kernel/words';

export const LANGS = [['zh', '中文'], ['en', 'English']];
const KEY = 'games.lang';
let selected;

export function currentLang() {
  if (selected) return selected;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && (stored === 'zh' || stored === 'en' || uiLocales.includes(stored))) return stored;
  } catch { /* fall through to the browser language */ }
  const browser = globalThis.navigator?.language ?? '';
  const base = browser.split('-')[0];
  return uiLocales.includes(browser) ? browser : base === 'zh' || uiLocales.includes(base) ? base : 'en';
}

export function languageOptions() {
  return [['zh', '简体中文'], ['en', 'English'], ...uiLocales.filter(code => code !== 'zh' && code !== 'en')
    .map(code => [code, new Intl.DisplayNames([code], { type: 'language' }).of(code)])];
}

export const otherLang = l => (l === 'en' ? 'zh' : 'en');
export const langLabel = l => (LANGS.find(([id]) => id === l) || LANGS[0])[1];

export { tr } from 'kernel/words';

/** Apply a language, remember it, mark <html lang>, and tell the page with a `langchange` event. */
export function applyLang(l) {
  selected = l;
  try { localStorage.setItem(KEY, l); } catch { /* the language still applies for this visit */ }
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : l;
  window.dispatchEvent(new CustomEvent('langchange', { detail: l }));
}
