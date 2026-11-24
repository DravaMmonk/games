// A machine level (《证明完毕》 chapter 8 on, ../machine.js) as the kernel's circuit screen plays it
// (../../../shell/CircuitScreen.jsx): its inputs down the left, the result on the right, the machine's parts (a game's
// parts.json), the rule parts of its rule books (registered by the course) and the parts the player built (packed
// parts running the boards that built them). A run goes through every test step by step, each card computing a step;
// the results show the test's inputs, what it wants and what reaches the result. Values (equations, proof states,
// clause sets, rules) read as lines of text.
import { T } from 'kernel/words'
import { createElement, Fragment, useMemo } from 'react'
import { withPreset } from 'circuit'
import { CIRCUIT_WORDS } from 'circuit/view'
import { L } from 'kernel/view'
import { defaultBoundRule, directCardsOf, machineConfigurationCases, runMachine } from '../../core/machine.js'
import { useMachineRunOptions } from '../auto-first.js'
import { presetFor } from '../../core/work.js'
import { didText, machineGeneralNotation, machineReadout, machineTextOf, machineTermOf } from '../../core/circuit-readouts.js'
import { useGeneralForm } from '../general-form.js'
import { MachineApplicationChoice } from './OccurrenceChoice.jsx'
import MachineReport, { machineRuleList } from './MachineReport.jsx'
import BoundRule from './BoundRule.jsx'
import RulePanel from './RulePanel.jsx'
import { StepState, markedTextOf, typesetMachine } from './ProofState.jsx'

/** How a played run left a card: a rule that did not apply fades, apart from one whose chosen position is not in this case. */
function playedClass(node, ctx) {
  const played = ctx.view?.played
  if (!played || ctx.path.length) return ''
  const { run, upTo } = played
  let last = null
  for (const entry of run.trace.slice(0, upTo + 1)) if (entry.id === node.id && !entry.path?.length && entry.status) last = entry
  const status = upTo >= run.trace.length - 1 ? run.nodeStatuses?.get(node.id) ?? last?.status : last?.status
  if (status !== 'skipped') return ''
  return last?.reason === 'position-missing' ? 'is-skipped is-unplaced' : 'is-skipped'
}

export const machineScreen = {
  course: (game) => game.logic.machineBoards,
  useDisplayTask(task, test) {
    const general = useGeneralForm()
    return useMemo(() => general && test ? { ...task, notation: machineGeneralNotation(task, test) } : task, [general, task, test])
  },
  traySource: (task, type) => directCardsOf(task).get(type)?.source,
  play: { ...machineReadout, runLevel: (task, board, _parts, options) => runMachine(task, board, { traced: true, ...options }) },
  useRunOptions: useMachineRunOptions,
  context: (task, _test, run, options) => ({ task, text: machineTextOf(task), term: machineTermOf(task), ruleSlots: run?.ruleSlots, autoFirst: options.autoFirst }),
  settingControls: (task) => ({
    select: (props) => /^logic\/(rewriteOccurrences|backwardPositions)\(/.test(props.setting.from ?? '')
      ? createElement(MachineApplicationChoice, {
        ...props,
        rewrite: props.setting.from.startsWith('logic/rewriteOccurrences('),
        text: markedTextOf(task),
      })
      : null,
  }),
  partsPanel: RulePanel,
  // A rule-bound card leads every face with its rule: picked on the card and in its detail, read on a phone tile.
  partFace: (task, _test, run, { autoFirst }) => (drawn, { slot, node, ctx, set }) => {
    // Inside a built part the card belongs to the task that built it.
    const level = ctx.path.length ? ctx.board.level : task
    const card = directCardsOf(level).get(node.type)
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
    return createElement(Fragment, null, rule, drawn)
  },
  // A preset (a level's locked cards) stays on the board whatever is saved.
  ready: (board, task) => withPreset(board, presetFor(task)),
  readouts: (task, _circuit, { score }) => [{ value: score.steps, label: T("元件") }, task.budget !== undefined && { value: task.budget, label: T('最多') }],
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
