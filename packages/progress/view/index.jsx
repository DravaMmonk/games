import { installStageViews } from './game-stages.js'
import './studio/stages.css'
import { tr } from 'kernel/view'
import { loadWorkshop } from '../core/workshop.js'
import { courseWorkshop } from '../core/workshop-view.js'
import { partAtStage } from '../core/studio-stages.js'
import { partUnlocks } from '../core/unlocks.js'
import { useCircuitWorkshop } from './useCircuitWorkshop.jsx'
import { useWorkshopShell } from './shell.jsx'
import StageChain from './studio/StageChain.jsx'

function WorkshopSwitch({ value, locked, write }) {
  return <label className="object-flag">
    <input type="checkbox" className="field-check" checked={value.workshop ?? true} disabled={locked}
      onChange={event => write.set('workshop', event.target.checked)} />
    {tr('工坊', 'Workshop')}
  </label>
}

export function register(kernel) {
  kernel.game('progress:workshop', (game, content) => {
    game.workshop = {
      replaces: content.replaces ?? {},
      trays: content.registries['circuit/tray'] ?? {},
      publications: Object.fromEntries(content.levels.flatMap(level => level.tasks.map(task => [task.id, task.publishes ?? []]))),
    }
    game.useCircuitParts = useCircuitWorkshop
    game.useCircuitTools = useWorkshopShell
    game.partAtStage = partAtStage
    installStageViews(game)
    const workshop = courseWorkshop(game, () => loadWorkshop(window.localStorage))
    game.bindPassingBoard = workshop.bind
    game.restoreBuilt = workshop.restore
  })
  kernel.unlocks('progress:parts', partUnlocks)
  kernel.editorExtension('progress:part', { type: 'circuit/part', stageChain: StageChain })
  kernel.editorExtension('progress:tray', { type: 'circuit/tray', workshop: WorkshopSwitch })
}
