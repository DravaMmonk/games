import { imageContext } from '../core/context.js'
import { taskScreen } from 'circuit/view'
/** Intensity styling and range calculations for course-specific displays. */
export { grey, rangeOf } from './ui/display.js'

import define from './game.js'
import { displays as imageDisplays } from './ui/displays.js'
import { displays as specialDisplays } from './ui/benches/displays.js'
import { displays as sharedDisplays } from './bench/displays.jsx'
const benchDisplays = { ...sharedDisplays, ...specialDisplays }

const ImagePlay = taskScreen(imageContext, define)
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
  kernel.implement('display', 'image/obscura', benchDisplays['image/obscura'])
  kernel.implement('display', 'image/obscuraScreen', benchDisplays['image/obscuraScreen'])
  kernel.implement('display', 'image/step', benchDisplays['image/step'])
  kernel.implement('display', 'image/knobs', benchDisplays['image/knobs'])
  kernel.implement('display', 'image/actions', benchDisplays['image/actions'])
  kernel.implement('display', 'image/verdict', benchDisplays['image/verdict'])
  kernel.implement('display', 'image/goals', benchDisplays['image/goals'])
  kernel.implement('display', 'image/stages', benchDisplays['image/stages'])
  kernel.implement('display', 'image/cases', benchDisplays['image/cases'])
  kernel.implement('display', 'image/plot', benchDisplays['image/plot'])
  kernel.implement('display', 'image/strips', benchDisplays['image/strips'])
  kernel.implement('display', 'image/text', benchDisplays['image/text'])
  kernel.implement('display', 'image/stats', benchDisplays['image/stats'])
  kernel.implement('display', 'image/chips', benchDisplays['image/chips'])
  kernel.implement('display', 'image/curve', benchDisplays['image/curve'])
  kernel.implement('display', 'image/table', benchDisplays['image/table'])
  kernel.implement('display', 'image/progress', benchDisplays['image/progress'])
}

/** The shared parameter control for custom bench displays. */
export { default as Knob } from './bench/Knob.jsx'
