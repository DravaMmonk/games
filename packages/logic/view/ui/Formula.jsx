// Logic's formulas as every play shows them: typeset in TeX (../../core/tex.js), one face for all of logic's signs.
// The line between what is typeset and what is not: a formal object (a sentence, a sequent ⊢, a rule ⟹, a proof term,
// an equation, a clause, a ?-letter) and a mark that stands for one (R₁, ⊢₁, ⊢ ⟵ R₁, ⊢ ✓) are typeset wherever they
// stand; prose (an explanation, a name, a verdict, 证明完毕, a sentence in plain words still to be translated) is not.
// Inside a formula, a sentence's own words (下雨) are upright text in it. What the player is editing (a picker, a block
// in a strip) is a native control and keeps the page's face.
import { Typeset } from 'kernel/view'
import { L } from 'kernel/view'
import { Fragment } from 'react'
import { texOf } from '../../core/tex.js'
import { machineLines } from '../../core/circuit-readouts.js'

/** One formula (its text as logic writes it, or a { zh, en } pair), typeset; its plain text while that loads. */
export function Formula({ text, className = '' }) {
  const line = String(L(text))
  return <span className={`tx-line ${className}`.trim()}><Typeset tex={texOf(line)} plain={<span className="tx-plain">{line}</span>} /></span>
}

/** A rule or goal with its reference mark distinct from the formula it labels. */
export function MarkedFormula({ line: { before, mark, text }, className = '' }) {
  return (
    <span className={`tx-marked ${className}`.trim()}>
      {before && <><Formula text={before} />{' '}</>}
      <Formula text={mark} className="tx-mark" />{' '}
      <Formula text={text} />
    </span>
  )
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
  return line.mark ? <MarkedFormula line={line} /> : <Formula text={line.s} />
}

/** A machine value as a card shows it: only what it is (its formulas, typeset, or 证明完毕), never a note on it (why a
 *  step failed, how many results: the run report says those). */
export const typesetMachine = (v, ctx) => {
  const lines = machineLines(v, ctx).filter((l) => l.formula || l.result)
  return (
    <span className="tx-lines">
      {lines.length ? lines.map((line, k) => line.formula
        ? <MachineFormula key={k} line={line} />
        : <span key={k} className="tx-prose">{line.s}</span>) : '—'}
    </span>
  )
}

/** A value that is one formula (a proof board's sentence, with its proof term), as a card shows it. */
export const typesetOne = (show) => (v, ctx) => <span className="tx-lines"><Formula text={show(v, ctx)} /></span>
