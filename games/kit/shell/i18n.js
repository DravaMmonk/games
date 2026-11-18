// The reading language inside a game (the shared shell and every content pack). The choice itself (stored key, <html lang>, the `langchange`
// event) belongs to games/kit/lang.js, shared with every other page; this module only keeps the current value
// at hand and resolves the game's text with it.
//
// Content has a text per language. A plain string reads the same in every language.
//
// This module has no React, so level data and `npm run check` can use it too; useLang.js is the React hook.
// GameShell keeps the language in React state and re-renders on `langchange`, so anything that calls L or tr
// during render follows the switch. A value stored in state or memoised must store the pair, not its resolved
// string, so it still follows.
import { currentLang } from '../lang.js'
import { firstText, isText, textIn, textKey, isDeveloperTextKey } from '../engine/i18n.js'
export { tr, T } from 'kernel/words'

export const getLang = currentLang

/** Is this an object of language-specific texts? */
export const isPair = isText

// A text object that renders itself (a game's own lazily assembled text) becomes its string.
const selfRendering = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && v.toString !== Object.prototype.toString

/** Resolve a text pair (or pass a plain string, number or nothing through). */
export const L = (v) => (isPair(v) ? sideOf(v, currentLang()) : selfRendering(v) ? String(v) : v)

/** Resolve the requested language and expose missing catalog copy in the game preview. */
export function sideOf(value, side) {
  if (!isPair(value)) return value
  const text = textIn(value, side)
  const key = textKey(value)
  return text.trim() ? text : isDeveloperTextKey(key) ? value.zh ?? firstText(value) : key ? `⟦${key} · ${side}⟧` : firstText(value)
}

/** A reading-language-independent key for React and comparisons. */
export const keyOf = firstText

// Shared punctuation follows the reader's typography and stays outside the catalogs.
const EN_PUNCTUATION = { '：': ': ', '、': ', ', '；': '; ', '？？？': '???', '¥': '$' }
export const punctuation = (mark, lang = currentLang()) => lang === 'en' ? EN_PUNCTUATION[mark] ?? mark : mark
