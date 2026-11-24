// Logic's formulas as every play shows them: typeset in TeX (../../core/tex.js), one face for all of logic's signs.
// The line between what is typeset and what is not: a formal object (a sentence, a sequent ⊢, a rule ⟹, a proof term,
// an equation, a clause, a ?-letter) and a mark that stands for one (R₁, ⊢₁, ⊢ ⟵ R₁, ⊢ ✓) are typeset wherever they
// stand. A closed proof state is typeset as well. Explanations, names, verdicts and untranslated sentences are prose.
// Inside a formula, a sentence's own words (下雨) are upright text in it. A complete choice in a picker is also typeset.
import { FormulaLabel, FormulaText, L } from 'kernel/view'
import { Fragment } from 'react'
import { texOf, texText } from '../../core/tex.js'
import { machineLines } from '../../core/circuit-readouts.js'

/** One formula (its text as logic writes it, or a { zh, en } pair), typeset; its plain text while that loads. */
export function Formula({ text, className = '', upright = false }) {
  const line = String(L(text))
  return <FormulaText text={line} className={`tx-line ${className}`} tex={upright ? texText(line) : texOf(line)} />
}

/** A rule or goal with its reference mark distinct from the formula it labels. */
export function MarkedFormula({ line: { before, mark, text }, className = '' }) {
  return <FormulaLabel before={before} mark={mark} text={text} className={className} />
}

function MachineFormula({ line }) {
  if (line.goals) return (
    <span className="tx-marked">
      {line.goals.map((goal, k) => (
        <Fragment key={k}>
          {k > 0 && <> <Formula text="|" /> </>}
          <MachineFormula line={goal} />
        </Fragment>
      ))}
    </span>
  )
  return line.mark ? <MarkedFormula line={line} /> : <Formula text={line.s} upright={line.upright} />
}

/** A machine value as a card shows it: only what it is (its formulas, typeset, or 证明完毕), never a note on it (why a
 *  step failed, how many results: the run report says those). */
export const typesetMachine = (v, ctx) => {
  const lines = machineLines(v, ctx).filter((l) => l.formula || l.result)
  return (
    <span className="tx-lines formula-row">
      {lines.length ? lines.map((line, k) => line.formula
        ? <MachineFormula key={k} line={line} />
        : <span key={k} className="tx-prose">{line.s}</span>) : '—'}
    </span>
  )
}

/** A value that is one formula (a proof board's sentence, with its proof term), as a card shows it. */
export const typesetOne = (show) => (v, ctx) => <span className="tx-lines tx-proof-result formula-row"><Formula text={show(v, ctx)} /></span>
