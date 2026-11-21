import { contentSchemas } from '../engine/content.js'
import { courseLayout } from '../engine/course-dependencies.js'

/** Resolve the displayed prerequisites with the player's own course rules, using the draft's authored edges. */
export function mapPreviewGame(game, content, edges) {
  const incoming = new Map()
  for (const { game: fromGame, ...edge } of edges) {
    if (!incoming.has(edge.to)) incoming.set(edge.to, [])
    incoming.get(edge.to).push({ ...edge, ...(fromGame && { fromGame }) })
  }
  const eras = content.eras.map(era => ({ ...era, links: era.levels.flatMap(({ id }) => incoming.get(id) ?? []) }))
  const draft = { ...content, eras }
  contentSchemas.set(draft, game.contentVocabulary)
  const { requires } = courseLayout(draft)
  return { ...game, levels: game.levels.map(level => ({ ...level, requires: requires.get(level.id) ?? [] })) }
}
