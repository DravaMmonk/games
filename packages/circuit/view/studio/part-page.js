import { creationChoices, blank, getAt, showPath, shapeAt } from 'kernel/view'
import { setAt } from 'kernel'
import { partFileSchema } from '../../core/parts/schema.js'
import { partAtStage, stagePath } from '../../core/progression/studio-stages.js'
import { DEFAULT_VIEWS } from '../parts/PartFace.jsx'

/** The content with a face's blocks still pending (`path`: …/views/<face>, in the part or one of its stages) shown. */
export function previewPartFace(content, path, pending) {
  const at = path.lastIndexOf('views')
  if (at < 2) return content
  const owner = getAt(content?.partDefs, path.slice(0, at))
  const face = path[at + 1]
  if (!owner || (owner.views?.[face]?.length ?? -1) >= pending.length) return content
  return { ...content, partDefs: setAt(content.partDefs, path.slice(0, at + 1), { ...owner.views, [face]: pending }) }
}

/**
 * A field picked or a block added on the part page. On a stage's card (`m.stage`) it is the stage's: the path is in
 * the stage, and what the stage does not write yet starts from what it has there (the part and the stages before it),
 * since a stage's lists replace the ones it inherits.
 */
export function onPartPage(m, { content, ops, shown, edit, pickField, vocabulary, playOrder }) {
  const raw = getAt(content?.partDefs, ['parts', m.part])
  if (!raw) return undefined
  const within = m.stage ? stagePath(m.part, raw, m.stage) : []
  if (!within) return undefined
  const base = ['parts', m.part, ...within]
  const own = getAt(content.partDefs, base)
  const def = m.stage ? partAtStage(m.part, raw, m.stage) : raw
  const [key, face] = m.path
  if (key === 'views' && face) {
    const path = [...base, 'views', face]
    // A face still waiting in the changeset: written alone, or with the views it was the first of.
    const pending = [...ops].reverse().find((op) => op.op === 'parts.set' && !shown?.ops.includes(op) && [showPath(path), showPath([...base, 'views'])].includes(showPath(op.path)))
    const existing = (pending && (showPath(pending.path) === showPath(path) ? pending.value : pending.value?.[face])) ?? own.views?.[face]
    const list = existing ?? def.views?.[face] ?? DEFAULT_VIEWS[face]
    // The first face a stage (or the part) writes brings its views with it: an edit only fills containers already there.
    const write = (value) => edit(own.views || pending ? { op: 'parts.set', path, value } : { op: 'parts.set', path: [...base, 'views'], value: { [face]: value } })
    if (!existing) write(list)
    return pickField(m.type === 'pick' ? [...base, ...m.path] : path, m.type === 'pick', list)
  }
  if (m.type === 'pick' || (m.part !== undefined && key === 'settings' && m.path.length === 1)) {
    return pickField([...base, ...m.path], true)
  }
  // An item added to a list of the part: blank as its schema has it (a rule and a check, one that already reads).
  const path = [...base, ...m.path]
  const schema = shapeAt(partFileSchema(vocabulary), content.partDefs, path, { vocabulary: vocabulary })
  if (schema?.type !== 'list') return undefined
  if (creationChoices(schema.of, { vocabulary: vocabulary }).length > 1) return pickField(path)
  const list = getAt(content.partDefs, path) ?? getAt(def, m.path) ?? []
  const blankOf = { rules: { set: {} }, checks: { holds: '1', say: { en: '' } } }
  edit({ op: 'parts.set', path, value: [...list, (m.path.length === 1 && blankOf[key]) || blank(schema.of, { vocabulary: vocabulary, levels: playOrder })] })
  return pickField([...path, list.length], true)
}
