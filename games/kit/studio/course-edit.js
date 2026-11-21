// Pure chapter edits of the arrange workspace (games/design/engine-content.md): a chapter is a game-layer object
// (`games/<game>/chapters/<name>.json`, full name `@<game>/<name>`) with its `levels` list and route map `rows`; the
// game's `chapters` list orders them. The chapters' order, a new chapter, and levels imported into one with what they need.
import { importLevelOrder } from '../engine/objects.js'
import { getAt } from '../engine/ops/edit.js'
import { objectOp, objectValue } from './object-file.js'
/** The course with chapter `e` moved by `by` places (-1 earlier, 1 later). */
export function moveChapter(eras, e, by) {
  const to = e + by
  if (to < 0 || to >= eras.length) return eras
  const next = [...eras]
  const [era] = next.splice(e, 1)
  next.splice(to, 0, era)
  return next
}

/** A new chapter shaped like `like` (its own fields, no levels, no links, no map), with an id no chapter has. */
export function blankChapter(eras, like, blankText) {
  const ids = eras.map((era) => era.id)
  const numbered = ids.every((id) => typeof id === 'number')
  let id = numbered ? Math.max(0, ...ids) + 1 : `chapter-${eras.length + 1}`
  for (let k = eras.length + 2; ids.includes(id); k++) id = numbered ? id + 1 : `chapter-${k}`
  const { levels: _, rows: __, id: ___, ...fields } = like
  return { id, ...blankText(fields), levels: [] }
}

/**
 * A chapter's levels with `picked` imported (a level, or `#tag`: its levels) by the kernel's import order: with the
 * package prerequisites they need, ordered by them and the package's display order; those a chapter already places
 * (`placed`) stay where they are.
 */
export function importLevels(content, levels, picked, placed = new Set()) {
  const have = new Set([...levels, ...placed])
  return [...levels, ...importLevelOrder(content, [picked]).filter((id) => !have.has(id))]
}

/** Every prerequisite a course order breaks, as the check says it: `chapters` in course order, each with its `levels`
 * (full names, or `{ id }` as a played chapter has them) and its `id`. A prerequisite comes before the level that
 * needs it in the same chapter, or in an earlier chapter. */
function courseOrderProblems(content, chapters) {
  const at = new Map(chapters.flatMap((chapter, c) => (chapter.levels ?? []).map((level, k) => [typeof level === 'string' ? level : level.id, [c, k]])))
  const out = []
  for (const edge of content?.relationEdges?.requires ?? []) {
    if (edge.game || !at.has(edge.from) || !at.has(edge.to)) continue
    const [[from, i], [to, j]] = [at.get(edge.from), at.get(edge.to)]
    if (from === to && i >= j) out.push(`${edge.from} must precede ${edge.to} in chapter order`)
    if (from > to) out.push(`${edge.from} must precede ${edge.to}: it is in the later chapter ${chapters[from].id}`)
  }
  return out
}

/** The first prerequisite the course order `chapters` breaks that `before` (the order it replaces) did not, or null. */
export function courseOrderRefusal(content, chapters, before = []) {
  const had = new Set(courseOrderProblems(content, before))
  return courseOrderProblems(content, chapters).find((problem) => !had.has(problem)) ?? null
}

/** The levels of earlier chapters that `to` (in chapter `e` of the played course) could still take as prerequisites:
 * not one already. */
export function earlierPrerequisites(content, e, to) {
  const have = new Set((content?.relationEdges?.requires ?? []).filter((edge) => !edge.game && edge.to === to).map(({ from }) => from))
  return (content?.eras ?? []).slice(0, e).flatMap((era, k) => era.levels.filter(({ id }) => !have.has(id)).map(({ id }) => ({ id, chapter: k })))
}

/** A chapter's short name, the one its operations take: `paper` for `@qed/paper`. */
export const chapterName = (full) => String(full).slice(String(full).indexOf('/') + 1)

/**
 * The operation that gives chapter `full` (of game layer `layer`) the title `text` in language `lang`, as the right
 * column's field writes it: where the chapter keeps its title (`title`, or `chapter.title` where it has a `chapter`
 * part), a text with other languages and its message key kept, a plain string kept plain.
 */
export function chapterRetitle(content, layer, full, text, lang) {
  const value = objectValue(content, 'chapter', full)
  if (!value) return null
  const path = value.title === undefined && value.chapter ? ['chapter', 'title'] : ['title']
  const old = getAt(value, path)
  return objectOp({ kind: 'chapter', full, namespace: layer, own: true, value }, path, { set: text, ...(typeof old !== 'string' && { lang }) }, 'text')
}

/** The operation that sets a field of chapter `full`. */
export const chapterSet = (full, path, value) => ({ op: 'chapter.set', chapter: chapterName(full), path, value })

/** Remove the authored layout to use the course's automatic rows. */
export const chapterUnsetRows = (full) => ({ op: 'chapter.unset', chapter: chapterName(full), path: ['rows'] })

/** The game's chapter order written: their full names. */
export const chaptersOrder = (chapters) => ({ op: 'game.set', path: ['chapters'], value: chapters.map((chapter) => chapter.id) })

/** A free short name for a new chapter of game `game`: `chapter-<n>`. */
export function newChapterName(chapters) {
  const taken = new Set(chapters.map((chapter) => chapterName(chapter.id)))
  let k = chapters.length + 1
  while (taken.has(`chapter-${k}`)) k += 1
  return `chapter-${k}`
}
