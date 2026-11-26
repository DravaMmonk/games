import { lastIndexMatching } from 'kernel'
// The prover's run report (a machine level's `report`, ../../../circuit/view/CircuitScreen.jsx): the rules on the
// board are numbered once (R₁ R₂ …). The initial goal starts the report.
// Each step links down to its result box: the step's number, the card's name and what the
// card did in marks (⊢ ⟵ R₁, ⊢ ✓ …, ../../core/circuit-readouts.js didText). A box holds only goals (⊢₁ ⊢₂ …). A step
// that fails says why, and no box follows it. A rule that did not apply hands its state on unchanged: its step is a
// hollow number with no box of its own, on the line of the step that gave the state it left alone. The current step is
// marked and kept in view, inside the report only; a run that ends with goals open rests on the last skipped step.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CopyCheck, Ellipsis, Info, ListOrdered, LocateOff, Network } from 'lucide-react'
import { L, Popover, ViewPicker } from 'kernel/view'
import { T, tr } from 'kernel/words'
import { NotationLabel } from 'notation/view'
import { mark } from 'notation'
import { inputsOf } from '../../core/machine.js'
import { ruleLines, stepExplained } from '../../core/circuit-readouts.js'
import { Formula, MarkedFormula } from './Formula.jsx'
import { ProofTree, Unsettled, unsettled } from './ProofTree.jsx'
import { ProofState, markedTextOf } from './ProofState.jsx'

const PROVED = T('证明完毕')
// A long run's report: the lines kept from its start and from where it has got to, and the least worth folding between.
const HEAD_LINES = 24
const TAIL_LINES = 48
const GAP_LINES = 8
// The work a card does on one goal of the state it is handed (../../core/machine.js `did`).
const ACTS = ['rule', 'assumption', 'rw', 'rwHyps']
const REPORT_VIEWS = [
  { view: 'steps', label: T('运行步骤'), icon: ListOrdered },
  { view: 'tree', label: T('分支树'), icon: Network },
]

function startOf(test, task) {
  const inputs = test ? Object.values(inputsOf(test, task)) : []
  return inputs.find((value) => value?.kind === 'state') ?? inputs[0]
}

/** What a box holds of a value: a state's goals (or that it is proved), else the value in words; `diff` what its step
 *  changed, `next` the goal the step after it acted on, `cut` a candidate the search goes no further with. */
function Box({ value, task, show, diff, next, on = false, cut = false }) {
  const state = value?.kind === 'state'
  const more = state ? value.more?.length ?? 0 : 0
  const lines = state && (value.goals.length
    ? <ProofState value={value} text={markedTextOf(task)} diff={diff} next={next} />
    : <Formula text={PROVED} className="mr-line" upright />)
  return (
    <li className={`mr-box formula-row ${on ? 'is-on' : ''} ${cut ? 'is-cut' : ''} ${state && !value.goals.length ? 'is-done' : ''}`}>
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
  const [opened, setOpened] = useState({ test: null, lines: 0 }) // lines opened from the gap of a long run, for this test
  const canShowTree = Boolean(run?.proofRoot)
  const tree = canShowTree && mode === 'tree'
  const shown = steps.map((s, k) => ({ s, k, number: k + 1, current: k === at }))
  // A line holds the step that gave the box under it and every step after it that left the state as it was; steps
  // skipped before anything changed the initial state lead the first step that does.
  const rows = []
  let leading = []
  for (const step of shown) {
    if (step.s.entry.status !== 'skipped') {
      rows.push({ lead: leading, step, trail: [] })
      leading = []
    } else if (rows.length) rows.at(-1).trail.push(step)
    else leading.push(step)
  }
  if (leading.length) rows.push({ lead: leading, step: null, trail: [] })
  // A search that never stops runs to hundreds of steps: the report keeps the lines it began with and the lines it
  // has reached, and the stretch between them opens from a gap, some lines at a time.
  const head = Math.min(rows.length, HEAD_LINES + (opened.test === test ? opened.lines : 0))
  const tail = Math.max(head, rows.length - TAIL_LINES)
  const hidden = tail - head > GAP_LINES ? rows.slice(head, tail) : []
  const lines = hidden.length ? [...rows.slice(0, head), { gap: hidden }, ...rows.slice(tail)] : rows
  // Where the run went on from each box: the goal the next card acted on, which is not always the first. Steps that
  // left the state alone are passed over, and a box several branches left by different goals keeps its own mark.
  const byProof = new Map(shown.map((step) => [step.s.entry.proof?.id, step]))
  const actedOn = new Map()
  for (const { s } of shown) {
    const did = s.value?.didBy === s.entry.id ? s.value.did : null
    if (!ACTS.includes(did?.op) || !s.entry.proof) continue
    const goal = did.goalIndex ?? 0
    let from = s.entry.proof.parent
    while (byProof.get(from)?.s.entry.status === 'skipped') from = byProof.get(from).s.entry.proof.parent
    actedOn.set(from, actedOn.has(from) && actedOn.get(from) !== goal ? null : goal)
  }
  const nextOf = (id) => actedOn.get(id) ?? undefined
  const open = ended && run?.outputs?.out?.kind === 'state' && run.outputs.out.goals.length > 0
  const stuck = open ? lastIndexMatching(steps, (s) => s.entry.status === 'skipped') : -1
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
    const marked = el.querySelector(tree ? '.mr-branch-node.is-on' : '.mr-skip.is-stuck, .mr-step.is-on, .mr-skip.is-on') ?? (!tree && el.querySelector('.mr-flow')?.lastElementChild)
    if (!marked) { if (tree) el.scrollTop = 0; return }
    // A skipped step is kept in view with the whole line it stands on.
    const on = (!tree && marked.closest('.mr-step')) || marked
    const top = on.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop
    const bottom = (on.nextElementSibling?.classList.contains('mr-box') ? on.nextElementSibling : on)
    const end = bottom.getBoundingClientRect().bottom - el.getBoundingClientRect().top + el.scrollTop
    if (top < el.scrollTop) el.scrollTop = top
    else if (end > el.scrollTop + el.clientHeight) el.scrollTop = Math.max(top, end - el.clientHeight)
  }, [steps.length, at, tree, stuck])
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
          {start !== undefined && <Box value={start} task={task} show={show} next={nextOf(0)} />}
          {lines.flatMap(({ gap, lead, step, trail }) => {
            if (gap) {
              const first = (gap[0].step ?? gap[0].lead[0]).number
              const last = (gap.at(-1).trail.at(-1) ?? gap.at(-1).step ?? gap.at(-1).lead.at(-1)).number
              return [<li key="gap" className="mr-step mr-gap">
                <button type="button" aria-label={`${tr('运行步骤')} ${first}–${last}`} onClick={() => setOpened({ test, lines: (opened.test === test ? opened.lines : 0) + TAIL_LINES })}><Ellipsis size={14} aria-hidden="true" /></button>
              </li>]
            }
            const skip = ({ s, k, number, current }) => (
              <span key={k} className={`mr-item mr-skip ${current ? 'is-on' : ''} ${k === stuck ? 'is-stuck' : ''}`}>
                <span className="mr-num">{number}</span>
                <span className="mr-name">{s.mark}<NotationLabel label={L(s.label)} /></span>
                {s.entry.reason === 'position-missing' && <span className="mr-unplaced" role="img" aria-label={tr('找不到选定的应用位置')} title={tr('找不到选定的应用位置')}><LocateOff size={12} aria-hidden="true" /></span>}
                {s.entry.reason === 'nothing-new' && <span className="mr-unplaced" role="img" aria-label={tr('得到的已知都已经在已知里')} title={tr('得到的已知都已经在已知里')}><CopyCheck size={12} aria-hidden="true" /></span>}
              </span>
            )
            if (!step) return [<li key={`s${lead[0].k}`} className="mr-step is-skips">{lead.map(skip)}</li>]
            const { s, k, number, current } = step
            // A card that cannot do its step says ✗ (why, on a long press or hover) and gives back the state it was handed:
            // the next box. A card that cannot run at all (an input missing) says why, and nothing follows. A card still
            // waiting for its rule or its position stops the run there: it says what it lacks, in the accent rather than
            // as a failure, and hands nothing on.
            const broken = s.failed
            const refused = !broken && s.value?.kind === 'state' && s.value.error ? s.value.error : null
            const waiting = s.entry.reason === 'rule-required' || s.entry.reason === 'position-required'
            // A candidate a search drops for the sentences still unknown in it: those letters stand as what the step
            // found, and its box is drawn as a branch cut off.
            const left = unsettled(s.entry)
            const explained = !waiting && (left ? s.entry.proof.stopReason : stepExplained(s.entry, run))
            const state = waiting ? 'is-waiting' : `${broken || refused ? 'is-fail' : ''} ${refused ? 'is-refused' : ''}`
            return [
              <li key={`s${k}`} className={`mr-step ${current ? 'is-on' : ''} ${state}`}>
                {lead.map(skip)}
                <span className="mr-item">
                  <span className="mr-num">{number}</span>
                  <span className="mr-name">{s.mark}<NotationLabel label={L(s.label)} /></span>
                  {refused && !waiting ? <span className="mr-wrong" aria-label={L(refused)}><NotationLabel label={mark('cross')} /></span>
                    : left ? <Unsettled names={left} />
                    : !waiting && s.detail && <Formula text={s.detail} className="mr-note" />}
                  {explained && (
                    <button type="button" className="mr-info" aria-label={tr('这一步做了什么')} aria-expanded={told?.k === k} onClick={(event) => setTold(told?.k === k ? null : { k, anchor: event.currentTarget })}>
                      <Info size={13} />
                    </button>
                  )}
                </span>
                {trail.map(skip)}
                {(broken || waiting) && <span className="mr-why">{L(broken || refused)}</span>}
              </li>,
              !broken && !waiting && s.value !== undefined && <Box key={`b${k}`} value={refused ? { ...s.value, error: undefined } : s.value} task={task} show={show} diff={s.entry.diff} next={nextOf(s.entry.proof?.id)} on={current} cut={Boolean(left)} />,
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
