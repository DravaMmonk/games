import { eraLevels } from '../course.js'
import { contentSchemas } from '../engine/content.js'
import { courseDependencies } from '../engine/course-dependencies.js'
import { expandRelations, readTag, referenceResolver } from '../engine/objects.js'
import { chapterName, chaptersOrder, chapterSet } from './course-edit.js'
import { newRowConflicts, prerequisitePath } from './layout-edit.js'
import { edgesOf, relationOverrideOps } from './override-edit.js'

const pairKey = ({ from, to }) => JSON.stringify([from, to])

export function courseLinks(content, vocabulary) {
  const source = { ...content }
  contentSchemas.set(source, vocabulary)
  return courseDependencies(source).links
}

/** Remove the selected course levels and everything scheduled after them that needs them. */
export function courseRemoval(chapters, links, selected, removedChapter = null) {
  const removed = new Set(selected)
  const downstream = new Map()
  for (const { from, to, fromGame } of links) {
    if (fromGame) continue
    if (!downstream.has(from)) downstream.set(from, [])
    downstream.get(from).push(to)
  }
  // Set iteration visits dependents added during the traversal.
  for (const id of removed) for (const dependent of downstream.get(id) ?? []) removed.add(dependent)

  const affected = chapters.flatMap(chapter => {
    const ids = chapter.levels.filter(id => removed.has(id))
    return ids.length ? [{ chapter, ids }] : []
  })
  const ops = affected.flatMap(({ chapter }) => {
    if (chapter.id === removedChapter) return []
    const rows = chapter.rows?.flatMap(row => {
      if (!row.some(id => removed.has(id))) return [row]
      const next = row.map(id => removed.has(id) ? null : id)
      return next.some(id => id !== null) ? [next] : []
    })
    return [
      chapterSet(chapter.id, ['levels'], chapter.levels.filter(id => !removed.has(id))),
      ...(rows ? [chapterSet(chapter.id, ['rows'], rows)] : []),
    ]
  })
  if (removedChapter) {
    ops.push(chaptersOrder(chapters.filter(chapter => chapter.id !== removedChapter)))
    ops.push({ op: 'chapter.remove', chapter: chapterName(removedChapter) })
  }
  return { affected, ops }
}

/** Remove one scheduled level and its exact course links while keeping its successors scheduled. */
export function singleLevelRemoval(content, vocabulary, chapters, links, id) {
  const incident = links.filter(({ from, to, fromGame }) => !fromGame && (from === id || to === id))
  const { relations, ops, removed } = removePrerequisites(content, incident)
  const outgoing = incident.filter(({ from }) => from === id)
  const authoredAfter = outgoing.some(({ source }) => source === 'course')
    ? new Set(expandedPrerequisites(content, vocabulary, relations).filter(edge => !edge.game).map(pairKey)) : new Set()
  const blocked = [...new Map(outgoing.filter(edge => edge.source !== 'course' || authoredAfter.has(pairKey(edge)))
    .map(edge => [pairKey(edge), edge])).values()]
  const single = courseRemoval(chapters, [], [id])
  return { ...single, disconnected: removed, blocked, ops: blocked.length ? [] : [...ops, ...single.ops] }
}

function orderConflicts(links, chapters) {
  const positions = new Map(chapters.flatMap(chapter => chapter.levels).map((id, index) => [id, index]))
  return links.filter(({ from, to, fromGame }) => !fromGame
    && positions.has(from) && positions.has(to) && positions.get(from) >= positions.get(to))
}

/** Remove exact pairs without changing any tag declarations or cross-game edges. */
function removePrerequisites(content, links) {
  const wanted = new Set(links.map(pairKey))
  const relations = Object.fromEntries(Object.entries(content.relations).filter(([, relation]) => relation.kind === 'requires'))
  const relationSource = { ...content, registries: { ...content.registries, relation: content.relations } }
  const layer = `@${content.id}`
  const ops = []
  const removed = new Map()
  for (const [name, relation] of Object.entries(relations)) {
    const original = edgesOf(relation)
    const edges = original.filter(edge => {
      const key = pairKey(edge)
      if (edge.game || !wanted.has(key)) return true
      removed.set(key, edge)
      return false
    })
    if (edges.length === original.length) continue
    relations[name] = { ...relation, edges }
    ops.push(...relationOverrideOps(relationSource, layer, name, edges))
  }

  return { relations, ops, removed: [...removed.values()] }
}

function expandedPrerequisites(content, vocabulary, relations) {
  const scheduled = new Set(content.eras.flatMap(eraLevels))
  const expand = referenceResolver(content.registries, [], vocabulary)
  const optional = new Set(readTag(content.registries, 'level', vocabulary?.levelMarks?.optional))
  return expandRelations(relations, expand, scheduled, [], optional).requires
}

/** Plan a route move by cutting authored edges on each newly reversed prerequisite path. */
export function routeMove(content, vocabulary, before, after) {
  let edges = content.relationEdges.requires.filter(edge => !edge.game)
  const authored = new Set(Object.values(content.relations).filter(relation => relation.kind === 'requires')
    .flatMap(edgesOf).filter(edge => !edge.game).map(pairKey))
  const removed = []
  let ops = []
  while (true) {
    const [conflict] = newRowConflicts(before, after, edges)
    if (!conflict) return { removed, blocked: [], ops }
    const path = prerequisitePath(edges, conflict.from, conflict.to)
    // Work backwards from the dependent level, preferring a direct conflict when present.
    const cut = path.find(edge => {
      if (!authored.has(pairKey(edge))) return false
      const change = removePrerequisites(content, [...removed, edge])
      const remaining = expandedPrerequisites(content, vocabulary, change.relations).filter(link => !link.game)
      if (remaining.some(link => pairKey(link) === pairKey(edge))) return false
      authored.delete(pairKey(edge))
      edges = remaining
      ops = change.ops
      return true
    })
    if (!cut) return { removed: [], blocked: [conflict], ops: [] }
    removed.push(cut)
  }
}

/** Find the particular authored prerequisites that prevent a move, and coalesce removals by relation file. */
export function courseReorder(content, vocabulary, links, before, after) {
  const previous = new Set(orderConflicts(links, before).map(pairKey))
  const conflicts = orderConflicts(links, after).filter(link => !previous.has(pairKey(link)))
  if (!conflicts.length) return { removed: [], blocked: [], ops: [] }
  const wanted = new Map(conflicts.map(edge => [pairKey(edge), edge]))
  const { relations, ops } = removePrerequisites(content, conflicts)

  // A tag or a task may independently require the same pair.
  const played = new Map(content.eras.map(era => [era.id, era]))
  const requires = expandedPrerequisites(content, vocabulary, relations)
  const eras = after.map(({ id, levels }) => {
    const era = played.get(id)
    const known = new Map(era.levels.map(level => [level.id, level]))
    const members = new Set(levels)
    return { ...era, levels: levels.map(level => known.get(level) ?? { id: level }),
      links: requires.filter(({ to }) => members.has(to)).map(({ game, ...edge }) => ({ ...edge, ...(game && { fromGame: game }) })) }
  })
  const unresolved = orderConflicts(courseLinks({ ...content, eras }, vocabulary), after).filter(edge => !previous.has(pairKey(edge)))
  const blocked = [...new Map(unresolved.map(edge => [pairKey(edge), edge])).values()]
  return { removed: [...wanted.values()], blocked, ops }
}
