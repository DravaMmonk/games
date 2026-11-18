import { registeredOperations } from 'kernel'
import { operations } from './registers.js'
import runtime from './runtime.js'
import { meaning } from './vocabulary.js'
import { board } from './board.js'
import { tickBusWorks } from './work.js'
import { runLevel } from './run.js'
import { createBoardPlay } from 'circuit'
import { play } from './play.js'

export { board } from './board.js'
export { tickBusWorks, prepareWorks } from './work.js'
export { runLevel, runTest, entries } from './run.js'
export { bitsOf, lineOf, sayer } from './line.js'
export { wantOf } from './wants.js'
export { default as runtime } from './runtime.js'

export const busPlay = createBoardPlay({ name: 'tick', board, readWorks: tickBusWorks, runLevel, runtime })

export function register(kernel) {
  Object.assign(registeredOperations, operations)
  for (const [name, operation] of Object.entries(operations)) kernel.implement('operation', name, operation)
  kernel.kind('tick/board', meaning)
  kernel.play('tick/board', busPlay)
  kernel.check('tick/boards', ({ content }) => runtime.validate(runtime.spec(content)))
  kernel.agent('tick/board', {
    observe(context) { const { task, works } = busPlay.contextOf(context); return play.open(textContext(task, works)) },
    act(context, text) { const { task, works } = busPlay.contextOf(context); return play.attempt(textContext(task, works), text) },
  })
}

function textContext(task, works) {
  const all = Object.entries(works.defs).map(([type, def]) => ({ key: `part:${type}`, part: type, name: def.name, desc: def.desc }))
  return { level: { ...task, source: task }, game: { circuit: works, parts: { all }, defined: { of: type => works.defs[type] } }, progress: {}, flags: new Set() }
}
