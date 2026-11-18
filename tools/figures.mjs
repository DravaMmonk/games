import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const builds = [
  ['games/boxy/build.mjs', 'packages/state-graph/view/boxy.js'],
  ['packages/qed/scripts/build.mjs', 'packages/qed/view/detach.js'],
  ['games/press/build.mjs', 'games/press/press.js'],
]
const check = process.argv.includes('--check')
const temp = check ? mkdtempSync(join(tmpdir(), 'games-figures-')) : null

try {
  for (const [script, output] of builds) {
    const fresh = check ? join(temp, basename(output)) : join(root, output)
    execFileSync(process.execPath, [script, `--output=${fresh}`], { cwd: root, stdio: 'inherit' })
    if (check && !readFileSync(fresh).equals(readFileSync(join(root, output)))) {
      console.error(`${output} differs from a fresh build. Run npm run figures from site/.`)
      process.exitCode = 1
    }
  }
} finally {
  if (temp) rmSync(temp, { recursive: true, force: true })
}
