// What a proof card's settings offer (《证明完毕》): the level's own sentences and every part of them, any one starting
// with ∃ for what Example concludes, the names of particular things its proof needs (names.js: only as many as it uses)
// and the compound terms they use. A part of a sentence that has a bound variable free is offered with each such name
// in its place. A level may offer sentences its premises and goal do not hold (`sentences`: an assumption a proof
// needs, such as ¬A for a proof by contradiction), in its schema's letters. The board shows them (ui/boards.jsx) and
// validate.js checks that the reference proof picks only from them. A level with a ∀ over sentences (∀R. …) also lets
// the for-any box take R instead of a thing (`letters`), and offers sentences as what choosing an instance puts in;
// one over properties (∀P. P(a) → …) offers properties, sentences about x: a part of a sentence with its one free
// variable, or one particular thing in it, made x.
import { arityIn, freeVars, parse, replaceTerm, show, showTerm, subst, termsOf, tvar } from './formula.js'
import { compoundTerms, subformulas } from './notation.js'
import { NAMES, bindsThing, boxNames, mentions, reservedIn } from './names.js'

/** What each card's settings pick, when not any sentence (the default, 'formula'). */
export const SETTING_KINDS = Object.fromEntries(Object.entries({ allI: { x: 'letter' }, allE: { t: 'instance' }, exI: { target: 'exists' }, refl: { t: 'term' }, iffSubst: { at: 'occurrence' } }).map(([name, value]) => [`logic/${name}`, value]))

// A formula with each of its free variables replaced by a name, every way.
function named(f, names) {
  const free = [...freeVars(f)]
  return free.reduce((list, v) => list.flatMap((g) => names.map((n) => subst(g, v, tvar(n)))), [f])
}
const unique = (list) => [...new Map(list.map((f) => [show(f), f])).values()]

// The names a level's own proof uses: those its boxes take and those its cards mention (most need just a).
function namesOf(level) {
  const nodes = level.solution?.nodes ?? []
  const texts = nodes.flatMap((node) => Object.values(node.params ?? {}).filter((v) => typeof v === 'string'))
  const taken = new Set(Object.values(boxNames({ nodes }, bindsThing(level.parts), reservedIn(level))))
  return NAMES.filter((n) => taken.has(n) || texts.some((t) => mentions(t, n)))
}

// Each part of the sentences as a property of x: its one free variable made x, or, with none free, one of the
// particular things it names (every place that thing is) made x.
function propertiesOf(parts) {
  const out = parts.filter((f) => !(f.op === '∀' && f.prop)).flatMap((f) => {
    const free = [...freeVars(f)]
    if (free.length === 1) return [subst(f, free[0], tvar('x'))]
    if (free.length) return []
    const things = [...new Map(termsOf(f).filter((t) => t.t === 'fn' && !t.args.length).map((t) => [t.f, t])).values()]
    return things.map((t) => replaceTerm(f, t, tvar('x'), () => true))
  })
  return [...new Set(out.map((f) => show(f)))]
}

/** { formula: [formula], exists: [formula], term: [text], instance: [text], letter: [text] } for a proof level. */
export function choicesOf(level) {
  const consts = level.consts ?? []
  // The schema is the course's (its last test, in letters); a bare level stands on its last test.
  const { premises = {}, goal } = level.schema ?? level.tests.at(-1)
  const names = namesOf(level)
  const schema = [...Object.values(premises), goal].map((t) => parse(t, { consts }))
  const extra = (level.sentences ?? []).map((t) => parse(t, { consts }))
  const sentences = unique(subformulas([...schema, ...extra]).flatMap((f) => named(f, names)))
  // A compound term (s(x)) is offered with names in its places too.
  const terms = schema.flatMap(compoundTerms).flatMap((t) => named(parse(`T(${t})`, { consts }), names).map((g) => showTerm(g.args[0])))
  // A ∀ over sentences (∀R. …): the for-any box may take R, and choosing an instance may put in a sentence.
  const over = subformulas([...schema, ...extra]).filter((f) => f.op === '∀' && f.prop)
  const term = [...new Set([...consts, ...names, ...terms])]
  const plain = sentences.filter((f) => !(f.op === '∀' && f.prop))
  return {
    formula: sentences,
    exists: sentences.filter((f) => f.op === '∃'),
    term,
    instance: [
      ...term,
      ...(over.some((f) => arityIn(f.body, f.v) === 0) ? plain.map((f) => show(f)) : []),
      ...(over.some((f) => arityIn(f.body, f.v) > 0) ? propertiesOf(subformulas([...schema, ...extra])) : []),
    ],
    letter: [...new Set(over.map((f) => f.v))],
  }
}

/** The choice a setting holds, written the way choicesOf's are, to compare. */
export const choiceKey = (kind, text, level) => (kind === 'formula' || kind === 'exists' || (kind === 'instance' && /^[A-Z¬(⊥∀∃]|[=→∧∨↔]/.test(text)) ? show(parse(text, { consts: level.consts ?? [] })) : text)
