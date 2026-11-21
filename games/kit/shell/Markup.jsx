import { Fragment, createElement, useContext } from 'react'
import { L } from './i18n.js'
import { markupOf } from '../engine/markup.js'

import { Typeset } from './Typeset.jsx'
import { FormulaText } from './FormulaText.jsx'
import { SettingsContext } from './useSetting.js'

// A game's text as the shell draws it: its markup (../engine/markup.js) as elements, references as their link chips
// (refs.js), anything else as the characters it is. Nothing is ever set as HTML.

// A sentence quoted in a text — 「A ∧ B」, 「∃y. P(y)」: letters and logic's signs, not words — is a formula, typeset as
// every formula is (FormulaText), in every text unless `sentences` is turned off; 「并且」 or 「若…则…」 stay text.
// The same in English, between “ and ”.
const QUOTED = /(「[^「」]+」|“[^“”]+”)/
const SENTENCE = /^[「“](?=[^」”]*(?:\b[A-Z]\b|[⊥⊤]))[A-Za-z0-9\s∀∃¬∧∨→↔⊥⊤().,·=≐+'?×]+[」”]$/
const prose = (text, Prose) => Prose ? <Prose text={text} /> : text
const quoted = (text, key, Prose) => text.split(QUOTED).map((part, k) => (SENTENCE.test(part)
  ? <Fragment key={`${key}.${k}`}>{part[0]}<FormulaText text={part.slice(1, -1)} className="markup-sentence" />{part.at(-1)}</Fragment>
  : <Fragment key={`${key}.${k}`}>{prose(part, Prose)}</Fragment>))

const draw = (nodes, sentences, Prose) => nodes.map((node, i) => {
  if (typeof node === 'string') return <Fragment key={i}>{sentences ? quoted(node, i, Prose) : prose(node, Prose)}</Fragment>
  if (node.math !== undefined) return <Typeset key={i} tex={node.math} display={node.display} plain={<code className="markup-tex">{node.math}</code>} />
  if (node.ref) return createElement(`${node.ref}-ref`, { key: i, to: node.to })
  return createElement(node.tag, { key: i }, draw(node.kids, sentences, node.tag === 'code' ? null : Prose))
})

/** Text (a string or a { zh, en } pair, in the reading language) with its markup drawn. */
export function Markup({ text, sentences = true }) {
  const { renderProse } = useContext(SettingsContext)
  if (text === null || text === undefined) return null
  return draw(markupOf(String(L(text))).nodes, sentences, renderProse)
}
