import { board } from './mechanism/board.js'
import { circuitWorks } from './mechanism/work.js'
import { runLevel } from './mechanism/run.js'
import { primitivesOnly } from './board-cards.js'

/** Adapt a circuit runner and its work reader to the registered play contract. */
export function createBoardPlay({ name, board, readWorks, runLevel, starter = false, runtime }) {
  const preparedBoard = Symbol()
  const prepareBoard = ({ content, task, parts = {} }, works) => {
    if (!content) return { task, view: primitivesOnly(board, parts) }
    works ??= readWorks(content)
    const id = task.taskId ?? task.id
    const prepared = [...works.played.values()].flat().find(task => task.taskId === id)
    if (!prepared) throw new Error(`unknown ${name} task ${id}`)
    return { task: prepared, works, view: works.forTask(prepared) }
  }
  const contextOf = context => context[preparedBoard] ?? prepareBoard(context)
  return {
    contextOf,
    // Bind preparation to this evaluation so later edits can prepare a fresh course.
    prepareContext: (context, works) => ({ ...context, [preparedBoard]: prepareBoard(context, works) }),
    initial(context) {
      const { task, view } = contextOf(context)
      return starter && Array.isArray(task.starter) ? board.fromText(task.starter, task, view) : board.startBoard(task)
    },
    read(work, context) {
      const { task, view } = contextOf(context)
      return Array.isArray(work) ? board.fromText(work, task, view) : work
    },
    write: work => work,
    normalize: work => work,
    run(work, context) {
      const { task, view } = contextOf(context)
      return runLevel({ ...task, tests: [...task.tests, ...(task.hidden ?? [])] }, work, view.partOf)
    },
    judge: report => ({ pass: report.pass }),
    ...(runtime && { runtime }),
  }
}

export const boardPlay = createBoardPlay({ name: 'circuit', board, readWorks: circuitWorks, runLevel, starter: true })

/** Check authored reference and naive works using the public play contract. */
export function boardChecks({ content }) {
  const entries = content.levels.flatMap(({ id: level, tasks }) => tasks
    .filter(task => task.play === 'circuit/board').map(task => ({ level, task })))
  if (!entries.length) return []
  const failed = ({ level, task }, error) => ({ level, fail: true, text: `${task.id}: ${error.message}` })
  let works
  try {
    works = circuitWorks(content)
  } catch (error) {
    return entries.map(entry => failed(entry, error))
  }
  return entries.map(entry => {
    const { level, task } = entry
    try {
      const context = boardPlay.prepareContext({ content, task }, works)
      const passed = work => boardPlay.judge(boardPlay.run(boardPlay.read(work, context), context)).pass
      const pass = passed(task.solution) && (!task.naive || !passed(task.naive))
      return { level, fail: !pass, text: `${task.id}: circuit reference and naive ${pass ? 'PASS' : 'FAIL'}` }
    } catch (error) { return failed(entry, error) }
  })
}
