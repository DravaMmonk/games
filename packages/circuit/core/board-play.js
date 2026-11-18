import { board } from './mechanism/board.js'
import { circuitWorks } from './mechanism/work.js'
import { runLevel } from './mechanism/run.js'
import { primitivesOnly } from './board-cards.js'

/** Adapt a circuit runner and its work reader to the registered play contract. */
export function createBoardPlay({ name, board, readWorks, runLevel, starter = false, runtime }) {
  const contextOf = ({ content, task, parts = {} }) => {
    if (!content) return { task, view: primitivesOnly(board, parts) }
    const works = readWorks(content)
    const id = task.taskId ?? task.id
    const prepared = [...works.played.values()].flat().find(task => task.taskId === id)
    if (!prepared) throw new Error(`unknown ${name} task ${id}`)
    return { task: prepared, works, view: works.forTask(prepared) }
  }
  return {
    contextOf,
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
    judge: report => ({ pass: report.pass, score: report.pass ? 1 : 0 }),
    ...(runtime && { runtime }),
  }
}

export const boardPlay = createBoardPlay({ name: 'circuit', board, readWorks: circuitWorks, runLevel, starter: true })

/** Check authored reference and naive works using the public play contract. */
export function boardChecks({ content }) {
  return content.levels.flatMap(level => level.tasks.filter(task => task.play === 'circuit/board').map(task => {
    const context = { content, task }
    try {
      const passed = work => boardPlay.judge(boardPlay.run(boardPlay.read(work, context), context)).pass
      const pass = passed(task.solution) && (!task.naive || !passed(task.naive))
      return { level: level.id, fail: !pass, text: `${task.id}: circuit reference and naive ${pass ? 'PASS' : 'FAIL'}` }
    } catch (error) { return { level: level.id, fail: true, text: `${task.id}: ${error.message}` } }
  }))
}
