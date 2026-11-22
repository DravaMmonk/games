import { SettingsContext } from 'kernel/view'
import { fresh as freshBoardProgress } from '../core/progress.js'

/** Mount an existing game screen as a package play or a standalone preview. */
export function taskScreen(readContext, define, screenKey = 'kind') {
  return function TaskScreen({ context, work, onChange, phone }) {
    const { task, works } = readContext(context)
    const game = define(context.content, works, { kernel: context.kernel })
    const Screen = game.kinds[task[screenKey]].Screen
    return <SettingsContext.Provider value={game}>
      <Screen game={game} level={{ ...task, source: task }} saved={work} save={onChange}
        solve={() => {}} fail={() => {}} progress={context.progress ?? freshBoardProgress()} phone={phone} />
    </SettingsContext.Provider>
  }
}
