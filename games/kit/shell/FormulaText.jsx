import { L } from './i18n.js'
import { Typeset } from './Typeset.jsx'

// A formula in a shared view (a rule row's slot, a sentence picked, a sentence quoted in a text): typeset in TeX once a
// domain says how its formulas read as TeX (logic: its signs and words, typesetFormulas), else its plain text. Prose
// never goes through here; what the player is still editing (a strip of blocks) is not a formula yet.
let toTex = null

/** How a formula's text reads as TeX (a function of the text), for every formula shown from now on. */
export function typesetFormulas(convert) {
  toTex = convert
}

/** One formula (a string or a { zh, en } pair, in the reading language). */
export function FormulaText({ text, className = '' }) {
  const line = text === null || text === undefined ? '' : String(L(text))
  if (!toTex || !line) return line
  return <span className={`formula ${className}`.trim()}><Typeset tex={toTex(line)} plain={line} /></span>
}
