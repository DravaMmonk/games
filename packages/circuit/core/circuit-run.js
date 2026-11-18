// Connect the shared judges to circuit evaluation, replay and the result rows.
import { failureReason, inOrder, isGrid, runTests, sameAs, valueText } from 'kernel'
import { T } from 'kernel/words'
import { runBoard } from './boards.js'

const output = (run, name) => run.outputs[name] ?? null
const shape = (value) => isGrid(value) ? 'grid' : 'scalar'

/** Describe a failed output, optionally with the run position supplied by a circuit extension. */
export function outputReason(subject, show, wrap = message => message) {
  return failureReason({ relation: 'output', subject, show }, ({ want, got, at }) => {
    const message = T('「{subject}」应当是 {want}，这块板给出 {got}。', { subject, want: show(want), got: show(got) })
    return wrap(message, at)
  })
}

export function outputJudge(ports, expect, { same, show = valueText, says = () => null } = {}) {
  return inOrder(...ports.map((port) => sameAs(expect[port.name], {
    got: (run) => output(run, port.name),
    same,
    at: port.name,
    why: (want, got) => says(port, want, got) ?? outputReason(port.label, show),
  })))
}

export function onceRun({ same = (a, b) => a === b, show = valueText, tolerance, says } = {}) {
  const runTest = (task, circuit, test, parts, { traced = true } = {}) => {
    const trace = traced ? [] : null
    const run = { ...runBoard(circuit, { parts, bind: test.inputs, ctx: { trace } }), ...(trace && { trace }) }
    const judge = outputJudge(task.outputs, test.expect, { same: (want, got) => same(want, got, tolerance), show, says })
    const fail = judge(run)
    return fail ? { ...run, fail } : run
  }
  const entries = ({ task, test, run }) => [
    ...task.inputs.map((i) => ({ of: i.name, label: i.label, shape: shape(test.inputs[i.name]), given: test.inputs[i.name], shown: false })),
    ...task.outputs.map((o) => ({ of: o.name, label: o.label, shape: shape(test.expect[o.name]), got: output(run, o.name), want: test.expect[o.name], ...(tolerance === undefined ? {} : { tolerance }) })),
  ]
  return { runTest, runLevel: runTests(runTest), entries }
}
