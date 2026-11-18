import { exampleReports } from 'kernel'
import { handExamples, judgeHand } from './model/hand-verdict.js'
import { robotReport } from './model/verdict.js'
const examples = (task, run, reference = task.solution, naive = task.naive) => exampleReports(reference, naive, run)
export function tableReports({ spec }) {
 if (!spec.table) return null
 const works = spec.table
 return spec.levels.flatMap(level => (works.played?.get(level.id) ?? level.tasks).map(task => {
  const report = task.play.split('/').at(-1) === 'circuit' ? examples(task, work => robotReport(works.model.runCircuit, task, work, { traced: true })) : (() => {
   const sample = handExamples(task)
   return examples(task, work => judgeHand(task, work), sample.reference, sample.naive)
  })()
  return { level: level.id, task: task.taskId ?? task.key ?? task.id, kind: task.play, report }
 }))
}
