// A machine level (《证明完毕》 chapter 8 on, ../machine.js) as the kernel's circuit screen plays it
// (../../../shell/CircuitScreen.jsx): its inputs down the left, the result on the right, the machine's parts (a game's
// parts.json), the rule parts of its rule books (registered by the course) and the parts the player built (packed
// parts running the boards that built them). A run goes through every test step by step, each card computing a step;
// the results show the test's inputs, what it wants and what reaches the result. Values (equations, proof states,
// clause sets, rules) read as lines of text.
import { T } from 'kernel/words'
import { createElement, useMemo } from 'react'
import { frameTree, settingsOf, sourceOf, withPreset } from 'circuit'
import { CIRCUIT_WORDS } from 'circuit/view'
import { L } from 'kernel/view'
import { defaultBoundRule, directCardsOf, machineConfigurationCases, runMachine } from '../../core/machine.js'
import { useMachineRunOptions } from '../auto-first.js'
import { presetFor } from '../../core/work.js'
import { didText, machineGeneralNotation, machineReadout, machineTextOf, machineTermOf } from '../../core/circuit-readouts.js'
import { useGeneralForm } from '../general-form.js'
import { FirstGoalOnly, MachineApplicationChoice, RunsAgain } from './OccurrenceChoice.jsx'
import MachineReport, { machineRuleList } from './MachineReport.jsx'
import BoundRule from './BoundRule.jsx'
import RulePanel from './RulePanel.jsx'
import { StepState, markedTextOf, typesetMachine } from './ProofState.jsx'
import SequentSide, { isSequentSide } from './SequentSide.jsx'

const stepsByProof = new WeakMap()
/** A run's steps by their place in its tree of candidates (../../core/proof-tree.js). */
function byProof(run) {
  if (!stepsByProof.has(run)) stepsByProof.set(run, new Map(run.trace.filter((entry) => entry.proof).map((entry) => [entry.proof.id, entry])))
  return stepsByProof.get(run)
}

/**
 * How a played run left a card: a rule that did not apply fades, apart from one whose chosen position is not in this
 * case. While a run that tries several candidates plays, a card shows what it did on the way to the step on view, not
 * what it last did on a path the run has since left; once played through, what it did on the way to the result: in a
 * search, in the round that reached it (finalRounds).
 */
function playedClass(node, ctx) {
  const played = ctx.view?.played
  if (!played || ctx.path.length) return ''
  const { run, upTo } = played
  const own = (entry) => entry.id === node.id && !entry.path?.length && entry.status
  let last = null
  const through = upTo >= run.trace.length - 1
  const at = run.trace[Math.min(upTo, run.trace.length - 1)]
  if (through && finalRounds(run).has(node.id)) last = finalRounds(run).get(node.id)
  else if (at?.proof) {
    const steps = byProof(run)
    for (let entry = at; entry && !last; entry = steps.get(entry.proof.parent)) if (own(entry)) last = entry
  } else {
    for (const entry of run.trace.slice(0, upTo + 1)) if (own(entry)) last = entry
  }
  const status = through && !finalRounds(run).has(node.id) ? run.nodeStatuses?.get(node.id) ?? last?.status : last?.status
  if (status !== 'skipped') return ''
  return last?.reason === 'position-missing' ? 'is-skipped is-unplaced' : 'is-skipped'
}

/** The operations of the frames a card stands in: in a search frame a backward card with no goal picked works on the
 *  first goal alone; a repeat or search frame runs it again (../../core/machine.js search, repeat). */
function framesAround(level, board, node) {
  const tree = frameTree(board.nodes)
  return new Set((tree.ancestors(node.in) ?? []).map((region) => level.partDefs?.[tree.node(region.slice(0, region.lastIndexOf('/')))?.type]?.op))
}
const RUN_AGAIN = ['logic/search', 'logic/repeat']

const rounds = new WeakMap()
/**
 * Where a played search rests: each frame that went round on the way to the result, in the round that reached it, and
 * not in the candidates it tried after it (the last steps of the trace). By source (sourceOf), the last entry of every
 * card and frame in those rounds; empty for a run that searched nothing.
 */
function finalRounds(run) {
  if (rounds.has(run)) return rounds.get(run)
  const own = (entry) => !entry.path?.length
  const starts = new Map()
  run.trace.forEach((entry, k) => { if (own(entry) && entry.key != null && entry.proof?.resultPath) starts.set(sourceOf(entry.id, entry.key), k) })
  const settled = new Map()
  for (const [source, from] of starts) {
    const next = run.trace.findIndex((entry, k) => k > from && own(entry) && sourceOf(entry.id, entry.key) === source)
    for (const entry of run.trace.slice(from, next < 0 ? undefined : next)) if (own(entry)) settled.set(sourceOf(entry.id, entry.key), entry)
  }
  rounds.set(run, settled)
  return settled
}

/** The values a played-through run leaves on the board: a search's in the round that reached the result. */
function settledValues(run, values) {
  const settled = finalRounds(run)
  if (!settled.size) return values
  const shown = new Map(values)
  for (const [source, entry] of settled) if (!entry.error) shown.set(source, entry.playbackValue ?? entry.value)
  return shown
}

export const machineScreen = {
  course: (game) => game.logic.machineBoards,
  useDisplayTask(task, test) {
    const general = useGeneralForm()
    return useMemo(() => general && test ? { ...task, notation: machineGeneralNotation(task, test) } : task, [general, task, test])
  },
  traySource: (task, type) => directCardsOf(task).get(type)?.source,
  play: { ...machineReadout, runLevel: (task, board, _parts, options) => runMachine(task, board, { traced: true, ...options }), settle: settledValues },
  useRunOptions: useMachineRunOptions,
  context: (task, _test, run, options) => ({ task, text: machineTextOf(task), term: machineTermOf(task), ruleSlots: run?.ruleSlots, autoFirst: options.autoFirst }),
  settingControls: (task) => ({
    select: (props) => /^logic\/(rewriteOccurrences|backwardPositions|forwardPositions)\(/.test(props.setting.from ?? '')
      ? createElement(MachineApplicationChoice, {
        ...props,
        direction: props.setting.from.startsWith('logic/rewriteOccurrences(') ? 'rewrite' : props.setting.from.startsWith('logic/forwardPositions(') ? 'forward' : 'backward',
        text: markedTextOf(task),
      })
      : isSequentSide(props.setting) ? createElement(SequentSide, props) : null,
  }),
  partsPanel: RulePanel,
  // A rule-bound card leads every face with its rule: picked on the card and in its detail, read on a phone tile.
  partFace: (task, _test, run, { autoFirst }) => (drawn, { def, slot, node, ctx, set }) => {
    // Inside a built part the card belongs to the task that built it.
    const level = ctx.path.length ? ctx.board.level : task
    const card = directCardsOf(level).get(node.type)
    // A part that works on one side of ⊢ (simp, cnf) shows that side on its phone tile as on its card.
    if (!card && slot === 'tileExtra' && def && !def.views?.tile) {
      const side = settingsOf(def).find(isSequentSide)
      if (side) return createElement('div', { className: 'pf-face is-tile' }, createElement(SequentSide, { setting: side, value: node.params?.at, readOnly: true }))
    }
    if (!card) return drawn
    // On a phone tile a card that still lacks its rule or its position says so in place of a state.
    if (slot === 'thumb') {
      const wire = ctx.board.circuit.wires.find((w) => w.to === node.id)
      const [{ pending }] = machineConfigurationCases(level, node, [[wire && ctx.view?.values.get(wire.from)]], { autoFirst })
      if (pending) return createElement('span', { className: 'lg-pending' }, L(CIRCUIT_WORDS.notConfigured))
      const value = ctx.view?.values.get(node.id)
      const own = value?.kind === 'state' && value.goals.length > 0 && !value.error
      return own ? createElement(StepState, { before: wire && ctx.view.values.get(wire.from), value, text: markedTextOf(level) }) : drawn
    }
    const rule = createElement(BoundRule, { card, node, unpicked: defaultBoundRule(card, { autoFirst }), task: level, run: ctx.path.length ? null : run, set: slot === 'tileExtra' ? null : set, open: slot === 'detail' })
    const frames = framesAround(level, ctx.board.circuit, node)
    return createElement(FirstGoalOnly.Provider, { value: frames.has('logic/search') },
      createElement(RunsAgain.Provider, { value: RUN_AGAIN.some((op) => frames.has(op)) }, rule, drawn))
  },
  // A preset (a level's locked cards) stays on the board whatever is saved.
  ready: (board, task) => withPreset(board, presetFor(task)),
  // Only a task with a card budget reads a number off the board: cards used over cards allowed, in the failure colour past it.
  readouts: (task, _circuit, { score }) => [task.budget !== undefined && { value: `${score.steps}/${task.budget}`, label: T("元件"), fail: score.steps > task.budget }],
  says: { go: T('运行全部测试'), done: T("全部通过") },
  log: true,
  // A step says what it did beside the card's name, in marks: which rule changed which goal (⊢ ⟵ R₁).
  stepNote: (e, run) => (e.value?.didBy === e.id ? didText(e.value.did, run) : null),
  card: { cardClass: playedClass, nodeClass: playedClass },
  report: MachineReport,
  reportAside: machineRuleList,
  // Formulas on the cards are typeset in TeX, one face for all of logic's signs.
  typeset: typesetMachine,
  canvas: { height: 150, followStep: false },
}
