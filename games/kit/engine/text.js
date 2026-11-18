// References inside the text a player reads (../shell/refs.js). Work fields (solution, naive, alsoFails…) hold no text
// and are skipped.
import { referenceKinds } from './markup.js'
import { isText, textEntries } from './i18n.js'

const SKIP = new Set(['solution', 'naive', 'alsoFails'])

export const REF = /<([a-z][a-z0-9-]*)-ref to="([^"]+)"><\/\1-ref>/g
/** Every reference of `kind` in a text (both sides), in order, once each. */
export function refsIn(v, kind) {
  const out = []
  const walk = (x) => {
    if (typeof x === 'string') {
      for (const m of x.matchAll(REF)) if (m[1] === kind && !out.includes(m[2])) out.push(m[2])
    } else if (Array.isArray(x)) x.forEach(walk)
    else if (x && typeof x === 'object') Object.values(x).forEach(walk)
  }
  walk(v)
  return out
}

/** The references (as kind:id) `other` holds more often than `text`: what one side of a pair still lacks. */
export function lacking(other, text) {
  const count = new Map()
  for (const m of String(text).matchAll(REF)) count.set(`${m[1]}:${m[2]}`, (count.get(`${m[1]}:${m[2]}`) ?? 0) + 1)
  const out = []
  for (const m of String(other).matchAll(REF)) {
    const v = `${m[1]}:${m[2]}`
    if (count.get(v)) count.set(v, count.get(v) - 1)
    else if (!out.includes(v)) out.push(v)
  }
  return out
}
/** Validate explicit links in translatable text against the registered targets. */
export function refProblems(value, path, names) {
  const out = []
  const visited = new Set()
  const walk = (v, at) => {
    if (!v || typeof v !== 'object' || visited.has(v) || ArrayBuffer.isView(v)) return
    visited.add(v)
    if (isText(v)) {
      for (const [, text] of textEntries(v)) {
        for (const [, kind, id] of text.matchAll(REF)) {
          if (!names[kind]?.has?.(id)) out.push(`${at} refers to a missing ${referenceKinds.get(kind)?.label ?? kind}: ${id}`)
        }
      }
      return
    }
    for (const [key, inner] of Object.entries(v)) if (!SKIP.has(key)) walk(inner, `${at}.${key}`)
  }
  walk(value, path)
  return out
}
