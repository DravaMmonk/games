import { displays } from './ui/displays.js'
import { registerEditors } from './studio/index.jsx'
import { logicContext } from '../core/context.js'
import { freshBoardProgress } from 'circuit'
import define from './game.js'
import { plays } from '../core/plays.js'

function LogicPlay({ context, work, onChange, phone }) {
  const { task, works } = logicContext(context)
  const game = define(context.content, works, { kernel: context.kernel })
  const Screen = game.kinds[task.kind].Screen
  return <Screen game={game} level={{ ...task, source: task }} saved={work} save={onChange}
    solve={() => {}} fail={() => {}} progress={context.progress ?? freshBoardProgress()} phone={phone} />
}
export function register(kernel) {
  registerEditors(kernel)
  kernel.implement('display', 'logic/proof-screen', displays['logic/proof-screen'])
  kernel.implement('display', 'logic/gates-screen', displays['logic/gates-screen'])
  kernel.implement('display', 'logic/machine-screen', displays['logic/machine-screen'])
  kernel.implement('display', 'logic/passed', displays['logic/passed'])
  kernel.unlocks('logic/symbols', (game, ...args) => (game.moduleGames?.logic ?? game).symbolUnlocks?.(...args) ?? [])
  for (const name of Object.keys(plays)) kernel.play(name, { component: LogicPlay, preview: LogicPlay, define })
}
