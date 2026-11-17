import { Fragment, Suspense, createElement, lazy } from 'react'
import { L } from './i18n.js'
import { markupOf } from '../engine/markup.js'

const TypesetMath = lazy(() => import('./TypesetMath.jsx'))

// A game's text as the shell draws it: its markup (../engine/markup.js) as elements, references as their link chips
// (refs.js), anything else as the characters it is. Nothing is ever set as HTML.

// A sentence quoted in a text — 「A ∧ B」, 「∃y. P(y)」: letters and logic's signs, not words — is set in the serif the
// sentence boxes use (`sentences`, the brief); 「并且」 or 「若…则…」 stay text.
const QUOTED = /(「[^「」]+」)/
const SENTENCE = /^「(?=[^」]*(?:\b[A-Z]\b|[⊥⊤]))[A-Za-z0-9\s∀∃¬∧∨→↔⊥⊤().,·=≐+'?×]+」$/
const quoted = (text, key) => text.split(QUOTED).map((part, k) => (SENTENCE.test(part)
  ? <Fragment key={`${key}.${k}`}>「<span className="markup-sentence">{part.slice(1, -1)}</span>」</Fragment>
  : <Fragment key={`${key}.${k}`}>{part}</Fragment>))

const draw = (nodes, sentences = false) => nodes.map((node, i) => {
  if (typeof node === 'string') return sentences ? <Fragment key={i}>{quoted(node, i)}</Fragment> : <Fragment key={i}>{node}</Fragment>
  if (node.math !== undefined) return <Suspense key={i} fallback={null}><TypesetMath tex={node.math} display={node.display} /></Suspense>
  if (node.ref) return createElement(`${node.ref}-ref`, { key: i, to: node.to })
  return createElement(node.tag, { key: i }, draw(node.kids, sentences))
})

/** Text (a string or a { zh, en } pair, in the reading language) with its markup drawn. */
export function Markup({ text, sentences = false }) {
  if (text === null || text === undefined) return null
  return draw(markupOf(String(L(text))).nodes, sentences)
}
