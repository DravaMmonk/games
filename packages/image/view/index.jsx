import { imageContext } from '../core/index.js'
import { progress } from 'circuit'
export { grey, rangeOf } from './ui/display.js'

import define from './game.js'
import { displays as imageDisplays } from './ui/displays.js'
import { displays as specialDisplays } from './ui/benches/displays.js'
import { displays as sharedDisplays } from './bench/displays.jsx'
const benchDisplays = { ...sharedDisplays, ...specialDisplays }
export const displays = { ...imageDisplays, ...benchDisplays }
export { default } from './game.js'
export function ImagePlay({ context, work, onChange, phone }) {
  const { task, works } = imageContext(context)
  const game = define(context.content, works, { kernel: context.kernel })
  const Screen = game.kinds[task.kind].Screen
  return <Screen game={game} level={{ ...task, source: task }} saved={work} save={onChange}
    solve={() => {}} fail={() => {}} progress={context.progress ?? progress.fresh()} phone={phone} />
}
export function register(kernel) {
  kernel.play('image/graph', { component: ImagePlay, preview: ImagePlay, define })
  kernel.play('image/board', { component: ImagePlay, preview: ImagePlay, define })
  kernel.play('image/probe', { component: ImagePlay, preview: ImagePlay, define })
  kernel.display('image/hero', imageDisplays['image/hero'])
  kernel.display('image/introduction', imageDisplays['image/introduction'])
  kernel.display('image/circuit', imageDisplays['image/circuit'])
  kernel.display('image/imageKernel', imageDisplays['image/imageKernel'])
  kernel.display('image/catalog', imageDisplays['image/catalog'])
  kernel.display('image/probe', imageDisplays['image/probe'])
  kernel.display('image/obscura', benchDisplays['image/obscura'])
  kernel.display('image/obscuraScreen', benchDisplays['image/obscuraScreen'])
  kernel.display('image/step', benchDisplays['image/step'])
  kernel.display('image/knobs', benchDisplays['image/knobs'])
  kernel.display('image/actions', benchDisplays['image/actions'])
  kernel.display('image/verdict', benchDisplays['image/verdict'])
  kernel.display('image/goals', benchDisplays['image/goals'])
  kernel.display('image/stages', benchDisplays['image/stages'])
  kernel.display('image/cases', benchDisplays['image/cases'])
  kernel.display('image/plot', benchDisplays['image/plot'])
  kernel.display('image/strips', benchDisplays['image/strips'])
  kernel.display('image/text', benchDisplays['image/text'])
  kernel.display('image/stats', benchDisplays['image/stats'])
  kernel.display('image/chips', benchDisplays['image/chips'])
  kernel.display('image/curve', benchDisplays['image/curve'])
  kernel.display('image/table', benchDisplays['image/table'])
  kernel.display('image/progress', benchDisplays['image/progress'])
}

export { default as Knob } from './bench/Knob.jsx'
export { default as Plot, Legend } from './bench/Plot.jsx'
export { Rich } from './bench/Rich.jsx'

export { formatValue, knobKind, needText, rowValue, goalOf, limitOf } from '../core/bench.js'
