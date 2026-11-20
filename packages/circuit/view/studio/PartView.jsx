import { L, SettingsContext } from "kernel/view"
import { T, tr } from 'kernel/words'
import { useEffect, useMemo, useState } from 'react'
import { ListTree, Monitor, PanelRight, Plus, Smartphone } from 'lucide-react'

import { picker } from '../parts/PartSheet.jsx'
import { SCENES, editorFor } from '../parts/previews.js'
import { stagedDefinition } from '../../core/part-definition.js'
import { withDefinitions } from '../defined.js'

// A part on the studio's part page (games/design/README.md 6.7): the scenes its editor draws (../shell/parts/previews.js),
// several side by side over its sheet, a single detail beside it; each scene a pane with its drawing face
// (views.<scene>), picked by a click and added to with its +. Every field drawn carries its path in the part
// (data-pf); in edit mode a click picks it. The scenes share what the player moves on them (`state`), afresh for each
// version of the part.
//
//   game  the game's description, game.partDefs parts.json as the studio edits it      type  the part shown
//   stage  one of its stages shown instead: its file there, and its card as the course has it at that stage (what a
//          player who has reached it sees: its name, text, faces and settings)
//   edit  { picked (a path in the part), pick(path), add(path) } or null
//   onTask(task)  a task a field names followed (a built part's chain)      label(task)  how the map numbers it

const PANES = { card: [Monitor, T('电脑端面板')], tile: [Smartphone, T('手机端简略视图')], detail: [PanelRight, T('详情（两端共用）')], sheet: [ListTree, T('元件的字段')] }
const at = (path) => JSON.stringify(path)
const SheetIcon = PANES.sheet[0]

function PartPreview({ game, type, stage = null, edit, onTask, label }) {
  const declared = game.partDefs?.parts?.[type]
  const raw = declared && stage ? game.partAtStage?.(type, declared, stage) ?? declared : declared
  const entry = stage ? game.course?.stages?.get(stage) ?? null : null
  const defined = useMemo(() => (entry && game.defined ? withDefinitions(game.defined, (t, base) => (t === type ? stagedDefinition(entry, base) : null)) : game.defined), [game, type, entry])
  const state = useState(undefined)
  const [, setState] = state
  useEffect(() => setState(undefined), [type, raw, setState])
  // A part just added shows once the content holding it comes.
  if (!raw) return null
  const part = { type, ...raw }
  const editor = editorFor(part)
  const scenes = SCENES.map((scene) => [scene, editor.preview(part, { game, defined, scene, edit, state })]).filter(([, shown]) => shown)
  const sheet = <editor.Sheet part={part} game={game} defined={defined} edit={edit} state={state} onTask={onTask} label={label} />
  if (scenes.length === 1 && scenes[0][0] === 'detail') {
    return (
      <div className="pp-built" onClickCapture={picker(edit)}>
        <div className="pp-built-board">{scenes[0][1]}</div>
        {sheet}
      </div>
    )
  }
  const pane = ([scene, shown]) => {
    const [Icon, title] = PANES[scene]
    return (
      <section key={scene} className={`pp-pane is-${scene} ${edit?.picked === at(['views', scene]) ? 'is-picked' : ''}`} data-pf={at(['views', scene])}>
        <header title={L(title)}><Icon size={13} aria-label={L(title)} role="img" />{edit && <button type="button" className="pp-add" title={tr('加一个块')} onClick={(e) => { e.stopPropagation(); edit.add(['views', scene]) }}><Plus size={12} /></button>}</header>
        {shown}
      </section>
    )
  }
  return (
    <div className={`pp ${edit ? 'is-editing' : ''}`} onClickCapture={picker(edit)}>
      <div className="pp-faces">
        {scenes.map(pane)}
        <section className="pp-pane is-sheet">
          <header title={L(PANES.sheet[1])}><SheetIcon size={13} aria-label={L(PANES.sheet[1])} role="img" /></header>
          {sheet}
        </section>
      </div>
    </div>
  )
}

export default function PartView(props) {
  return <SettingsContext.Provider value={props.game}><PartPreview {...props} /></SettingsContext.Provider>
}
