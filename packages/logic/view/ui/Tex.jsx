// Logic on the machine board set in TeX (../../core/tex.js, typeset by the kernel's Markup): every formula in one face,
// LaTeX's; prose (a step that failed, 证明完毕) stays the page's text.
import { Markup } from 'kernel/view'
import { texOf } from '../../core/tex.js'
import { machineLines } from '../../core/circuit-readouts.js'

/** One line of logic, typeset. */
export const TexLine = ({ line, className = '' }) => <span className={`tx-line ${className}`.trim()}><Markup text={`\\(${texOf(line)}\\)`} /></span>

/** A machine value as a card shows it: its lines, the formulas typeset. */
export const typesetMachine = (v, ctx) => (
  <span className="tx-lines">
    {machineLines(v, ctx).map((l, k) => (l.formula ? <TexLine key={k} line={l.s} /> : <span key={k} className="tx-prose">{l.s}</span>))}
  </span>
)
