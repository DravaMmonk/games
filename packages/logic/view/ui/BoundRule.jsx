// The rule a rule-bound machine card carries (../../core/machine.js directCardsOf), as the card's lead line on every
// face and in the parts panel. A rule reads as it is stated, "⟦premises⟧ ⟹ conclusion", the part the card matches
// against the state standing out: used backwards (⟵) its conclusion, against a goal; used forwards (⟶) the premises
// it reads off the givens (a premise with premises of its own is left to prove, not read). A rewrite reads
// "left ≡ right" (what it needs after ⟸). A card with several rules shows the one picked; on a face that can set it
// the line opens in place to the others. Until one of several is picked the card has no rule: the face that can set
// it lists them all, and a face that only reads leaves the line out.
import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { FormulaText } from 'kernel/view'
import { tr } from 'kernel/words'
import { isFixed } from 'circuit'
import { directRuleStatements, ruleMark } from '../../core/machine.js'
import { machineTermOf, machineTextOf } from '../../core/circuit-readouts.js'
import { Piece } from './ProofState.jsx'

const needs = (line, conditions) => (conditions.length ? `${line} ⟸ ${conditions.join('; ')}` : line)
/** A rule's statements as lines of text. */
export const statementLines = (statements) => statements.map((statement) => 'left' in statement
  ? needs(`${statement.left} ≡ ${statement.right}`, statement.conditions)
  : statement.premises.length ? `⟦${statement.premises.join('; ')}⟧ ⟹ ${statement.conclusion}` : statement.conclusion)

/**
 * A statement cut into [text, matched] pieces: what a card used in `direction` matches against the state, and the
 * rest. The identity rule reads Γ, A ⊢ A, its A matched; a rewrite is matched whole.
 */
export function statementPieces(entry, statement, direction) {
  if ('left' in statement) return [[statementLines([statement])[0], true]]
  if (entry.rule?.fromHypothesis) return [['Γ, A ⊢ ', false], [statement.conclusion, true]]
  const read = (k) => { const premise = entry.rule?.premises?.[k]; return !premise?.hyps?.length && !premise?.fixes?.length }
  const forward = direction === 'forward'
  const pieces = statement.fixes?.length ? [[`⋀${statement.fixes.join(' ')}. `, false]] : []
  if (statement.premises.length) {
    pieces.push(['⟦', false])
    statement.premises.forEach((premise, k) => pieces.push(...(k ? [['; ', false]] : []), [premise, forward && read(k)]))
    pieces.push(['⟧ ⟹ ', false])
  }
  pieces.push([statement.conclusion, !forward])
  return pieces
}

/** One statement, typeset, with the part the card matches standing out and its reference mark (R₁) before it. */
export function RuleLine({ entry, statement, direction, mark }) {
  const pieces = statementPieces(entry, statement, direction)
  const all = pieces.every(([, matched]) => matched)
  return (
    <span className="formula-label lg-rule-line">
      {mark && <><FormulaText text={mark} className="formula-mark" />{' '}</>}
      {pieces.map(([text, matched], k) => <span key={k} className={all || matched ? 'lg-rule-match' : 'lg-rule-rest'}><Piece text={text} /></span>)}
    </span>
  )
}

function RuleLines({ entry, task, mark, direction }) {
  const statements = directRuleStatements(entry, machineTextOf(task), machineTermOf(task))
  return <span className="lg-rule-lines">{statements.map((statement, k) => <RuleLine key={k} entry={entry} statement={statement} direction={direction} mark={k === 0 ? mark : undefined} />)}</span>
}

/**
 * card   the bound card (directCardsOf(task).get(type))    node   the card on the board    run   numbers its rules (R₁ …)
 * set    new settings for the node, where this face may pick the rule    open   the other rules stay listed
 * unpicked   the rule the card runs with while none is picked on it (core defaultBoundRule), or null
 */
export default function BoundRule({ card, node, task, run, unpicked, set = null, open = false }) {
  const id = useId()
  const [expanded, setExpanded] = useState(false)
  const picked = card.entries.find((entry) => entry.key === (node.params?.use?.[0] ?? unpicked))
  const markOf = (entry) => (run?.ruleSlots ? ruleMark(entry.key, run.ruleSlots, entry) : undefined)
  const line = (entry) => <RuleLines entry={entry} task={task} mark={markOf(entry)} direction={card.direction} />
  if (!set || card.entries.length < 2 || isFixed(node, 'use')) return picked ? <div className="lg-rule formula-row">{line(picked)}</div> : null
  const listed = open || expanded || !picked
  const pick = (entry) => {
    if (entry !== picked) set({ use: [entry.key] }, 'use')
    setExpanded(false)
  }
  const stop = (event) => event.stopPropagation()
  return (
    <div className={`lg-rule is-choice ${listed ? 'is-open' : ''}`} role="radiogroup" aria-label={tr('选择规则')} onPointerDown={stop}>
      {!open && picked && (
        <button type="button" className="lg-rule-pick formula-row" aria-expanded={expanded} aria-controls={expanded ? id : undefined} onClick={() => setExpanded(!expanded)}>
          {line(picked)}<ChevronDown size={12} aria-hidden="true" />
        </button>
      )}
      {listed && (
        <div id={id} className="lg-rule-options">
          {card.entries.filter((entry) => open || entry !== picked).map((entry) => (
            <button key={entry.key} type="button" role="radio" aria-checked={entry === picked} className="lg-rule-option formula-row" onClick={() => pick(entry)}>{line(entry)}</button>
          ))}
        </div>
      )}
    </div>
  )
}
