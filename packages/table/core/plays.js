import { circuitPlaySchema } from 'circuit'
import { definePlays } from 'kernel'
import modes from '../capabilities/mode.json' with { type: 'json' }

export const modeNames = Object.keys(modes.items)
const modeName = play => {
  const name = play.split('/').at(-1)
  return name === 'circuit' ? 'robot-board' : `hand-${name}`
}
export const configurationOf = mode => modes.items[mode].configuration

export const playOf = task => configurationOf(modeName(task.play))
export const playsFor = names => definePlays(Object.fromEntries(names.map(name => [name, playOf({ play: name })])), circuitPlaySchema)
