// The games and Studio share a theme preference. The HTML sets it before first paint.

import { tr } from './lang.js';

export const THEMES = [['paper', '浅色', 'Light'], ['night', '深色', 'Dark'], ['blueprint', '蓝图', 'Blueprint']];
const KEY = 'games.theme';

export const currentTheme = () => document.documentElement.dataset.theme || 'paper';
export const nextTheme = t => THEMES[(THEMES.findIndex(([id]) => id === t) + 1) % THEMES.length][0];
/** The theme's name in the current language. */
export const themeLabel = t => { const [, zh, en] = THEMES.find(([id]) => id === t) || THEMES[0]; return tr(zh, en); };

/** Apply a theme, remember it, and tint the browser bar to match the page. */
export function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* the theme still applies for this visit */ }
  const bar = document.querySelector('meta[name="theme-color"]');
  if (bar) bar.content = getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim();
}
