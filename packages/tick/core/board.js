import { T as catalogText } from 'kernel/words'
import { keepsState } from './registers.js'
import { INPUTS, OUTPUTS, circuitBoard } from 'circuit'
import { drive, hearing } from './ticks.js'

export const board = circuitBoard({
  breaksCycle: (_node, part) => keepsState(part),
  cards: [
    { type: 'line', side: 'left', of: (task) => (task.listens ? [{ name: 'line', label: catalogText("线") }] : []), params: () => ({}), part: hearing() },
    INPUTS,
    { type: 'say', side: 'right', of: (task) => (task.talks ? [{ name: 'say', label: catalogText("说") }] : []), part: drive() },
    OUTPUTS,
  ],
})
