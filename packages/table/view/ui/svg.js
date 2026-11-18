import { createSceneRenderer } from '../svg.js'
import { W } from '../../core/model/robot-scene.js'
import { robots } from '../../core/model/robots.js'
import { ICONS } from './glyphs.js'
export const { sceneSVG, robotGlyph, MARKS, markOf } = createSceneRenderer({ W, robots, icons: ICONS })
