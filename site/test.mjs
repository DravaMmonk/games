import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { testArgs, testEnv, testFiles } from '../games/kit/engine/test-files.js'

const site = import.meta.dirname
const packages = resolve(site, '../packages')
const files = [
  ...testFiles(resolve(site, '../games/kit')),
  ...readdirSync(packages, { withFileTypes: true }).filter(entry => entry.isDirectory())
    .flatMap(entry => testFiles(resolve(packages, entry.name, 'test'))),
  resolve(site, 'package-views.test.js'),
]
const result = spawnSync(process.execPath, testArgs(files, process.argv.slice(2)), {
  cwd: site, env: testEnv(), stdio: 'inherit',
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
