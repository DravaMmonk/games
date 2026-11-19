import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { contentTargets, gameCatalog, readPackage, readContent, runtimeOf } from './resolver.js'
import { checkGame } from './checks.js'
import { openGame, openPackage } from './ops/workspace.js'
import { readLog, runChangeset } from './ops/changeset.js'
import { firstText } from './i18n.js'
import { storyRoot, lockFixture, packageWordsFixture, testProject } from './test-fixture.js'

const put = (root, name, value) => {
  const file = resolve(root, name)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value))
}

const checkFromOutside = (root, ...args) => execFileSync(process.execPath, [resolve(import.meta.dirname, 'check.js'), ...args], {
  cwd: tmpdir(), env: { ...process.env, GAMES_ROOT: root, NODE_OPTIONS: '--no-warnings' }, encoding: 'utf8',
})

test('the hub reflects edits to a game title and chapter without changing its package', async t => {
  const { root, id } = storyRoot()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  put(root, 'games/hub-order.json', [id])
  const summary = () => gameCatalog(root).map(({ id, title, levels }) => ({ id, title: firstText(title), levels }))
  assert.deepEqual(summary(), [{ id, title: 'Story', levels: 1 }])

  const edit = op => runChangeset(openGame(id, root), { ops: [op] }, { check: false, write: true })
  const title = await edit({ op: 'game.set', path: 'title', value: { en: 'New game title' } })
  assert.equal(title.ok, true, title.problems.join('\n'))
  assert.deepEqual(title.files, [`games/${id}/game.json`, `games/${id}/i18n/en.json`])

  const chapter = await edit({ op: 'chapter.set', chapter: 'ground', path: 'levels', value: [] })
  assert.equal(chapter.ok, true, chapter.problems.join('\n'))
  assert.deepEqual(chapter.files, [`games/${id}/chapters/ground.json`])
  assert.deepEqual(summary(), [{ id, title: 'New game title', levels: 0 }])
  assert.equal(readLog(openGame(id, root)).length, 2)
  assert.deepEqual(readLog(openPackage(id, root)), [])
  assert.deepEqual(readPackage(id, root).levels.map(level => level.id), [`${id}/given`])
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

test('the platform check requires views for game and standalone tasks', async () => {
  const { root, id } = storyRoot()
  try {
    const ws = openGame(id, root)
    assert.deepEqual(ws.content().levels, readContent(id, root).levels)
    assert.deepEqual(ws.changes(), [])
    assert.deepEqual(ws.write(), [])
    assert.match(checkFromOutside(root, '--game', id), /Story \(story\)[\s\S]*all games ok/)

    put(root, 'packages/story/view/index.jsx', 'export function register() {}')
    const content = readContent(id, root)
    const report = await checkGame(content, { domain: await runtimeOf(content), root })
    assert.deepEqual(report.order, ['story/given'])
    assert.deepEqual(report.lines.filter(line => line.fail), [])
    for (const scope of ['--game', '--package']) {
      assert.throws(() => checkFromOutside(root, scope, id), error => {
        assert.equal(error.status, 1)
        assert.match(error.stdout, /story\/answer: core has no view play/)
        return true
      })
    }
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('the platform check loads a data game without running its authoring rules', t => {
  const { root, id } = storyRoot()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  put(root, 'packages/story/core/index.js', `
    export function register(kernel) {
      const identity = value => value
      kernel.play('story/answer', { initial: () => '', read: identity, write: identity, normalize: identity, run: identity, judge: () => ({ pass: true }) })
      kernel.check('story/examples', () => [{ fail: true, text: 'An authored example fails.' }])
    }
  `)
  for (const scope of ['--game', '--package']) {
    assert.match(checkFromOutside(root, scope, id), /all games ok/)
    assert.throws(() => checkFromOutside(root, scope, id, '--authoring'), error => {
      assert.equal(error.status, 1)
      assert.match(error.stdout, /FAIL An authored example fails\./)
      return true
    })
  }
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
    const { lines } = await checkGame(content, { domain: await runtimeOf(content), root })
    assert.ok(lines.some(line => line.problem?.rule === 'exists' && line.problem.kind === 'play' && line.problem.target === 'absent/answer'))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('default check targets include every game followed by unplayed packages; names can be disambiguated', () => {
  const { root, put } = testProject('target-selection-')
  try {
    const id = 'proofs'
    put(`games/${id}/game.json`, { kernel: '^0.0.0', packages: { [id]: '^0.0.0' } })
    put(`packages/${id}/package.json`, { kind: 'lib', version: '0.0.0', kernel: '^0.0.0', uses: {} })
    put('packages/library/package.json', { kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: {} })
    assert.deepEqual(contentTargets([], root), [{ id, kind: 'game' }, { id: 'library', kind: 'package' }])
    assert.deepEqual(contentTargets([id], root), [{ id, kind: 'game' }])
    assert.deepEqual(contentTargets([id], root, { package: true }), [{ id, kind: 'package' }])
    assert.throws(() => contentTargets(['missing'], root), /no game or package missing/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('packages reject invalid authored package fields', () => {
  const { root, put } = testProject('target-selection-')
  try {
    put('packages/library/package.json', { kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: {}, unknownField: true })
    assert.throws(() => readPackage('library', root), /unknownField/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
