// Logic's formulas as every play shows them: typeset in TeX (../../core/tex.js), one face for all of logic's signs.
// The line between what is typeset and what is not: a formal object (a sentence, a sequent ⊢, a rule ⟹, a proof term,
// an equation, a clause, a ?-letter) and a mark that stands for one (R₁, ⊢₁, ⊢ ⟵ R₁, ⊢ ✓) are typeset wherever they
// stand. A closed proof state is typeset as well. Explanations, names, verdicts and untranslated sentences are prose.
// Inside a formula, a sentence's own words (下雨) are upright text in it. A complete choice in a picker is also typeset.
import { FormulaLabel, FormulaText, L } from 'kernel/view'
import { texOf, texText } from '../../core/tex.js'

/** One formula (its text as logic writes it, or a { zh, en } pair), typeset; its plain text while that loads. */
export function Formula({ text, className = '', upright = false }) {
  const line = String(L(text))
  return <FormulaText text={line} className={`tx-line ${className}`} tex={upright ? texText(line) : texOf(line)} />
}

/** A rule or goal with its reference mark distinct from the formula it labels. */
export function MarkedFormula({ line: { before, mark, text }, className = '' }) {
  return <FormulaLabel before={before} mark={mark} text={text} className={className} />
}

/** A value that is one formula (a proof board's sentence, with its proof term), as a card shows it. */
export const typesetOne = (show) => (v, ctx) => <span className="tx-lines formula-row"><Formula text={show(v, ctx)} /></span>
