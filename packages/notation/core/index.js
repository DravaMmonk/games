// Mark names are authoring identifiers. Text equivalents serve native tooltips and assistive technology.
const marks = new Map([
  ['not', ['¬', '非', 'not']],
  ['and', ['∧', '且', 'and']],
  ['or', ['∨', '或', 'or']],
  ['implies', ['→', '蕴涵', 'implies']],
  ['left', ['←', '左箭头', 'left arrow']],
  ['backward', ['⟵', '逆用', 'backward']],
  ['iff', ['↔', '等价', 'if and only if']],
  ['entails', ['⟹', '推出', 'entails']],
  ['maps-to', ['⟼', '映到', 'maps to']],
  ['rewrite', ['≡', '改写', 'rewrite']],
  ['equals', ['＝', '等号', 'equals']],
  ['bottom', ['⊥', '矛盾', 'false']],
  ['top', ['⊤', '永真', 'true']],
  ['forall', ['∀', '对所有', 'for all']],
  ['exists', ['∃', '存在', 'exists']],
  ['proves', ['⊢', '可证', 'proves']],
  ['turn', ['↷', '转向', 'turn']],
  ['repeat', ['↻', '重复', 'repeat']],
  ['exit', ['↪', '跳出', 'exit']],
  ['dot-equals', ['≐', '带点等号', 'dotted equals']],
  ['not-equal', ['≠', '不等于', 'not equal']],
  ['at-most', ['≤', '小于等于', 'at most']],
  ['at-least', ['≥', '大于等于', 'at least']],
  ['in', ['∈', '属于', 'belongs to']],
  ['times', ['×', '乘', 'times']],
  ['divide', ['÷', '除以', 'divided by']],
  ['dot', ['·', '中点', 'dot']],
  ['check', ['✓', '通过', 'passed']],
  ['cross', ['✗', '失败', 'failed']],
  ['meta-all', ['⋀', '任取', 'for arbitrary']],
  ['open-bracket', ['⟦', '左双括号', 'left double bracket']],
  ['close-bracket', ['⟧', '右双括号', 'right double bracket']],
  ['xor', ['⊕', '异或', 'exclusive or']],
])
const circles = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
const command = /\\mark\{([a-z][a-z0-9-]*)\}/g

export function register() {}

export const mark = id => `\\mark{${id}}`

function read(id) {
  const words = marks.get(id)
  if (words) {
    const [glyph, zh, en] = words
    return { id, glyph, zh, en }
  }
  const circle = /^circle-([1-9]|1[0-9]|20)$/.exec(id)
  if (circle) {
    const number = Number(circle[1])
    return { id, number, glyph: circles[number - 1], zh: String(number), en: String(number) }
  }
  return null
}

/** Read text and known commands; leave unknown commands visible for the author. */
export function notationRuns(text) {
  const runs = []
  let at = 0
  for (const match of text.matchAll(command)) {
    const token = read(match[1])
    if (!token) continue
    if (match.index > at) runs.push(text.slice(at, match.index))
    runs.push(token)
    at = match.index + match[0].length
  }
  if (at < text.length || !runs.length) runs.push(text.slice(at))
  return runs
}

export const notationPlain = (text, lang = 'glyph') => typeof text === 'string'
  ? notationRuns(text).map(run => typeof run === 'string' ? run : run[lang]).join('')
  : text

export const notationNumber = index => index < circles.length && index >= 0 ? mark(`circle-${index + 1}`) : `#${index + 1}`
