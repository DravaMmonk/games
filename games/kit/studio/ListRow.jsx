// One item of a list in the studio's left column (games/design/README.md 6.7), whatever its type: its icon, what it is
// called, anything to say about it, and its id at the right end. Rows that do more (the levels tree: dragging, picking
// several) draw the same parts themselves, in the same classes.
import { tr } from '../shell/i18n.js'

/** `icon` a lucide icon (or `chip`, the icon drawn already); `title` its name (none: the id stands in); `children` badges. */
export default function ListRow({ icon: Icon, chip = null, title, id, tooltip, on = false, className = '', children = null, ...rest }) {
  return (
    <button type="button" className={`parts-row ${on ? 'is-on' : ''} ${className}`} aria-current={on ? 'true' : undefined} title={tooltip ?? (title && id ? `${title} · ${id}` : id ?? title ?? tr('（无名）', '(unnamed)'))} {...rest}>
      <i className="family-chip">{chip ?? (Icon && <Icon size={12} aria-hidden="true" />)}</i>
      <span>{title || id}</span>
      {children}
      {title && id ? <code>{id}</code> : null}
    </button>
  )
}
