import { Undo2, X } from 'lucide-react'
import { useContext } from 'react'
import { L, SettingsContext } from 'kernel/view'
import { tr } from 'kernel/words'


// The phone board's one line of feedback, the same in every game: while a dot is picked, what to tap next (with
// Cancel). Partition prompts use the same banner; otherwise show the last change's note (with Undo).
export default function Notice({ editing, prompt = null }) {
  const { renderProse: Prose } = useContext(SettingsContext)
  const text = (message) => Prose ? <Prose text={L(message)} /> : L(message)
  if (prompt || editing.pickNote) {
    return (
      <div className="pb-banner" role="status">
        <span>{text(prompt?.text ?? editing.pickNote)}</span>
        <button type="button" aria-label={tr('取消')} title={tr('取消')} onClick={prompt?.cancel ?? editing.unpick}><X size={18} aria-hidden="true" /></button>
      </div>
    )
  }
  if (!editing.toast) return null
  return (
    <div className="ph-toast pb-toast" role="status">
      <span>{text(editing.toast)}</span>
      {editing.history.canUndo && <button type="button" aria-label={tr('撤销')} title={tr('撤销')} onClick={editing.history.undo}><Undo2 size={18} aria-hidden="true" /></button>}
    </div>
  )
}
