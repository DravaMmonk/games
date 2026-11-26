import { punctuation } from 'kernel'
import { sideOf } from "kernel"
import { T } from 'kernel/words'
import { say } from './notation.js'
import { cases, inOrder, property } from 'kernel'
import { builtWorld, claimIn, MAX_WORLD } from './fol.js'
import { holds } from './models.js'
import { atom, parse } from './formula.js'

const MARKS = ['①', '②', '③', '④']

/** What a thing is called: a named world's thing by its words, a built world's by its mark. */
export const thingName = (notation, world, lang) => (k) => world ? sideOf(notation.words?.[world.things[k]], lang) ?? world.things[k] : MARKS[k]

/** A world in words: how many things, and every atom true in it, as sentences. */
function describe(model, notation, preds, world, lang) {
  const L = (value) => sideOf(value, lang)
  const name = thingName(notation, world, lang)
  const sayAtom = (p, args) => (notation.words?.[p] ? L(notation.words[p]) : `${p}({0})`).replace(/\{(\d)\}/g, (_, k) => name(args[Number(k)]))
  const atoms = preds.flatMap(([p, n]) => {
    const ext = model.preds[p]
    if (n === 0) return ext ? [L(say({ op: 'atom', pred: p, args: [] }, notation))] : []
    return [...(ext ?? [])].map((key) => sayAtom(p, key.split(',').map(Number)))
  })
  // A named world's things are their own names: only other names need saying.
  const consts = Object.entries(model.fns).filter(([c, m]) => m.has('') && !world?.things.includes(c)).map(([c, m]) => `${L(notation.words?.[c] ?? c)} = ${name(m.get(''))}`)
  return [
    { text: L(T("这种情形包含 {length} 样东西：", {length: model.domain.length, value: model.domain.length === 1 ? '' : 's'})), strong: model.domain.map(name).join(punctuation("、", lang)) },
    ...(consts.length ? [{ text: consts.join(punctuation("；", lang)) }] : []),
    { text: atoms.length ? atoms.join(punctuation("；", lang)) : L(T('什么都不成立。')) },
  ]
}

export function worldDescription(model, notation, preds, world) {
  const zh = describe(model, notation, preds, world, 'zh')
  const en = describe(model, notation, preds, world, 'en')
  return zh.map(({ text, strong }, k) => ({
    text: { zh: text, en: en[k].text },
    strong: strong === undefined ? null : { zh: strong, en: en[k].strong },
  }))
}

const truth = (value) => value ? T("真", {}, "world-values") : T("假", {}, "world-values")
const isWorld = (work) => work !== null && typeof work === 'object' && !Array.isArray(work) && Number.isInteger(work.size) && work.size >= 1
const worldShape = inOrder(
  property(isWorld, () => ({ why: T("请输入有效的情形设定。") })),
  property((work) => work.size <= MAX_WORLD, () => ({ why: T("这种情形包含的东西太多。") })),
)

// A predicate's words with its places filled: 「{0}是人」 is 「是人」 on a thing, 「{0}喜欢{1}」 is 「①喜欢②」 beside the
// arrows, as the cards that write it say it.
const placed = (notation, p, places) => {
  const words = (lang) => (sideOf(notation.words?.[p], lang) ?? p).replace(/\{(\d)\}/g, (_, k) => places[Number(k)]).trim()
  return { zh: words('zh'), en: words('en') }
}

/**
 * What a world shows, for a vocabulary (WorldGraph.jsx draws it): a thing's marks, each property a chip on a thing,
 * each two-place relation the arrows between things, each sentence letter a chip of its own, each name a tag on a thing.
 */
export function worldParts(vocab, notation = {}) {
  const words = (c) => notation.words?.[c] ?? c
  return {
    marks: MARKS.slice(0, MAX_WORLD),
    props: vocab.preds.filter(([, n]) => n === 1).map(([p]) => ({ p, text: placed(notation, p, ['']) })),
    rels: vocab.preds.filter(([, n]) => n === 2).map(([p]) => ({ p, text: placed(notation, p, MARKS) })),
    facts: vocab.preds.filter(([, n]) => n === 0).map(([p]) => ({ p, text: say(atom(p), notation) })),
    consts: vocab.consts.map((c) => ({ c, text: words(c) })),
  }
}

/** A structure (models.js) as a world a player builds: { size, preds: { P: ['0', '0,1'] | true }, consts: { c: k } }. */
export const worldOf = (model, vocab) => ({
  size: model.domain.length,
  preds: Object.fromEntries(vocab.preds.map(([p, n]) => [p, n === 0 ? Boolean(model.preds[p]) : [...(model.preds[p] ?? [])]])),
  consts: Object.fromEntries(vocab.consts.filter((c) => model.fns[c]?.has('')).map((c) => [c, model.fns[c].get('')])),
})

/** The edits a player makes to a world: how many things, one fact on or off, where a name points. */
export const worldEdits = {
  resize: (world, size) => ({ ...world, size }),
  toggle: (world, p, key) => {
    const old = world.preds?.[p] ?? []
    return { ...world, preds: { ...world.preds, [p]: old.includes(key) ? old.filter((x) => x !== key) : [...old, key] } }
  },
  flip: (world, p) => ({ ...world, preds: { ...world.preds, [p]: !world.preds?.[p] } }),
  place: (world, c, k) => ({ ...world, consts: { ...world.consts, [c]: k } }),
}

const quantified = (f) => f.op === '∀' || f.op === '∃' || [f.a, f.b, f.body].some((sub) => sub && quantified(sub))

/**
 * A sentence evaluated in a structure the way a person reads it: each quantifier tries things in turn and stops as soon
 * as the answer is known; each quantifier-free part is one frame, with the things the variables stand for and the facts
 * it reads. Frames: [{ bind: { x: k }, atoms: [{ p, args: [k], on }], value }].
 */
export function traceOf(f, m) {
  const frames = []
  const term = (t, env) => (t.t === 'var' ? env[t.name] : m.fns[t.f].get(t.args.map((a) => term(a, env)).join(',')))
  const atoms = (f, env, out = []) => {
    if (f.op === 'atom' && f.pred !== '=') {
      const args = f.args.map((t) => term(t, env))
      out.push({ p: f.pred, args, on: args.length ? m.preds[f.pred].has(args.join(',')) : m.preds[f.pred] })
    }
    for (const sub of [f.a, f.b]) if (sub) atoms(sub, env, out)
    return out
  }
  const leaf = (f, env) => {
    const value = holds(f, m, env)
    frames.push({ bind: { ...env }, atoms: f.prop ? [] : atoms(f, env), value })
    return value
  }
  const go = (f, env) => {
    if (!quantified(f) || f.prop) return leaf(f, env)
    switch (f.op) {
      case '¬': return !go(f.a, env)
      case '∧': return go(f.a, env) && go(f.b, env)
      case '∨': return go(f.a, env) || go(f.b, env)
      case '→': return !go(f.a, env) || go(f.b, env)
      case '↔': return go(f.a, env) === go(f.b, env)
      case '∀': return m.domain.every((d) => go(f.body, { ...env, [f.v]: d }))
      case '∃': return m.domain.some((d) => go(f.body, { ...env, [f.v]: d }))
      default: return leaf(f, env)
    }
  }
  return { frames, value: go(f, {}) }
}

export function worldCheck(level) {
  const { vocab } = level
  const notation = { symbols: [], ...level.notation }
  const read = (value) => parse(value, { consts: vocab.names })
  const words = (value) => say(read(value), notation)
  // The sentences the world is checked against, as the board's rows: the meaning and the translation under test, or an
  // inference's conclusion and premises, the same rows the rule board writes it in. Each sentence is checked in turn
  // (`at`: its row and slot), the meaning first, the premises before the conclusion.
  const sentences = level.meant
    ? [{ f: level.meant, at: [0, 0] }, { f: level.wrong, at: [1, 0] }]
    : [...level.given.map((f, k) => ({ f, at: [1, k], premise: true })), { f: level.goal, at: [0, 0], premise: false }]
  const board = {
    className: 'lg-rule-table',
    rows: level.meant
      ? [
        { name: T('原意'), head: true, slots: [{ text: words(level.meant) }] },
        { name: T('待检验译文'), slots: [{ text: words(level.wrong) }] },
      ]
      : [
        { name: T('结论'), head: true, slots: [{ text: words(level.goal) }] },
        { name: T('前提'), slots: level.given.map((f) => ({ text: words(f) })), empty: T('无需前提') },
      ],
  }
  const reason = (row) => {
    if (level.meant) {
      const value = truth(row.value)
      return T("在这种情形下，两份译文都为{zh}。", {zh: { zh: String(value.zh), en: String(value.en) }})
    }
    const sentence = words(row.f)
    return row.premise
      ? T("前提「{zh}」在这种情形下不成立。", {zh: { zh: String(sentence.zh), en: String(sentence.en) }})
      : T("结论「{zh}」在这种情形下仍然成立，无法构成反例。", {zh: { zh: String(sentence.zh), en: String(sentence.en) }})
  }
  const judgeClaims = (world, { rows }) => cases(rows, (_, row) => row.right
    ? null
    : { want: !row.value, got: row.value, why: reason(row) })(world)
  const judge = inOrder(worldShape, (world) => judgeClaims(world, claimIn(level, world)))
  // A run plays each sentence's frames, then says its truth; it stops at the first sentence that is not as a
  // counterexample needs it (the meaning has no such need: only the translation is compared with it).
  const report = (world) => {
    const malformed = worldShape(world)
    if (malformed) return { fail: malformed, run: { steps: [{ failed: malformed.why }], results: [] } }
    const model = builtWorld(world, vocab)
    const fail = judgeClaims(world, claimIn(level, world))
    const traced = sentences.map((s) => ({ ...s, ...traceOf(read(s.f), model) }))
    const meant = level.meant ? traced[0].value : null
    const results = traced.map((s, k) => ({
      at: s.at,
      text: truth(s.value),
      right: level.meant ? (k ? s.value !== meant : undefined) : s.premise === s.value,
    }))
    // The failing check counts the sentences a counterexample needs (claimIn): the translation alone, or every one.
    const last = fail ? fail.check + (level.meant ? 1 : 0) : traced.length - 1
    const steps = traced.slice(0, last + 1).flatMap((s, k) => [
      ...s.frames.map((frame) => ({ sentence: k, frame })),
      k === last && fail ? { sentence: k, done: true, failed: fail.why } : { sentence: k, done: true },
    ])
    return { fail, run: { steps, results } }
  }
  return {
    judge,
    initial: { size: Math.min(2, MAX_WORLD), preds: {}, consts: {} },
    valid: (world) => !worldShape(world),
    parts: worldParts(vocab, notation),
    prompt: level.say, board,
    report,
    run: (world) => report(world).run,
    go: T('运行'), done: T('找到反例'),
    passed: level.meant ? T('在这种情形下，译文和原意真假不同。这种情形就是反例。') : T('前提都为真，结论为假。这种情形就是反例。'),
  }
}
