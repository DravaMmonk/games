import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { readPackage, readContent } from './resolver.js'
import { openGame } from './ops/workspace.js'
import { storyRoot, lockFixture, packageWordsFixture } from './test-fixture.js'

const put = (root, name, value) => {
  const file = resolve(root, name)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value))
}

const checkFromOutside = (root, ...args) => execFileSync(process.execPath, [resolve(import.meta.dirname, 'check.js'), ...args], {
  cwd: tmpdir(), env: { ...process.env, GAMES_ROOT: root, NODE_OPTIONS: '--no-warnings' }, encoding: 'utf8',
})

test('a project of one package and no games checks from another cwd', () => {
  const library = mkdtempSync(resolve(tmpdir(), 'independent-library-'))
  try {
    const words = packageWordsFixture((name, value) => put(library, name, value), 'library')
    put(library, 'packages/library/package.json', { kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: {}, ...words })
    lockFixture(library)
    assert.match(checkFromOutside(library, '--package', 'library'), /library \(library\)[\s\S]*all games ok/)
  } finally { rmSync(library, { recursive: true, force: true }) }
})

test('an authored game agrees with its resolver and checks from another cwd', () => {
  const { root, id } = storyRoot()
  try {
    const ws = openGame(id, root)
    assert.deepEqual(ws.content().levels, readContent(id, root).levels)
    assert.deepEqual(ws.changes(), [])
    assert.deepEqual(ws.write(), [])
    assert.match(checkFromOutside(root, '--game', id), /Story \(story\)[\s\S]*all games ok/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('source core registers arbitrary typed objects; missing dependencies and wording reach the same checker', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'registered-objects-'))
  try {
    put(root, 'packages/library/package.json', { kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: {} })
    put(root, 'packages/library/kinds/scene.json', { declares: 'package', overrides: { package: ['*'], game: ['$text'] }, folder: 'scenes', schema: { type: 'obj', fields: {} } })
    put(root, 'packages/library/core/index.js', "export function register(k) { k.object('library/scene', 'library/registered') }")
    put(root, 'packages/consumer/package.json', { kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: { 'library': '^1.0.0', 'absent': '^1.0.0' } })
    put(root, 'packages/consumer/overrides/library/scenes/registered.json', {})
    put(root, 'packages/consumer/overrides/library/scenes/missing.json', {})
    put(root, 'packages/consumer/sections/words.json', { title: '@library/missing', values: [] })
    const content = readPackage('consumer', root)
    assert.ok(content.registries['library/scene']['library/registered'])
    assert.ok(!content.objectProblems.some(problem => problem.target === 'library/registered'))
    for (const target of ['absent', 'library/missing']) assert.ok(content.objectProblems.some(problem => problem.rule === 'exists' && problem.target === target), target)
  } finally { rmSync(root, { recursive: true, force: true }) }
})


test('an absent play is a structured existence diagnostic rather than an attempted module import', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'missing-play-'))
  try {
    put(root, 'packages/example/package.json', { kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: {} })
    put(root, 'packages/example/levels/one.json', { title: '@title', tasks: [{ id: 'one', play: 'absent/answer', brief: '@brief' }] })
    put(root, 'packages/example/i18n/en.json', { title: 'One', brief: 'Answer' })
    const { runtimeOf } = await import('./runtime.js')
    const { checkGame } = await import('./checks.js')
    const content = readPackage('example', root)
    const lines = await checkGame(content, { domain: await runtimeOf(content), root })
    assert.ok(lines.some(line => line.problem?.rule === 'exists' && line.problem.kind === 'play' && line.problem.target === 'absent/answer'))
  } finally { rmSync(root, { recursive: true, force: true }) }
})
