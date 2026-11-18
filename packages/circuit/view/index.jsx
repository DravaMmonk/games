import { policyFor } from 'progress'
import { installStageViews } from './progression/game-stages.js'
import { partAtStage } from '../core/progression/studio-stages.js'
import { partUnlocks } from '../core/progression/unlocks.js'
import StageChain from './progression/studio/StageChain.jsx'
import './progression/studio/stages.css'
import './board/wires.css'
import { displays } from './mechanism/displays.js'
import './studio/studio.css'
import { T, tr } from 'kernel/words'
import defineCircuit from './game.js'
import './board/circuit.css'

import PartStudioPreview from './studio/PartStudioPreview.jsx'
import PartObjectEditor from './studio/PartObjectEditor.jsx'
import PartEditor from './studio/PartEditor.jsx'
import PartsList from './studio/PartsList.jsx'
import { TrayEditor } from './studio/TrayEditor.jsx'
import { ExprField, IconField } from './studio/PartFields.jsx'
import BoardField from './studio/BoardField.jsx'
import { onPartPage, previewPartFace } from './studio/part-page.js'
import BoardPlay from './BoardPlay.jsx'
import { useCircuitShell } from './shell.jsx'
export function register(kernel) {
  kernel.game('circuit/stages', (game, content) => {
    game.partDefs = content.partDefs
    if (policyFor(content, 'circuit/part').stages) {
      game.partAtStage = partAtStage
      installStageViews(game)
    }
    if (policyFor(content, 'circuit/part').unlocks) {
      game.progressUnlockSources = [...(game.progressUnlockSources ?? []), { kind: 'circuit/part', read: partUnlocks }]
    }
  })
  kernel.editorExtension('circuit/stages', { type: 'circuit/part', stageChain: StageChain })

  kernel.implement('display', 'circuit/screen', displays['circuit/screen'])
  kernel.shell('circuit/parts', useCircuitShell)
  kernel.editor('circuit/part', { type: 'circuit/part', listKey: 'parts', route: { type: 'circuit/part', selector: 'part', file: 'parts', root: 'parts' }, component: PartObjectEditor, page: PartEditor, list: PartsList, preview: PartStudioPreview,
    name: T('元件', {}, 'studio-editor'), groupings: ['tag', 'circuit/tray', 'relation'], relations: [['replaces', '取代', 'Replaces']],
    fields: { expr: ExprField, icon: IconField, board: BoardField }, inspectorDraft: previewPartFace, onPage: onPartPage })
  kernel.editor('circuit/tray', { type: 'circuit/tray', component: TrayEditor, group: { listType: 'circuit/part', name: T('托盘', {}, 'studio-editor'), createLabel: T('新的托盘'), initial: () => ({ values: [] }) } })
  kernel.display('circuit/part-link', { reference: 'part', icon: '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>', action: name => tr("在元件箱里看 {name}", {name}) })
  kernel.play('circuit/board', { component: BoardPlay, preview: BoardPlay, define: defineCircuit })
}

/** Shared play composition and board editor components. */
export { BoardPlay }
export { definedGame } from './circuit-game.js'
export { default as CircuitLevel } from './CircuitLevel.jsx'
export { circuitScreen } from './CircuitScreen.jsx'
export { taskScreen } from './task-screen.jsx'
export { defineGame } from './game-definition.js'
export { circuitSettings } from './settings.js'
export { default as CircuitEditor } from './CircuitLevel.jsx'

/** Component cards, icons, editors and views reused by board adapters. */
export { partsFor } from './board/board-parts.js'
export { iconOf } from './parts/icons.js'
export { default as WeightGrid } from './parts/WeightGrid.jsx'
export { default as PartFace } from './parts/PartFace.jsx'
export { default as Glyph } from './board/Glyph.jsx'
export { packedView } from './board/board-parts.js'
