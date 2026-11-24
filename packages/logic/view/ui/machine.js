// A machine level (《证明完毕》 chapter 8 on, ../machine.js) as the kernel's circuit screen plays it
// (../../../shell/CircuitScreen.jsx): its inputs down the left, the result on the right, the machine's parts (a game's
// parts.json), the rule parts of its rule books (registered by the course) and the parts the player built (packed
// parts running the boards that built them). A run goes through every test step by step, each card computing a step;
// the results show the test's inputs, what it wants and what reaches the result. Values (equations, proof states,
// clause sets, rules) read as lines of text.
import { T } from 'kernel/words'
import { useMemo } from 'react'
import { withPreset } from 'circuit'
import { directCardsOf, runMachine } from '../../core/machine.js'
import { presetFor } from '../../core/work.js'
import { didText, machineGeneralNotation, machineReadout, machineTextOf, machineTermOf } from '../../core/circuit-readouts.js'
import { useGeneralForm } from '../general-form.js'
import MachineReport, { machineRuleList } from './MachineReport.jsx'
import { typesetMachine } from './Formula.jsx'

export const machineScreen = {
  course: (game) => game.logic.machineBoards,
  useDisplayTask(task, test) {
    const general = useGeneralForm()
    return useMemo(() => general && test ? { ...task, notation: machineGeneralNotation(task, test) } : task, [general, task, test])
  },
  traySource: (task, type) => directCardsOf(task).get(type)?.source,
  play: { ...machineReadout, runLevel: (task, board, _parts, options) => runMachine(task, board, { traced: true, ...options }) },
  context: (task, _test, run) => ({ task, text: machineTextOf(task), term: machineTermOf(task), ruleSlots: run?.ruleSlots }),
  // A preset (a level's locked cards) stays on the board whatever is saved.
  ready: (board, task) => withPreset(board, presetFor(task)),
  readouts: (task, _circuit, { score }) => [{ value: score.steps, label: T("元件") }, task.budget !== undefined && { value: task.budget, label: T('最多') }],
  says: { go: T('运行全部测试'), done: T("全部通过") },
  log: true,
  // A step says what it did beside the card's name, in marks: which rule changed which goal (⊢ ⟵ R₁).
  stepNote: (e, run) => (e.value?.didBy === e.id ? didText(e.value.did, run, { nodeId: e.path?.length ? undefined : e.id }) : null),
  report: MachineReport,
  reportAside: machineRuleList,
  // Formulas on the cards are typeset in TeX, one face for all of logic's signs.
  typeset: typesetMachine,
  canvas: { height: 150, followStep: false },
}
