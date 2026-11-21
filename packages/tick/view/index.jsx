import { BoardPlay, circuitSettings } from 'circuit/view'
import { busPlay } from '../core/index.js'
import { CARDS } from './catalog.js'
import define, { playPresentation } from './game.js'
export { displays } from './displays.js'
export { default } from './game.js'

const run = { tests: [], states: [] }

export function BusBoard(props) {
  return <BoardPlay {...props} play={busPlay} extraCards={CARDS} settings={circuitSettings} run={run} />
}

export function register(kernel) {
  kernel.play('tick/board', { component: BusBoard, preview: BusBoard, define, icon: playPresentation.icon })
}
