// The author checks of a game kept between runs, level by level (games/PLAN.md B.2): what a domain's checks said of a
// level is said again without running them while nothing they read has changed. Kept on this machine only, never in
// the repository: site/node_modules/.cache/games-check/<game>.json. Authoring reviews read it unless they run
// with `--fresh`.
//
//   checkCache(game, { fresh })  → { memo(content, spec), save() }
//     memo(content, spec)        → memo(id, name, run): run()'s lines, or what it said last time. id names a level or
//                                  one of its tasks; anything else is run every time.
//
// A level's key is a hash of the code and data under games/kit and packages/*/core, excluding tests, the
// game as a whole but its levels, the level itself, and every level it comes after without their words: a level's check
// may run what an earlier one built, never what a later one did. So a level's own wording changes only its own key; its puzzle or
// answers change the keys of every level after it; the kernel's or a domain's code changes them all.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { isText, textKey } from './i18n.js'

const KIT = resolve(import.meta.dirname, '..')
const FOLDER = resolve(KIT, '../../site/node_modules/.cache/games-check')

const digest = (...parts) => {
  const h = createHash('sha1')
  for (const part of parts) h.update(typeof part === 'string' ? part : JSON.stringify(part)).update('\0')
  return h.digest('hex')
}

const sources = (dir) => readdirSync(dir).sort().flatMap((name) => {
  const path = join(dir, name)
  if (name === 'node_modules') return []
  if (statSync(path).isDirectory()) return sources(path)
  return /\.(mjs|js|jsx|json)$/.test(name) && !/\.test\.(mjs|js|jsx)$/.test(name) ? [path] : []
})

const ROOT = resolve(KIT, '../..')
const codeDirs = () => [KIT, ...readdirSync(resolve(ROOT, 'packages')).sort().map((id) => resolve(ROOT, 'packages', id, 'core')).filter(existsSync)]
let kit = null
/** The code's version: a hash of the kernel's and the packages' core code and data. */
export function kitVersion() {
  kit ??= digest(...codeDirs().flatMap(sources).flatMap((path) => [path.slice(ROOT.length), readFileSync(path, 'utf8')]))
  return kit
}

// A text of the content (schema.js S.text): words, which no check of an earlier level's work reads.
const wordless = (value) => JSON.stringify(value, (_k, v) => (
  textKey(v) || (isText(v) && Object.keys(v).every((key) => key === 'en' || key === 'zh')) ? undefined : v
))

/** Each level's key, by level id, and the level each task id is in. */
export function levelKeys(content, course) {
  const { levels, ...rest } = content
  const whole = digest(kitVersion(), rest)
  const inputs = levels.map(level => ({ level, known: course?.index?.has(level.id), signature: `${level.id}:${wordless(level)}` }))
  const keys = new Map(inputs.map(({ level, known }) => {
    const before = inputs.filter(other => other.level.id !== level.id
      && (!known || !other.known || course.before(other.level.id, level.id)))
    return [level.id, digest(whole, level, ...before.map(other => other.signature))]
  }))
  const home = new Map(levels.flatMap((level) => [[level.id, level.id], ...(level.tasks ?? []).map((task) => [task.id, level.id])]))
  return { keys, home }
}

/** A game's kept checks: memo hands a run's lines back when the level they are about has not changed. */
export function checkCache(game, { fresh = false, directory = FOLDER } = {}) {
  const file = resolve(directory, `${game}.json`)
  let kept = {}
  if (!fresh && existsSync(file)) {
    try {
      const saved = JSON.parse(readFileSync(file, 'utf8'))
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) kept = saved
    } catch {
      kept = {}
    }
  }
  const used = {}
  return {
    memo(content, spec) {
      const { keys, home } = levelKeys(content, spec.course)
      return (id, name, run) => {
        const level = home.get(id) ?? home.get(String(id).split('/')[0])
        if (!level) return run()
        const key = digest(keys.get(level), id, name)
        if (!(key in kept)) kept[key] = run()
        used[key] = kept[key]
        return used[key]
      }
    },
    save() {
      mkdirSync(directory, { recursive: true })
      writeFileSync(file, JSON.stringify(used))
    },
  }
}

/** Run every time: what a check gets when no cache is asked for. */
export const noMemo = (_id, _name, run) => run()
