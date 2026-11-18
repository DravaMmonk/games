import { tableWorks } from './work.js'
import { robotReport } from './model/verdict.js'
import { createRobotCircuits } from './circuits.js'
import { wiring, robotBlueprint } from './model/wiring.js'
import { fitted, blank } from './model/board.js'
import { worldOf } from './model/task-world.js'
import { judgeHand } from './model/hand-verdict.js'
import { play } from './play.js'
import runtime from './runtime.js'
import { modeNames, configurationOf } from './plays.js'

export function tableContext({ content, task, progress }) {
 const works = tableWorks(content)
 if (progress) works.syncOwn(progress.built)
 const name = task.taskId ?? task.id
 const prepared = [...works.played.values()].flat().find(task => task.taskId === name || task.key === name)
 if (!prepared) throw new Error(`unknown table task ${name}`)
 return { task: prepared, works }
}
function tablePlay(mode) {
 const circuit = configurationOf(mode).editor === 'circuit'
 return {
  initial(context) { return circuit ? fitted(blank(), tableContext(context).task.given) : {} },
  read(work, context) {
   if (!circuit || !Array.isArray(work)) return work
   const { task, works } = tableContext(context)
   return robotBlueprint(works.model, task.given, worldOf(task)).read(work)
  },
  write: work => work, normalize: work => work,
  run(work, context) {
   const { task, works } = tableContext(context)
   return circuit ? robotReport(works.model.runCircuit, task, work) : judgeHand(task, work)
  },
  judge: report => ({ pass: report.pass, score: report.pass ? 1 : 0 }),
  runtime,
 }
}

export const modeImplementations = Object.fromEntries(modeNames.map(mode => [`table/${mode}`, tablePlay(mode)]))

/** Attach the shared runtime under the course's declared play names. */
export function registerTablePlays(kernel, plays, checkName) {
 for (const [name, mode] of Object.entries(plays)) {
  kernel.play(name, modeImplementations[mode])
  kernel.agent(name, {
   observe(context) { return play.open(textContext(context)) },
   act(context, work) { return play.attempt(textContext(context), work) },
  })
 }
 kernel.check(checkName, ({ content }) => content.levels.some(level => level.tasks.some(task => Object.hasOwn(plays, task.play))) ? runtime.validate(runtime.spec(content)) : [])
}
function textContext(context) {
 const { task, works } = tableContext(context)
 return { game: { table: works, circuit: createRobotCircuits(works, { wire: wiring, place: board => board }) }, level: { ...task, source: task }, flags: context.flags ?? new Set(context.progress?.flags ?? []), progress: context.progress ?? { built: {}, passed: [], data: {}, solved: [] } }
}
