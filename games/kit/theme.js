import { T } from './shell/i18n.js'
// The games and Studio share a theme preference. The HTML sets it before first paint.

import { L } from './shell/i18n.js';

export const THEMES = [['paper', T("浅色")], ['night', T("深色")], ['blueprint', T("蓝图")]];
const KEY = 'games.theme';

export const currentTheme = () => document.documentElement.dataset.theme || 'paper';
export const nextTheme = t => THEMES[(THEMES.findIndex(([id]) => id === t) + 1) % THEMES.length][0];
/** The theme's name in the current language. */
export const themeLabel = t => { const [, label] = THEMES.find(([id]) => id === t) || THEMES[0]; return L(label); };

/** Apply a theme, remember it, and tint the browser bar to match the page. */
export function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* the theme still applies for this visit */ }
  const bar = document.querySelector('meta[name="theme-color"]');
  if (bar) bar.content = getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim();
}
