import { tr } from 'kernel/words'
import { loadWorkshop } from '../core/workshop.js'
import { courseWorkshop } from '../core/workshop-view.js'
import { useCircuitWorkshop } from './useCircuitWorkshop.jsx'
import { useWorkshopShell } from './shell.jsx'

function WorkshopSwitch({ value, locked, write }) {
  return <label className="object-flag">
    <input type="checkbox" className="field-check" checked={value.workshop ?? true} disabled={locked}
      onChange={event => write.set('workshop', event.target.checked)} />
    {tr("工坊")}
  </label>
}

export function register(kernel) {
  kernel.shell('workshop/library', useWorkshopShell)
  kernel.game('workshop/library', (game, content) => {
    game.workshop = {
      replaces: content.replaces ?? {},
      trays: content.registries['circuit/tray'] ?? {},
      publications: Object.fromEntries(content.levels.flatMap(level => level.tasks.map(task => [task.id, task.publishes ?? []]))),
    }
    game.useCircuitParts = useCircuitWorkshop
    const workshop = courseWorkshop(game, () => loadWorkshop(window.localStorage))
    game.bindPassingBoard = workshop.bind
    game.restoreBuilt = workshop.restore
  })
  kernel.editorExtension('workshop/tray', { type: 'circuit/tray', workshop: WorkshopSwitch })
}
