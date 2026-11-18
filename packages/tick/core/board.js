import { T as catalogText } from 'kernel/words'
import { INPUTS, OUTPUTS, circuitBoard } from 'circuit'
import { drive, hearing } from './ticks.js'

export const board = circuitBoard({
  ticks: true,
  cards: [
    { type: 'line', side: 'left', of: (task) => (task.listens ? [{ name: 'line', label: catalogText("线") }] : []), params: () => ({}), part: hearing() },
    INPUTS,
    { type: 'say', side: 'right', of: (task) => (task.talks ? [{ name: 'say', label: catalogText("说") }] : []), part: drive() },
    OUTPUTS,
  ],
})
