import { eraLevels } from '../course.js'
import { mergeFields } from '../engine/collections.js'
import { expandRelations, readTag, referenceResolver, RELATION } from '../engine/objects.js'
import { beforeLayer, overrideEvent } from './override-edit.js'

const writes = new WeakMap()
const isRelation = (op) => op.kind === 'relation' && (op.op === 'override.put' || op.op === 'override.remove')
export const isMapRowsEdit = (op) => (op.op === 'chapter.set' || op.op === 'chapter.unset') && op.path?.[0] === 'rows'
const keepsGraph = (op) => op.op === 'text.override' || isMapRowsEdit(op)
const lastWrite = (ops, layer, name) => ops.findLast((op) => isRelation(op) && op.layer === layer && op.name === name)

/** Keep the view of each game-layer relation immediately before and after a wire edit. */
export function noteMapWires(content, ops, changes) {
  for (const op of changes) {
    const { layer, name } = op
    const base = beforeLayer(content, layer, 'relation', name)
    const before = { relation: content.relations[name], event: overrideEvent(content, layer, 'relation', name) }
    const relation = op.op === 'override.remove' ? base : mergeFields(base, op.data, RELATION)
    const event = op.op === 'override.remove' ? null : { layer, kind: 'relation', name, before: base, after: relation }
    writes.set(op, { before, after: { relation, event }, previous: lastWrite(ops, layer, name) })
  }
}

/** Project pending wire edits onto the last server preview. Other graph edits need a new preview. */
export function mapWiringContent(content, ops, previewOps, optionalTag) {
  let prefix = 0
  while (prefix < Math.min(ops.length, previewOps.length) && ops[prefix] === previewOps[prefix]) prefix++
  const changed = [...previewOps.slice(prefix), ...ops.slice(prefix)].filter((op) => !keepsGraph(op))
  if (!changed.length) return content
  if (changed.some((op) => !writes.has(op))) return null

  const layer = `@${content.id}`
  const relations = { ...content.relations }
  const overrideHistory = [...content.overrideHistory]
  for (const name of new Set(changed.map((op) => op.name))) {
    const latest = lastWrite(ops, layer, name)
    if (latest === lastWrite(previewOps, layer, name)) continue
    const removed = previewOps.slice(prefix).find((op) => changed.includes(op) && op.name === name)
    const old = writes.get(removed)
    const state = writes.get(latest)?.after ?? (old?.previous === latest ? old?.before : null)
    if (!state) return null
    relations[name] = state.relation
    const index = overrideHistory.findIndex((event) => isRelationEvent(event, layer, name))
    if (index >= 0) overrideHistory.splice(index, 1)
    if (state.event) overrideHistory.push(state.event)
  }

  const expand = referenceResolver(content.registries)
  const scheduled = new Set(content.eras.flatMap(eraLevels))
  const optional = new Set(readTag(content.registries, 'level', optionalTag))
  const { requires } = expandRelations(Object.fromEntries(Object.entries(relations).filter(([, relation]) => relation.kind === 'requires')), expand, scheduled, [], optional)
  return { ...content, relations, overrideHistory, relationEdges: { ...content.relationEdges, requires } }
}

const isRelationEvent = (event, layer, name) => event.kind === 'relation' && event.layer === layer && event.name === name
