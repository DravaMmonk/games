/* global process */
// npm run check [-- <game or package>…] checks that content and its plugins can load.
// --package and --game disambiguate shared names. GAMES_ROOT selects an isolated content project.
// One run reads the workspace once: every game's resolution and its siblings' content are shared (read-cache.js).
// --authoring also checks authored examples and course rules. --mutants adds mutation reports.
// --fresh bypasses the authoring cache.
import { resolve } from 'node:path'
import { sourceJsonProblems } from './source-json.js'
import { firstText } from './i18n.js'
import { checkGame } from './checks.js'
import { closeGames, loadModule } from './games.mjs'
import { loadPlugins } from './plugin-node.js'
import { workspaceCheckCache, contentRoot, runtimeOf, readContent, readPackage, contentTargets, packageDirectory, gameDirectory } from './resolver.js'
import { deepFreeze } from './content.js'
import { openGame, openPackage } from './ops/workspace.js'
import { driftOf } from './ops/log.js'
import { checkCache } from './check-cache.js'
import { packageExportWarnings } from './plugin-boundaries.js'
import { packageWords } from './manifests.js'
import { withReadCache } from './read-cache.js'

const root = contentRoot()
let problems = 0
const mutants = process.argv.includes('--mutants')
const authoring = mutants || process.argv.includes('--authoring')
const fresh = process.argv.includes('--fresh')
const asked = process.argv.slice(2).filter((arg) => !['--authoring', '--mutants', '--fresh', '--package', '--game'].includes(arg))
const selection = { package: process.argv.includes('--package'), game: process.argv.includes('--game') }
const targets = contentTargets(asked, root, selection)
const all = !asked.length && !selection.package && !selection.game
const directories = all
  ? ['games', 'packages', 'templates', 'scaffolds', '.agents', 'site', 'tools'].map(dir => resolve(root, dir))
  : targets.map(({ id, kind }) => (kind === 'package' ? packageDirectory : gameDirectory)(id, root))
await withReadCache(root, async () => {
  for (const problem of sourceJsonProblems(root, directories)) {
    console.log(`FAIL ${problem}`)
    problems++
  }
  if (all && authoring) {
    for (const warning of packageExportWarnings(root)) console.warn(`WARN ${warning}`)
  }
  // One game whose domain throws is reported as such; the others are still checked.
  for (const { id, kind } of targets) {
    const packaged = kind === 'package'
    let lines
    let head = id
    try {
      // Read frozen: nothing that checks a game may write into its content.
      const content = deepFreeze((packaged ? readPackage : readContent)(id, root))
      for (const layer of content.resolvedDependencies.layers) {
        if (!layer.missing && !layer.id.startsWith('@')) packageWords(layer)
      }
      head = `${firstText(content.title ?? id)} (${id})`
      const cache = authoring && !packaged && workspaceCheckCache() ? checkCache(id, { fresh }) : null
      const report = await checkGame(content, { domain: await runtimeOf(content), authoring, mutants, cache, root })
      lines = report.lines
      // The platform opens package levels in the same shell as game levels.
      const opensInShell = !packaged || (!authoring && content.levels.length > 0)
      if (opensInShell && !lines.some(line => line.fail)) await loadPlugins(content, root, loadModule, true)
      if (authoring) {
        const ws = (packaged ? openPackage : openGame)(id, root)
        const drift = driftOf(ws, ws.onDisk())
        if (drift.length) lines.push({ text: `OPEN log: changed outside the operation set: ${drift.join(', ')} (npm run op -- ${packaged ? `--package ${id}` : id} adopt --why "…")` })
      }
    } catch (error) {
      lines = [{ fail: true, text: `the check threw: ${error.stack}` }]
    }
    problems += lines.filter((l) => l.fail).length
    console.log(`\n${head}`)
    for (const line of lines) console.log(`  ${line.fail ? 'FAIL ' : ''}${line.text}`)
  }
})

console.log(problems ? `\n${problems} problem(s)` : '\nall games ok')
await closeGames()
process.exit(problems ? 1 : 0)
