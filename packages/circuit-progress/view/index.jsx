import { installStageViews } from './game-stages.js'
import './studio/stages.css'
import { partAtStage } from '../core/studio-stages.js'
import { partUnlocks } from '../core/unlocks.js'
import StageChain from './studio/StageChain.jsx'

export function register(kernel) {
  kernel.game('circuit-progress/stages', (game) => {
    game.partAtStage = partAtStage
    installStageViews(game)
  })
  kernel.unlocks('circuit-progress/parts', partUnlocks)
  kernel.editorExtension('circuit-progress/part', { type: 'circuit/part', stageChain: StageChain })
}
