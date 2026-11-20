import { findTask } from 'kernel'
import { stageName } from 'progress'

// Where a part comes into the course, as its levels write it (for the studio's part page; games/design/engine-studio.md):
// every level or task whose progress fields name the part or one of its stages, and the level or task a stage waits for.
// Read from the content alone, so it works in a package as in a game; course order is the game's (flow.js).

/** The progress fields a level or task names parts in, in the order the page shows their uses. */
export const USE_KINDS = ['adds', 'gives', 'awards', 'opens', 'local', 'withholds', 'requiresObjects']

/**
 * The uses of part `part` in `content`: [{ kind (a field of USE_KINDS, or 'after' for a stage's own wait), level, task
 * (index, or undefined for the level itself), stage (its index from 1, or 0 for the part), path (in the level's file) }],
 * in level order.
 */
export function partUses(content, part) {
  const raw = content?.partDefs?.parts?.[part]
  if (!raw) return []
  const stages = Array.isArray(raw.stages) ? raw.stages : []
  const index = new Map([[part, 0], ...stages.map((stage, k) => [stageName(part, stage.id), k + 1])])
  const uses = []
  for (const level of content.levels ?? []) {
    const tasks = Array.isArray(level.tasks) ? level.tasks : []
    for (const [task, object] of [[undefined, level], ...tasks.map((value, k) => [k, value])]) {
      for (const kind of USE_KINDS) {
        for (const [k, id] of (Array.isArray(object?.[kind]) ? object[kind] : []).entries()) {
          const stage = index.get(String(id).split(/[.=]/)[0])
          if (stage !== undefined) uses.push({ kind, level: level.id, task, stage, path: [...(task === undefined ? [] : ['tasks', task]), kind, k] })
        }
      }
    }
  }
  const order = new Map((content.levels ?? []).map((level, k) => [level.id, k]))
  for (const [k, stage] of stages.entries()) {
    const found = stage.afterTask ? findTask(content.levels ?? [], stage.afterTask) : null
    const level = found?.level ?? stage.afterLevel
    if (level && order.has(level)) uses.push({ kind: 'after', level, task: found ? found.at : undefined, stage: k + 1, path: found ? ['tasks', found.at] : [] })
  }
  return uses.sort((a, b) => order.get(a.level) - order.get(b.level) || (a.task ?? -1) - (b.task ?? -1))
}
