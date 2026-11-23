import { T as catalogText } from 'kernel/words'
import { sideOf } from 'kernel'
// How a level writes its formulas for the player (《证明完毕》). A level may give its proposition letters everyday
// sentences (`words`: { Rain: { zh: '下雨', en: 'it rains' } }), so early proofs are about rain and wet ground rather
// than A and B; and a connective is written as its symbol only once the course has introduced it (`symbols`), in
// words before that ("若下雨，则地湿"). Formulas themselves stay letters underneath (formula.js).
//
//   notation  { words: { letter: { zh, en } } | null, symbols: [connective], brackets?: every connective inside another
//             in brackets, not just → and ↔ (a task's brief) }
//
// First-order words (chapter 6 on): a predicate's words are a template, its arguments as {0}, {1}
// (Human: { zh: '{0}是人' }), and a constant's words are its name (ann: { zh: '安' }); a variable stays itself.
import { arityIn, show, showTerm, termsOf } from './formula.js'

const BIN = { '→': 1, '↔': 0, '∨': 2, '∧': 3 }
const QUANT = {
  '∀': (name, body) => catalogText('对所有 {name}，{body}', { name, body }),
  '∃': (name, body) => catalogText('有一个 {name}，{body}', { name, body }),
}
// A term in words: a name by its words, a function by its template (mul: '{0}·{1}'), a variable as written.
function termWords(t, notation, lang) {
  if (t.t !== 'fn') return showTerm(t)
  // A word with places is a function's: a bare name of the same letter (a thing a box took, c) is just itself.
  const word = sideOf(notation.words?.[t.f], lang)
  if (!word || (!t.args.length && /\{\d\}/.test(word))) return t.args.length ? `${t.f}(${t.args.map((a) => termWords(a, notation, lang)).join(', ')})` : t.f
  return t.args.length ? fill(word, t.args, notation, lang) : word
}
// A template's places filled in. An argument that is itself an operation keeps brackets, (a·b)⁻¹; after a name
// written in front (S {0}, Vec {0}), any argument applied to something does: S (S 0), Vec (x + y).
function fill(word, args, notation, lang) {
  const prefix = /^[^{\s]+ \{/.test(word)
  const arg = (a) => (a.t === 'fn' && a.args.length > (prefix ? 0 : 1) ? `(${termWords(a, notation, lang)})` : termWords(a, notation, lang))
  return word.replace(/\{(\d)\}/g, (_, k) => arg(args[Number(k)]))
}
const WORDS = {
  '→': (left, right) => catalogText('若{left}，则{right}', { left, right }),
  '∧': (left, right) => catalogText('{left}并且{right}', { left, right }),
  '∨': (left, right) => catalogText('{left}或者{right}', { left, right }),
  '↔': (left, right) => catalogText('{left}等价于{right}', { left, right }),
}

/** A formula in a level's notation, in one language ('zh' | 'en'). */
export function render(f, notation, lang, outer = -1, mark) {
  const text = renderNode(f, notation, lang, outer, mark)
  return mark ? mark(f, text) : text
}

function renderNode(f, notation, lang, outer, mark) {
  const known = (op) => notation.symbols.includes(op)
  const wrap = (s, level) => (level < outer ? `(${s})` : s)
  const draw = (node, precedence = -1) => render(node, notation, lang, precedence, mark)
  // In words a part that is itself compound goes in brackets, so the sentence reads one way only.
  const part = (g) => (g.op === 'atom' || g.op === '⊥' ? draw(g) : `(${draw(g)})`)
  switch (f.op) {
    case 'atom': {
      const word = sideOf(notation.words?.[f.pred], lang)
      if (word && f.args.length) return fill(word, f.args, notation, lang)
      if (f.pred === '=') return `${termWords(f.args[0], notation, lang)} = ${termWords(f.args[1], notation, lang)}`
      // A predicate named on its own (a test case's P := Human) reads with its places left open.
      if (word && !f.args.length) return word.replace(/\{\d\}/g, '…')
      // A predicate without words (a schema's letter, P) keeps its letter, its things in their words: P(安).
      return f.args.length ? `${f.pred}(${f.args.map((t) => termWords(t, notation, lang)).join(', ')})` : show(f)
    }
    case 'meta': return f.args?.length ? `${f.name}(${f.args.map((t) => termWords(t, notation, lang)).join(', ')})` : f.name
    case '⟹': return `⟦${draw(f.a)}⟧ ⟹ ${draw(f.b)}`
    case '⊥': return known('⊥') ? '⊥' : sideOf(catalogText('矛盾', {}, 'notation'), lang)
    case '¬': return known('¬') ? `¬${draw(f.a, 9)}` : sideOf(catalogText('并非{formula}', { formula: part(f.a) }), lang)
    case '∀': case '∃': {
      const arity = f.prop ? arityIn(f.body, f.v) : -1
      if (notation.propertyWords && notation.words && (arity === 0 || arity === 1)) {
        const meaning = arity === 0 ? catalogText("该命题") : catalogText("{0}具有该性质")
        const body = render(f.body, { ...notation, words: { ...notation.words, [f.v]: meaning } }, lang, -1, mark)
        const prefix = arity === 0
          ? (f.op === '∀' ? catalogText("对于任意命题，") : catalogText("存在一个命题，使得"))
          : (f.op === '∀' ? catalogText("对于任意性质，") : catalogText("存在一种性质，使得"))
        return wrap(`${prefix[lang]}${body}`, -1)
      }
      return known(f.op) ? wrap(`${f.op}${f.v}. ${draw(f.body)}`, -1) : wrap(sideOf(QUANT[f.op](f.v, draw(f.body)), lang), -1)
    }
    default: {
      const p = BIN[f.op]
      // An → or ↔ inside another connective always keeps its brackets: A → (B → A), never A → B → A; with
      // `brackets` (a task's brief) every connective inside another does: A ∨ (B ∧ C).
      const inner = (g) => g.op === '→' || g.op === '↔' || (notation.brackets && BIN[g.op] !== undefined)
      const side = (g, level) => (inner(g) ? `(${draw(g)})` : draw(g, level))
      if (known(f.op)) return wrap(`${side(f.a, f.op === '→' ? p + 1 : p)} ${f.op} ${side(f.b, f.op === '→' ? p : p + 1)}`, p)
      return sideOf(WORDS[f.op](part(f.a), part(f.b)), lang)
    }
  }
}

/** A formula as a { zh, en } pair, in `notation` (plain letters and symbols without one). */
export const say = (f, notation) => (notation ? { zh: render(f, notation, 'zh'), en: render(f, notation, 'en') } : { zh: show(f), en: show(f) })

/** Every formula inside some formulas (themselves included), each once, in the order they appear. */
export function subformulas(formulas) {
  const out = new Map()
  const walk = (f) => {
    if (f.op === '⊥' || f.op === 'meta') return
    out.set(show(f), out.get(show(f)) ?? f)
    if (f.op === '¬') walk(f.a)
    else if (f.body) walk(f.body)
    else if (f.a) { walk(f.a); walk(f.b) }
  }
  formulas.forEach(walk)
  return [...out.values()]
}


/** The compound terms (a function of something) in a formula, as written. */
export const compoundTerms = (f) => termsOf(f).filter((t) => t.t === 'fn' && t.args.length).map(showTerm)

/** A term as a { zh, en } pair, in a level's notation. */
export const sayTerm = (t, notation) => ({ zh: termWords(t, notation ?? {}, 'zh'), en: termWords(t, notation ?? {}, 'en') })
