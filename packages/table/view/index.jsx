import { freshBoardProgress } from 'circuit'
import { tableContext } from '../core/course.js'
import tableGame from './game.js'
import { createSceneRenderer } from './svg.js'

export function register(kernel) {
 kernel.display('table/scene', createSceneRenderer)
}

/** Pair a course's table play names with the board and hand-played views. */
export function registerTableViews(kernel, names, { Hero }) {
 const define = (content, works) => tableGame(content, works, { Hero })
 function TablePlay({ context, work, onChange, phone }) {
  const { task, works } = tableContext(context)
  const game = define(context.content, works)
  const Screen = game.kinds[task.play].Screen
  return <Screen game={game} level={{ ...task, source: task }} saved={work} save={onChange}
   solve={() => {}} fail={() => {}} progress={context.progress ?? freshBoardProgress()} phone={phone} />
 }
 for (const name of names) kernel.play(name, { component: TablePlay, preview: TablePlay, define })
}

/** Display implementations available to a course registering table resources. */
export { displays as tableDisplays } from './ui/displays.js'
