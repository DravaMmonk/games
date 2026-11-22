// The Studio's advisory tool (games/design/README.md 6.7): the advisories (../engine/advisories.js) on a game or a
// package as it is written on disk, with what a human has already decided. It is offered by the Studio bridge alone,
// in a lane of its own, and is deliberately absent from the operation tools (../engine/ops/tools.js): the MCP server,
// the CLI, checks and releases never see an advisory, so no agent writes content toward one.
//
//   advisories { game | package, settle?: [id], reopen?: [id] } → { lines: [{ advice, id, rule, level, levels, text, problem, settled }] }
//
// Decisions are kept on this machine only: site/node_modules/.cache/games-studio/advisories.json ({ id: time }).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { advisories } from '../engine/advisories.js'
import { contentRoot, readContent, readPackage, runtimeOf } from '../engine/resolver.js'

const STORE = resolve(import.meta.dirname, '../../../site/node_modules/.cache/games-studio/advisories.json')

/** The decisions kept in `file`: read() → { id: time }, and update(settle, reopen) → the same after the change. */
export function settledStore(file = STORE) {
  const read = () => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {})
  return {
    read,
    update(settle = [], reopen = []) {
      const kept = read()
      for (const id of settle) kept[id] = Date.now()
      for (const id of reopen) delete kept[id]
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, JSON.stringify(kept))
      return kept
    },
  }
}

/** An advisory as a worklist line that names its level and field (../studio/worklist.js). */
export const adviceLine = ({ id, rule, level, path, says }, settled) => ({
  advice: true, id, rule, level, levels: [level], text: `${level}${path && ` ${path}`}: ${rule} ${says}`, settled: id in settled,
  problem: { rule, object: { kind: 'level', name: level }, path },
})

export const advisoryTools = {
  advisories: {
    about: 'Studio only: house-convention advisories for human review.',
    params: { game: 'string?', package: 'string?', settle: 'array?', reopen: 'array?' },
    async run({ game, package: id, settle, reopen }, store = settledStore()) {
      const root = contentRoot()
      const content = id ? readPackage(id, root) : readContent(game, root)
      const found = await advisories(content, await runtimeOf(content))
      const settled = settle || reopen ? store.update(settle, reopen) : store.read()
      return { lines: found.map(advisory => adviceLine(advisory, settled)) }
    },
  },
}
