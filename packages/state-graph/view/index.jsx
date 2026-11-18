import { registerTableViews, tableDisplays } from 'table/view'
import plays from '../capabilities/play.json' with { type: 'json' }
import Hero from './hero.jsx'

export function register(kernel) {
 kernel.implement('display', 'state-graph/hero', Hero)
 kernel.implement('display', 'state-graph/introduction', tableDisplays.introduction)
 kernel.implement('display', 'state-graph/circuit', tableDisplays.circuit)
 kernel.implement('display', 'state-graph/manual', tableDisplays.manual)
 kernel.implement('display', 'state-graph/catalog', tableDisplays.catalog)
 registerTableViews(kernel, Object.keys(plays.items).map(name => `state-graph/${name}`), { Hero })
}
