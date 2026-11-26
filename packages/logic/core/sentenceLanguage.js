import { L } from "kernel"
import { T } from 'kernel/words'
import { treeKey as keyOf } from 'sentence'
import { BIN, show } from './formula.js'
import { say } from './notation.js'
import { acceptsKind, bindsAt, chipsFrom, complete, editingTree, kindAt, kidsOf, nodeAt, setAt, straysOf } from './formulaTree.js'

export const OUTSIDE = T("这个名字只在它绑定的区域里可用。")

const PLACES = ['①', '②', '③']
export const STRAY = T('还不是完整的句子')
const GROUPS = [['pred', T('谓词')], ['name', T("名字")], ['var', T('变量')], ['quant', T('量词')], ['conn', T('连接词')]]

function wordsOf(notation, word, places) {
  const text = L(notation.words?.[word] ?? '')
  if (!places) return text || word
  const args = Array.from({ length: places }, (_, k) => `{${k}}`)
  const slots = [...text.matchAll(/\{\d\}/g)].map(([slot]) => slot)
  if (args.every((arg) => slots.includes(arg)) && slots.every((slot) => args.includes(slot))) return text
  if (word === '=') return '{0} = {1}'
  // A proof case can give a predicate a name without supplying a template.
  const name = slots.length ? word : text || word
  return `${name}(${args.join(', ')})`
}

/** A predicate's words with its places numbered: ①是②的父母 (on its chip). */
const placesOf = (notation, word, places) => wordsOf(notation, word, places).replace(/\{(\d)\}/g, (_, k) => PLACES[Number(k)])

// Words with numbered places ({0}), each place the segment `at(k)`.
const template = (words, at) => words.split(/(\{\d\})/).filter(Boolean).map((w) => (/^\{\d\}$/.test(w) ? at(Number(w[1])) : w))

/**
 * The formula as it reads, for the strip: each part its own words, with a box for every empty place, so the line
 * reads as the formula does (∀x. x是人 → x会死). A whole ∀, ∃ or connective inside a connective keeps its brackets.
 */
function segmentOf(node, path, kind, notation, bracket = false) {
  const key = keyOf(path)
  if (!node) return { hole: key, label: kind === 'term' ? T('东西') : T("句子") }
  const part = (family, parts) => ({ part: key, family, parts: bracket ? ['(', ...parts, ')'] : parts })
  const kid = (k, inner) => {
    const { value, kind: takes } = kidsOf(node)[k]
    return segmentOf(value, [...path, k], takes, notation, inner && Boolean(value) && !value.t && value.op !== 'atom' && value.op !== '¬')
  }
  // A thing where a sentence goes is marked: it is not a sentence yet. A function (s, plus) has a box for each thing.
  if (node.t === 'fn' && node.args.length) return { ...part('name', template(wordsOf(notation, node.f, node.args.length), kid)), bad: kind === 'formula' }
  if (node.t) return { ...part(node.t === 'var' ? 'var' : 'name', [node.t === 'var' ? node.name : L(notation.words?.[node.f] ?? node.f)]), bad: kind === 'formula' }
  switch (node.op) {
    case 'atom': return part('pred', template(wordsOf(notation, node.pred, node.args.length), kid))
    case '⟹': return part('conn', ['⟦', kid(0), '⟧ ⟹ ', kid(1)])
    case '⊥': return part('conn', ['⊥'])
    case '¬': return part('conn', ['¬', kid(0, true)])
    case '∀': case '∃': return part('quant', [`${node.op}${node.v}. `, { region: [kid(0)] }])
    default: return part('conn', [kid(0, true), ` ${node.op} `, kid(1, true)])
  }
}

export function sentenceLanguage(notation, root = 'formula', free) {
  const argumentWords = (node) => node.args?.length ? wordsOf(notation, node.pred ?? node.f, node.args.length) : ''
  const orderOf = (node, kids) => {
    const words = argumentWords(node)
    if (!words) return [...kids.keys()]
    const shown = [...words.matchAll(/\{(\d)\}/g)].map(([, k]) => Number(k))
    return [...new Set([...shown, ...kids.keys()])].filter(k => k < kids.length)
  }
  const leadingSlot = (node) => {
    if (BIN[node.op] !== undefined) return 0
    const first = /^\s*\{(\d)\}/.exec(argumentWords(node))
    return first ? Number(first[1]) : null
  }
  const { holesOf, joinsOnto } = editingTree(root, orderOf, leadingSlot)
  return {
    nodeAt, setAt, holesOf, complete, joinsOnto,
    label: root === 'term' ? T("式子") : T('公式'),
    line: (tree) => [segmentOf(tree, [], root, notation)],
    refuse: (tree, path, chip) => {
      if (chip.key === '⟹' && path.length) return T('假设卡须放在前提的起点。')
      if (chip.kind === 'formula' && kindAt(tree, path) === 'term') return T('这里须填入一样东西：名字或变量。')
      if (root === 'formula' && chip.group === 'var' && !(free?.includes(chip.text) ?? chip.free) && !bindsAt(tree, path, chip.text)) return OUTSIDE
      return null
    },
    accepts: (hole, chip) => acceptsKind(chip, hole.kind),
    problem: (tree) => root === 'term' || !straysOf(tree).length ? null : STRAY,
    groups: GROUPS,
    chipText: (chip) => chip.group === 'pred' ? placesOf(notation, chip.pred, chip.places)
      : chip.places ? placesOf(notation, chip.name, chip.places)
        : chip.group === 'name' ? L(notation.words?.[chip.name] ?? chip.name) : chip.text,
  }
}


/** Read and write sentence values on a strip, with the display used when the editor is closed. */
export function sentencePicker(formulas, { read, consts = [], notation, text = (value) => say(read(value), notation) }) {
  return {
    read, text, write: show,
    ready: (tree) => Boolean(tree) && complete(tree) && !straysOf(tree).length,
    chips: chipsFrom(formulas, { consts, notation }),
    language: sentenceLanguage(notation),
  }
}
