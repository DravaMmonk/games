import { displays } from './ui/displays.js'
import { registerEditors } from './studio/index.jsx'
import { logicContext } from '../core/context.js'
import { taskScreen } from 'circuit/view'
import { typesetFormulas } from 'kernel/view'
import { texOf } from '../core/tex.js'
import define, { playPresentation } from './game.js'
import { plays } from '../core/plays.js'

const LogicPlay = taskScreen(logicContext, define)
export function register(kernel) {
  registerEditors(kernel)
  // Every formula a shared view shows (a rule row, a sentence picked, one quoted in a text) is typeset as logic's.
  typesetFormulas(texOf)
  kernel.implement('display', 'logic/proof-screen', displays['logic/proof-screen'])
  kernel.implement('display', 'logic/gates-screen', displays['logic/gates-screen'])
  kernel.implement('display', 'logic/machine-screen', displays['logic/machine-screen'])
  kernel.implement('display', 'logic/passed', displays['logic/passed'])
  kernel.unlocks('logic/symbols', (game, ...args) => (game.moduleGames?.logic ?? game).symbolUnlocks?.(...args) ?? [])
  for (const name of Object.keys(plays)) kernel.play(name, { component: LogicPlay, preview: LogicPlay, define, icon: playPresentation[name].icon })
}
