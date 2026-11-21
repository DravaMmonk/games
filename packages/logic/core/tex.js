// A line of logic as the machine board writes it (a goal, a rule, a step's marks), as TeX for the kernel's typesetting
// (kernel/view Markup, $…$): logic's signs as TeX's, subscript digits as subscripts, a single letter or a ?-letter as a
// math letter, and every other run of words (it rains, 下雨, Human) as upright text.

const SIGNS = {
  'Γ': '\\Gamma',
  '→': '\\to', '↔': '\\leftrightarrow', '∧': '\\land', '∨': '\\lor', '¬': '\\lnot', '∀': '\\forall', '∃': '\\exists',
  '⊥': '\\bot', '⊤': '\\top', '⊢': '\\vdash', '⟹': '\\Longrightarrow', '⟵': '\\longleftarrow', '←': '\\leftarrow',
  '≡': '\\equiv', '⟼': '\\longmapsto', '↷': '\\curvearrowright', '↻': '\\circlearrowright', '↪': '\\hookrightarrow',
  // A goal moved to the end: a down arrow to a bar (⤓), which KaTeX has no glyph for.
  '⤓': '\\underline{\\downarrow}', '✓': '\\checkmark', '⋀': '\\bigwedge', '⟦': '\\llbracket', '⟧': '\\rrbracket',
  '≐': '\\doteq', '×': '\\times', '·': '\\cdot', '≠': '\\neq', '≤': '\\le', '≥': '\\ge', '∈': '\\in', '—': '\\text{—}',
}
const SUBS = '₀₁₂₃₄₅₆₇₈₉'
const ESCAPE = { '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', $: '\\$', '&': '\\&', '#': '\\#', '^': '\\^{}', _: '\\_', '%': '\\%', '~': '\\~{}' }
const MATH_PUNCT = new Set(['(', ')', '[', ']', ',', ':', ';', '=', '+', '-', '<', '>', '|', '!', '/', '*'])
// A word: letters and digits of any script, an apostrophe or hyphen inside; a ?-letter keeps its question mark.
const WORD = /[\p{L}\p{N}'’?-]/u
const isWord = (c) => Boolean(c) && !SIGNS[c] && WORD.test(c) && !SUBS.includes(c)
const letter = (w) => /^\??[A-Za-z][0-9]*$/.test(w) || /^\?[A-Za-z][A-Za-z0-9]*$/.test(w) || /^[0-9]+$/.test(w)
export const texText = (text) => `\\text{${[...text].map((c) => ESCAPE[c] ?? c).join('')}}`

/** One line of the machine's text as TeX (math mode, without the $). */
export function texOf(line) {
  const out = []
  let words = [] // the words of a phrase being read
  // Two things side by side with a space between (R₁ R₃) keep a space in TeX too.
  let ordinary = false
  let spaced = false
  const put = (tex, ord) => {
    if (ord && ordinary && spaced) out.push('\\; ')
    out.push(tex)
    ordinary = ord
    spaced = false
  }
  const flush = () => {
    if (!words.length) return
    const phrase = words.join(' ')
    put(words.length === 1 && letter(phrase) ? phrase : texText(phrase), true)
    words = []
  }
  const chars = [...String(line)]
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    if (isWord(c) && !(c === '?' && !/[A-Za-z]/.test(chars[i + 1] ?? ''))) {
      let w = c
      while (isWord(chars[i + 1])) w += chars[++i]
      words.push(w)
      // Words stay one phrase across single spaces only.
      if (chars[i + 1] === ' ' && isWord(chars[i + 2]) && (words.length > 1 || !letter(w))) { i++; continue }
      flush()
      continue
    }
    flush()
    if (c === ' ') { spaced = true; continue }
    if (SUBS.includes(c)) {
      let n = ''
      while (i < chars.length && SUBS.includes(chars[i])) n += SUBS.indexOf(chars[i++])
      i--
      out.push(`_{${n}}`)
    } else if (c === '⟦' || c === '(' || c === '[') {
      // An opening bracket after a mark and a space (R₁ ⟦…⟧) keeps the space; f(x) does not get one.
      if (ordinary && spaced) out.push('\\; ')
      put(SIGNS[c] ? `${SIGNS[c]} ` : c, false)
    } else if (SIGNS[c]) put(`${SIGNS[c]} `, c === '✓' || c === '⊥' || c === '⊤')
    else if (c === '.') put(chars[i + 1] === ' ' ? '.\\, ' : '.', false)
    else if (c === ')' || c === ']') put(c, true)
    else if (MATH_PUNCT.has(c)) put(c, false)
    else put(`\\text{${ESCAPE[c] ?? c}}`, false)
  }
  flush()
  return out.join('').trim()
}
