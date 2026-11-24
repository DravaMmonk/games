// The prover's run report (a machine level's `report`, ../../../circuit/view/CircuitScreen.jsx): the rules on the
// board are numbered once (R₁ R₂ …). The initial goal starts the report.
// Each step links down to its result box: the step's number, the card's name and what the
// card did in marks (⊢ ⟵ R₁, ⊢ ✓ …, ../../core/circuit-readouts.js didText). A box holds only goals (⊢₁ ⊢₂ …). A step
// that fails says why, and no box follows it. The current step is marked and kept in view, inside the report only.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Info, ListOrdered, Network } from 'lucide-react'
import { L, Popover, ViewPicker } from 'kernel/view'
import { T, tr } from 'kernel/words'
import { NotationLabel } from 'notation/view'
import { mark } from 'notation'
import { inputsOf } from '../../core/machine.js'
import { goalLines, ruleLines, stepExplained } from '../../core/circuit-readouts.js'
import { Formula, MarkedFormula } from './Formula.jsx'
import { ProofTree } from './ProofTree.jsx'

const PROVED = T('证明完毕')
const REPORT_VIEWS = [
  { view: 'steps', label: T('运行步骤'), icon: ListOrdered },
  { view: 'tree', label: T('分支树'), icon: Network },
]

function startOf(test, task) {
  const inputs = test ? Object.values(inputsOf(test, task)) : []
  return inputs.find((value) => value?.kind === 'state') ?? inputs[0]
}

/** What a box holds of a value: a state's goals (or that it is proved), else the value in words. */
function Box({ value, task, show, on = false }) {
  const state = value?.kind === 'state'
  const more = state ? value.more?.length ?? 0 : 0
  const lines = state && (value.goals.length
    ? goalLines(value, task).map((line, k) => <MarkedFormula key={k} line={line} className="mr-line" />)
    : <Formula text={PROVED} className="mr-line" upright />)
  return (
    <li className={`mr-box formula-row ${on ? 'is-on' : ''} ${state && !value.goals.length ? 'is-done' : ''}`}>
      {state ? lines : <span className="mr-line">{L(show(value))}</span>}
      {more > 0 && <span className="mr-more">{tr('另有 {n} 种结果', { n: more })}</span>}
    </li>
  )
}

export function machineRuleList({ run, task }) {
  const rules = run ? ruleLines(run, task) : []
  return rules.length > 0 ? (
    <ul className="mr-rules" aria-label={tr('规则')}>
      {rules.map((rule) => <li key={rule.mark} className="formula-row"><MarkedFormula line={rule} /></li>)}
    </ul>
  ) : null
}

export default function MachineReport({ steps, at, ended, run, task, test, show, phone }) {
  const box = useRef(null)
  const flow = useRef(null)
  const [told, setTold] = useState(null) // { k, anchor }: the step whose ⓘ is open
  const [mode, setMode] = useState(REPORT_VIEWS[0].view)
  const canShowTree = Boolean(run?.proofRoot)
  const tree = canShowTree && mode === 'tree'
  const shown = steps.map((s, k) => ({ s, k, number: k + 1, current: k === at }))
  const start = startOf(test, task)
  const rules = phone && machineRuleList({ run, task })
  useLayoutEffect(() => {
    if (phone) return
    const list = flow.current
    if (!list) return
    const resizeBoxes = () => {
      const available = list.getBoundingClientRect().width
      const boxes = [...list.children].filter(child => child.classList.contains('mr-box'))
      // Measure every box at its unwrapped width before choosing which ones need to wrap.
      list.classList.add('is-measuring')
      const wraps = boxes.map(goal => goal.getBoundingClientRect().width > available)
      list.classList.remove('is-measuring')
      boxes.forEach((goal, i) => goal.toggleAttribute('data-wrap', wraps[i]))
    }
    let width
    const resize = new ResizeObserver(([entry]) => {
      if (width === entry.contentRect.width) return
      width = entry.contentRect.width
      resizeBoxes()
    })
    const content = new MutationObserver(resizeBoxes)
    resize.observe(list)
    content.observe(list, { childList: true, characterData: true, subtree: true })
    document.fonts.addEventListener('loadingdone', resizeBoxes)
    resizeBoxes()
    return () => {
      resize.disconnect()
      content.disconnect()
      document.fonts.removeEventListener('loadingdone', resizeBoxes)
    }
  }, [phone, tree])
  useEffect(() => {
    const el = tree ? box.current?.querySelector('.mr-tree-scroll') : box.current
    if (!el) return
    const on = el.querySelector(tree ? '.mr-branch-node.is-on' : '.mr-step.is-on') ?? (!tree && el.querySelector('.mr-flow')?.lastElementChild)
    if (!on) { if (tree) el.scrollTop = 0; return }
    const top = on.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop
    const bottom = (on.nextElementSibling?.classList.contains('mr-box') ? on.nextElementSibling : on)
    const end = bottom.getBoundingClientRect().bottom - el.getBoundingClientRect().top + el.scrollTop
    if (top < el.scrollTop) el.scrollTop = top
    else if (end > el.scrollTop + el.clientHeight) el.scrollTop = Math.max(top, end - el.clientHeight)
  }, [steps.length, at, tree])
  return (
    <div className={`mr ${phone ? 'is-phone' : 'is-desktop'}`}>
      {(rules || canShowTree) && (
        <div className="mr-head">
          {rules}
          {canShowTree && <ViewPicker options={REPORT_VIEWS.map(option => ({ ...option, label: L(option.label) }))}
            value={mode} onChange={next => { setTold(null); setMode(next) }} compact />}
        </div>
      )}
      <div className={`mr-body${tree ? ' is-tree' : ''}`} ref={box}>
        {tree ? <ProofTree key={JSON.stringify(test)} root={run.proofRoot} steps={shown} ended={ended} run={run} task={task} /> : <ol className="mr-flow" ref={flow} aria-label={tr('运行步骤')}>
          {start !== undefined && <Box value={start} task={task} show={show} />}
          {shown.flatMap(({ s, k, number, current }) => {
            // A card that cannot do its step says ✗ (why, on a long press or hover) and gives back the state it was handed:
            // the next box. A card that cannot run at all (an input missing) says why, and nothing follows.
            const broken = s.failed
            const refused = !broken && s.value?.kind === 'state' && s.value.error ? s.value.error : null
            const explained = stepExplained(s.entry, run)
            return [
              <li key={`s${k}`} className={`mr-step ${current ? 'is-on' : ''} ${broken || refused ? 'is-fail' : ''} ${refused ? 'is-refused' : ''}`}>
                <span className="mr-num">{number}</span>
                <span className="mr-name">{s.mark}<NotationLabel label={L(s.label)} /></span>
                {refused ? <span className="mr-wrong" aria-label={L(refused)}><NotationLabel label={mark('cross')} /></span> : s.detail && <Formula text={s.detail} className="mr-note" />}
                {explained && (
                  <button type="button" className="mr-info" aria-label={tr('这一步做了什么')} aria-expanded={told?.k === k} onClick={(event) => setTold(told?.k === k ? null : { k, anchor: event.currentTarget })}>
                    <Info size={13} />
                  </button>
                )}
                {broken && <span className="mr-why">{L(broken)}</span>}
              </li>,
              !broken && s.value !== undefined && <Box key={`b${k}`} value={refused ? { ...s.value, error: undefined } : s.value} task={task} show={show} on={current} />,
            ]
          })}
        </ol>}
        {!tree && told && steps[told.k] && (
          <Popover anchor={told.anchor} title={tr('这一步做了什么')} placement="above" onClose={() => setTold(null)}>
            <p className="mr-told">{L(stepExplained(steps[told.k].entry, run))}</p>
          </Popover>
        )}
      </div>
    </div>
  )
}
