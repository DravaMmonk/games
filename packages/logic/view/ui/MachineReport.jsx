// The prover's run report (a machine level's `report`, ../../../circuit/view/CircuitScreen.jsx): the rules on the
// board first, numbered once for the whole run (R₁ R₂ …, a lone rule plain R); then the goals the test starts from in a
// box, and for each step a link down to the next box: the step's number, the card's name and, apart from it, what the
// card did in marks (⊢ ⟵ R₁, ⊢ ✓ …, ../../core/circuit-readouts.js didText). A box holds only goals (⊢₁ ⊢₂ …). A step
// that fails says why, and no box follows it. The current step is marked and kept in view, inside the report only.
import { useEffect, useRef } from 'react'
import { L } from 'kernel/view'
import { T, tr } from 'kernel/words'
import { inputsOf, inputsOfLevel } from '../../core/machine.js'
import { goalLines, ruleLines } from '../../core/circuit-readouts.js'
import { Formula } from './Formula.jsx'

const PROVED = T('证明完毕')

/** What a box holds of a value: a state's goals (or that it is proved), else the value in words. */
function Box({ value, task, show, on = false }) {
  const state = value?.kind === 'state'
  const more = state ? value.more?.length ?? 0 : 0
  const lines = state && value.goals.length
    ? goalLines(value, task).map((line, k) => <Formula key={k} text={line} className="mr-line" />)
    : [<span key="0" className="mr-line">{state ? L(PROVED) : L(show(value))}</span>]
  return (
    <li className={`mr-box ${on ? 'is-on' : ''} ${state && !value.goals.length ? 'is-done' : ''}`}>
      {lines}
      {more > 0 && <span className="mr-more">{tr('另有 {n} 种结果', { n: more })}</span>}
    </li>
  )
}

export default function MachineReport({ steps, at, run, task, test, show }) {
  const box = useRef(null)
  const inputs = new Set(inputsOfLevel(task).map((i) => i.name))
  // The test's inputs are the first box; the result card adds nothing to the last.
  const shown = steps.map((s, k) => ({ s, k })).filter(({ s }) => !s.entry.path?.length ? !inputs.has(s.entry.id) && s.entry.id !== 'out' : true)
  const start = test ? Object.values(inputsOf(test, task)).find((v) => v?.kind === 'state') ?? Object.values(inputsOf(test, task))[0] : null
  const rules = run ? ruleLines(run, task) : []
  useEffect(() => {
    const el = box.current
    const on = el?.querySelector('.mr-step.is-on') ?? el?.querySelector('.mr-flow')?.lastElementChild
    if (!el || !on) return
    const top = on.offsetTop
    const bottom = (on.nextElementSibling?.classList.contains('mr-box') ? on.nextElementSibling : on)
    const end = bottom.offsetTop + bottom.offsetHeight
    if (top < el.scrollTop) el.scrollTop = top
    else if (end > el.scrollTop + el.clientHeight) el.scrollTop = Math.max(top, end - el.clientHeight)
  }, [steps.length, at])
  return (
    <div className="mr" ref={box}>
      {rules.length > 0 && (
        <ul className="mr-rules" aria-label={tr('规则')}>
          {rules.map((r) => <li key={r.mark}><Formula text={r.mark} className="mr-rule-mark" /><Formula text={r.text} /></li>)}
        </ul>
      )}
      <ol className="mr-flow" aria-label={tr('运行步骤')}>
        {start && <Box value={start} task={task} show={show} />}
        {shown.flatMap(({ s, k }, n) => {
          // A card that cannot do its step says ✗ (why, on a long press or hover) and gives back the state it was handed:
          // the next box. A card that cannot run at all (an input missing) says why, and nothing follows.
          const broken = s.failed
          const refused = !broken && s.value?.kind === 'state' && s.value.error ? s.value.error : null
          return [
            <li key={`s${k}`} className={`mr-step ${k === at ? 'is-on' : ''} ${broken || refused ? 'is-fail' : ''} ${refused ? 'is-refused' : ''}`}>
              <span className="mr-num">{n + 1}</span>
              <span className="mr-name">{s.mark}{L(s.label)}</span>
              {refused ? <span className="mr-wrong" title={L(refused)} aria-label={L(refused)}>✗</span> : s.detail && <Formula text={s.detail} className="mr-note" />}
              {broken && <span className="mr-why">{L(broken)}</span>}
            </li>,
            !broken && s.value !== undefined && <Box key={`b${k}`} value={refused ? { ...s.value, error: undefined } : s.value} task={task} show={show} on={k === at} />,
          ]
        })}
      </ol>
    </div>
  )
}
