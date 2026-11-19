import { exampleReports, withHidden } from 'kernel'
import { startValues, benchRun, openKnobs } from './bench.js'
function benchReport(task, value) {
  const { bench, model } = task
  return {
    verify: task.verify(),
    coverage: 'stage starts and authored action sequences; no authored reference/naive works',
    stages: (bench.stages ?? [null]).map((stage, stageIndex) => {
      let values = startValues(bench, stage), process = model.start?.() ?? null
      const snapshot = () => value({ values, process, report: benchRun(bench, model, values, { stageIndex, process }) })
      const steps = [{ action: 'start', ...snapshot() }]
      for (const action of bench.actions ?? []) {
        if (action.reset) for (const key of action.reset) values = { ...values, [key]: startValues(bench, stage)[key] }
        else if (model.act) for (let n = 0; n < (action.repeat ?? 1); n++) {
          process = model.act(process, action.act, values, action.arg)
          steps.push({ action: action.act, repetition: n, ...snapshot() })
        }
        if (action.reset) steps.push({ action: 'reset', ...snapshot() })
      }
      return { open: openKnobs(bench, stage), steps }
    }),
  }
}

function graphReport(task, kit) {
  const all = withHidden(task)
  const run = work => kit.runLevel(all, work, { traced: true })
  return {
    ...exampleReports(task.solution, task.naive, run),
    alsoFails: (task.alsoFails ?? []).map(run),
  }
}

export function imageReports({ spec, value }) {
  if (!spec.kit) return null
  return spec.levels.flatMap(level => level.tasks.map(task => {
    const kind = task.kind
    const report = kind === 'image/graph' ? graphReport(task, spec.kit) : kind === 'image/board' ? benchReport(task, value) : {
      verify: task.verify(), examples: task.probe.examples.map(example => ({ ...example, output: task.probe.run(example.input) })),
      choices: task.probe.answers.map(choice => ({ choice, pass: task.probe.judge(choice) })),
    }
    return { level: level.id, task: task.taskId ?? task.key ?? task.id, kind, report }
  }))
}
