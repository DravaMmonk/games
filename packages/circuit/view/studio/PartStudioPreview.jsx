import PartView from './PartView.jsx'
import { stagePath, withinStage } from '../../core/progression/studio-stages.js'

// The part page's preview in the studio's frame: the part, or one of its stages, edited where it is drawn. A field
// picked or a block added on a stage's card is that stage's (the message names it; part-page.js writes it there), and
// the field the studio has open is marked on the card when it is in the stage shown.
export default function PartStudioPreview({ game, type, stage, editing, say }) {
  const which = { part: type, ...(stage && { stage }) }
  const at = stage ? stagePath(type, game.partDefs?.parts?.[type], stage) : null
  const marked = typeof editing.picked === 'string' && withinStage(JSON.parse(editing.picked), at)
  const picked = marked ? JSON.stringify(marked) : null
  const edit = editing.on && (!stage || at) ? { picked, pick: path => say({ type: 'pick', ...which, path }), add: path => say({ type: 'add', ...which, path }) } : null
  const label = task => {
    const level = game.levels.find(level => level.id === task || level.tasks?.some(item => (item.key ?? item.id) === task))
    if (!level) return task
    const index = level.tasks?.findIndex(item => (item.key ?? item.id) === task) ?? -1
    return `${game.levelLabel(level)}${level.tasks?.length > 1 && index >= 0 ? ` · ${index + 1}` : ''}`
  }
  return <PartView game={game} type={type} stage={stage} edit={edit} onTask={task => say({ type: 'task-go', task })} label={label} />
}
