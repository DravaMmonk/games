import { definitionOfKind } from '../engine/plugin-kinds.js'
// The middle for an object of a type with no editor of its own (games/design/engine-object-types.md): a type a package declares in
// kinds/ (until its package registers an editor for it) or a content kind of the kernel's. Its fields as rows — a click
// picks the field for the right column, where it is edited — and its place among the other objects.
import { L, tr } from '../shell/i18n.js'
import { formOf } from './form.js'
import Rows from './Rows.jsx'
import ObjectLinks from './ObjectLinks.jsx'
import { objectSchema, objectValue } from './object-file.js'
import { shownName } from './objects-edit.js'

export default function ObjectSummary({ kind, content, namespace, vocabulary, full, onPick, onOpen }) {
  const value = objectValue(content, kind, full)
  if (!value) return <p className="arrange-empty">{tr("这个对象已经不在了。")}</p>
  const declared = definitionOfKind(content.objectKinds, kind)
  const schema = objectSchema(kind, { declared })
  return (
    <article className="arrange">
      <h2>{L(value.title ?? value.name) || shownName(namespace, full)} <code>{kind}</code></h2>
      <p className="arrange-note">{tr("这个类型没有专门的编辑器：点一行，在右栏编辑。")}</p>
      {schema && <Rows form={formOf(schema, value, { vocabulary })} onPick={onPick} />}
      <ObjectLinks content={content} kind={kind} full={full} namespace={namespace} onOpen={onOpen} />
    </article>
  )
}
