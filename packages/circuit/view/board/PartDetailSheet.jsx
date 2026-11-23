import { Package } from 'lucide-react'
import { Sheet, openRef, usePlainProse } from 'kernel/view'
import { tr } from 'kernel/words'
import { isPart } from '../../core/board/model.js'

export default function PartDetailSheet({ parts, node, title, onClose, ...props }) {
  const plain = usePlainProse()
  const name = parts.label(node)
  const label = tr('在元件箱里看 {name}', { name: plain(name) })
  const open = () => {
    const type = parts.sourcePart?.(node) ?? node.type
    openRef('part-detail', type, { name, icon: parts.icon?.(node), family: parts.family?.(node) })
    onClose()
  }
  const action = isPart(parts, node) && (
    <button type="button" className="ph-icon cl-part-book" aria-label={label} title={label} onClick={open}>
      <Package size={16} aria-hidden="true" />
    </button>
  )
  return <Sheet {...props} title={title} titleAction={action} onClose={onClose} />
}
