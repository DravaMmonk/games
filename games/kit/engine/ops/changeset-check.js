import { createHash } from 'node:crypto'
import { prerequisiteGraph } from '../../course.js'
import { checkContentOnly, checkGame } from '../checks.js'
import { contentSchemas } from '../content.js'
import { COURSE_FIELDS } from '../course-schema.js'
import { packageLevelOrder } from '../package-play.js'
import { memoResolution, withReadCache } from '../read-cache.js'
import { runtimeOf } from '../resolver.js'
import { validate } from '../schema.js'
import { courseProblems } from '../vocabulary.js'
import { parsePath } from './edit.js'

/** These fields have no effect on task runtime or the project's prerequisite graph. */
function localCheck(ws, content, ops) {
  if (!ops.length) return null
  if (ops.every(op => op.op === 'ui.set')) {
    // Applying a UI translation already validates its key, language and value.
    return { lines: [], order: packageLevelOrder(content) }
  }
  if (!ws.layer.startsWith('@') || !ops.every(op =>
    (op.op === 'chapter.set' || op.op === 'chapter.unset') && parsePath(op.path)[0] === 'rows')) return null

  const chapters = new Set(ops.map(({ chapter }) => chapter.startsWith(ws.layer + '/') ? chapter : `${ws.layer}/${chapter}`))
  const order = content.levels.map(level => level.id)
  const levels = new Set(order)
  const vocabulary = contentSchemas.get(content)
  const problems = [...chapters].flatMap(id => {
    const rows = content.registries.chapter?.[id]?.rows
    if (rows === undefined) return []
    return validate(COURSE_FIELDS.rows, rows, { vocabulary, levels })
      .map(problem => ({ at: `chapter/${id}.json.rows${problem.at === '(root)' ? '' : problem.at}`, says: problem.says }))
  })
  const edges = content.relationEdges.requires.filter(edge => !edge.game)
  problems.push(...courseProblems(content.eras ?? [], prerequisiteGraph(edges), chapters))
  return { order, lines: problems.map(({ at, says }) => ({ fail: true, text: `content: ${at}: ${says}` })) }
}

/** Check a draft and reuse its report only while both the resolved content and project inputs match. */
export async function checkChangeset(ws, content, ops, { check, changesOnly, courseAudit, given }) {
  if (changesOnly && !courseAudit) {
    const local = localCheck(ws, content, ops)
    if (local) return { ...local, checkedChanges: true }
  }

  const run = async () => {
    const domain = given ? { ...given, vocabulary: ws.schemas } : await runtimeOf(content, ws.root)
    const options = { domain, root: ws.root, courseAudit }
    return check ? checkGame(content, options) : checkContentOnly(content, options)
  }
  if (!changesOnly || !check || given) return run()

  // Limit retained reports to one per target in this input generation. Apply still replays and guards the write.
  const key = createHash('sha256').update(JSON.stringify(content)).digest('hex')
  return withReadCache(ws.root, async () => {
    const target = JSON.stringify(['changeset-check', ws.id, ws.layer, ws.scope, courseAudit])
    const entry = memoResolution(target, () => ({}), { shared: true })
    if (entry.key === key) return entry.result
    const report = await run()
    Object.assign(entry, { key, result: report })
    return report
  })
}
