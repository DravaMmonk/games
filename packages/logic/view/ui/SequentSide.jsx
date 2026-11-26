import { L } from 'kernel/view'
import { Formula } from './Formula.jsx'

/** Whether a setting picks a side of the first goal's sequent: its hypotheses or its goal (simp, cnf: `at`). */
export const isSequentSide = (setting) => setting?.key === 'at' && setting.options?.length === 2
  && setting.options.every(({ value }) => value === 'goal' || value === 'hyps')

/**
 * The side of ⊢ a part works on, drawn as the sequent's two sides with the one picked framed, as a place picked on a
 * card is: the givens before ⊢, the goal after it. Read only on a phone tile.
 */
export default function SequentSide({ setting, value, onChange, readOnly = false, id }) {
  const at = value || setting.default || 'goal'
  const side = (option) => (
    <button type="button" role="radio" className="lg-side-pick" aria-checked={at === option.value} disabled={readOnly}
      onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); if (at !== option.value) onChange?.(option.value) }}>
      {L(option.label ?? option.value)}
    </button>
  )
  const byValue = Object.fromEntries(setting.options.map((option) => [option.value, option]))
  return (
    <span id={id} className="lg-side" role="radiogroup" aria-label={L(setting.label ?? setting.key)}>
      {side(byValue.hyps)}<Formula text="⊢" />{side(byValue.goal)}
    </span>
  )
}
