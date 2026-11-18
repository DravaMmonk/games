import { taskScreen } from 'circuit/view'
import { tableContext } from '../core/course.js'
import tableGame from './game.js'
import { createSceneRenderer } from './svg.js'

export function register(kernel) {
 kernel.display('table/scene', createSceneRenderer)
}

/** Pair a course's table play names with the board and hand-played views. */
export function registerTableViews(kernel, names, { Hero }) {
 const define = (content, works) => tableGame(content, works, { Hero })
 const TablePlay = taskScreen(tableContext, define, 'play')
 for (const name of names) kernel.play(name, { component: TablePlay, preview: TablePlay, define })
}

/** Display implementations available to a course registering table resources. */
export { displays as tableDisplays } from './ui/displays.js'
