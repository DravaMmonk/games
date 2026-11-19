import { openGame, openPackage } from './ops/workspace.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { satisfies, parseVersion, compatibility, nextVersion, hash } from './release-data.js'
import { resolveLayers, readPackage } from './resolver.js'
import { lockTarget, publishPackage, checkTarget, upgradeTarget, platformManifest, packageCompatibility } from './releases.js'
import { releaseIndex, releaseSource } from './release-store.js'
import { S } from './schema.js'
import { packageWordsFixture } from './test-fixture.js'

const put = (root, name, data) => {
  const file = resolve(root, name)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n')
}
const project = () => mkdtempSync(resolve(tmpdir(), 'versions-contract-'))
const config = (uses = {}) => ({ kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses })
const namedConfig = (root, id, uses) => ({ ...config(uses), ...packageWordsFixture((name, value) => put(root, name, value), id) })
const topic = { declares: 'package', overrides: { package: ['*'] }, schema: S.obj({ title: S.text(), body: S.list(S.text()) }) }
const entry = value => ({ hash: hash(JSON.stringify(value)), value })

test('ranges use exact, tilde and caret semantics including zero-major boundaries', () => {
  for (const [range, yes, no] of [['1.2.3', '1.2.3', '1.2.4'], ['~1.2.3', '1.2.9', '1.3.0'], ['^1.2.3', '1.9.0', '2.0.0'], ['^0.2.3', '0.2.9', '0.3.0'], ['^0.0.3', '0.0.3', '0.0.4']]) {
    assert.equal(satisfies(yes, range), true)
    assert.equal(satisfies(no, range), false)
    assert.equal(satisfies('0.0.0', range), false)
  }
  for (const range of ['*', 'latest', '^1.0', '>=1.0.0', '1.0.0-beta', '01.0.0']) assert.throws(() => satisfies('1.0.0', range), /invalid range/)
  assert.throws(() => parseVersion('1.0'), /invalid version/)
})

test('structural additions, schema breaks and behavioral changes drive automatic versions', () => {
  const before = { surface: { schema: entry(S.obj({ value: S.int() })) } }
  const optional = { surface: { schema: entry(S.obj({ value: S.int(), tip: S.opt(S.str()) })) } }
  const required = { surface: { schema: entry(S.obj({ value: S.int(), tip: S.str() })) } }
  assert.equal(compatibility(before, optional).type, 'additive')
  assert.equal(compatibility(before, required).type, 'breaking')
  assert.equal(compatibility(before, { surface: {} }).type, 'breaking')
  assert.equal(compatibility(before, before, [{ kind: 'game', id: 'course' }]).type, 'behavior')
  assert.equal(nextVersion(null, compatibility(null, before)), '1.0.0')
  assert.equal(nextVersion('1.2.3', compatibility(before, optional)), '1.3.0')
  assert.equal(nextVersion('1.2.3', compatibility(before, required)), '2.0.0')
  assert.equal(nextVersion('1.2.3', { type: 'behavior' }), '2.0.0')
  assert.equal(nextVersion('1.2.3', compatibility(before, before)), '1.2.4')
})

test('the platform release surface tracks removal of authoring operations and public exports', () => {
  const before = platformManifest()
  const { operations, exports } = before.surface
  assert.deepEqual(Object.keys(operations.value['level.set'].fields).sort(), ['level', 'path', 'value'])
  assert.ok(exports.value.core.includes('createPluginKernel'))

  const after = { surface: { ...before.surface,
    operations: entry(Object.fromEntries(Object.entries(operations.value).filter(([id]) => id !== 'level.set'))),
    exports: entry({ ...exports.value, core: exports.value.core.filter(name => name !== 'createPluginKernel') }),
  } }
  const result = compatibility(before, after)
  assert.equal(result.type, 'breaking')
  assert.deepEqual(result.changes, ['operations', 'exports'])
})

test('locks report missing pins, range drift, extra dependencies and content hash drift as structured problems', () => {
  const root = project()
  try {
    put(root, 'packages/library/package.json', config())
    put(root, 'packages/course/package.json', config({ library: '^1.0.0' }))
    const target = { id: 'course', kind: 'package' }
    assert.equal(resolveLayers({ package: 'course', closure: true, root }).lockStatus.problems[0].reason, 'missing lock')
    lockTarget(target, root)
    assert.equal(resolveLayers({ package: 'course', closure: true, root }).lockStatus.valid, true)
    put(root, 'packages/library/kinds/topic.json', topic)
    put(root, 'packages/library/topic/one.json', { title: 'One', body: ['An explanatory test entry.'] })
    assert.equal(readPackage('course', root).objectProblems.some(problem => problem.rule === 'dependency'), false)
    assert.equal(openPackage('course', root).content().objectProblems.some(problem => problem.rule === 'dependency'), false)
    lockTarget(target, root)
    put(root, 'packages/course/package.json', config({ library: '~2.0.0' }))
    assert.ok(resolveLayers({ package: 'course', closure: true, root }).lockStatus.problems.some(problem => problem.reason.includes('outside ~2.0.0')))
    assert.throws(() => lockTarget(target, root), /outside/)
    put(root, 'packages/course/package.json', config())
    assert.ok(resolveLayers({ package: 'course', closure: true, root }).lockStatus.problems.some(problem => problem.target === 'library'))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('publication requires a contract for packages with a core or view entry', t => {
  const root = project()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const [id, entry] of [['engine', 'core/index.js'], ['screen', 'view/index.jsx']]) {
    const manifest = { ...namedConfig(root, id), version: '0.0.0' }
    put(root, `packages/${id}/package.json`, manifest)
    put(root, `packages/${id}/${entry}`, 'export function register() {}')
    lockTarget({ id, kind: 'package' }, root)
    assert.throws(() => publishPackage(id, root, { launch: true }), new RegExp(`${id}: code packages require contract tests`))
    assert.deepEqual(JSON.parse(readFileSync(resolve(root, `packages/${id}/package.json`), 'utf8')), manifest)
  }
  assert.equal(existsSync(resolve(root, 'releases')), false)
})

test('checked archives and workspace sources use the same reader, manifests and public layers', () => {
  const root = project()
  try {
    put(root, 'packages/library/package.json', namedConfig(root, 'library'))
    put(root, 'packages/library/core/index.js', "export const answerValue = 42; export function register(kernel) { kernel.tag('library/read', 'library/topic') }")
    put(root, 'packages/library/view/index.jsx', "export function Widget() { return <span /> } export function register(kernel) { kernel.display('library/widget', Widget) }")
    const contract = 'test/public/contract.test.mjs'
    const sourceTest = value => `
      import test from 'node:test'
      import assert from 'node:assert/strict'
      import { firstText } from 'kernel'
      import { answerValue } from '../../core/index.js'
      test('public value', () => assert.equal(firstText({ en: String(answerValue) }), '${value}'))
    `
    put(root, `packages/library/${contract}`, sourceTest(41))
    put(root, 'packages/library/kinds/topic.json', topic)
    put(root, 'packages/library/topic/one.json', { title: 'One', body: ['An explanatory test entry.'] })
    const target = { id: 'library', kind: 'package' }
    lockTarget(target, root)
    assert.throws(() => publishPackage('library', root, { launch: true }),
      /library: contract tests failed[\s\S]*not ok \d+ - public value/)
    assert.equal(releaseIndex(root).packages.library, undefined)
    assert.equal(existsSync(resolve(root, 'releases')), false)
    put(root, `packages/library/${contract}`, sourceTest(42))
    const first = publishPackage('library', root, { launch: true })
    assert.equal(first.version, '1.0.0')
    const source = resolveLayers({ package: 'library', closure: true, root }).layers[0]
    assert.ok(source.manifest.surface['display:library/widget'])
    assert.equal(source.manifest.kind, 'lib')
    assert.equal(source.manifest.title, '@package.title')
    assert.equal(source.manifest.desc, '@package.desc')
    assert.ok(source.manifest.surface['tag:library/topic:library/read'])
    assert.deepEqual(source.manifest.exports.core, ['answerValue', 'register'])
    renameSync(resolve(root, 'packages/library'), resolve(root, 'held'))
    const archive = resolveLayers({ package: 'library', closure: true, root }).layers[0]
    for (const field of ['config', 'objects', 'overrides', 'catalogs', 'manifest']) assert.deepEqual(archive[field], source[field], field)
    assert.equal(archive.source, 'archive')
    const published = releaseSource('library', { ...releaseIndex(root).packages.library[first.version], version: first.version }, root)
    assert.deepEqual(JSON.parse(readFileSync(resolve(published, 'manifest.json'), 'utf8')).checks.contracts, [contract])
    put(root, 'games/demo/game.json', { kernel: '^0.0.0', packages: { library: '^1.0.0' } })
    lockTarget({ id: 'demo', kind: 'game' }, root)
    const workspace = openGame('demo', root)
    workspace.game = { ...workspace.game, chapters: [] }
    assert.ok(workspace.write().includes('games/demo/game.json'))
    assert.throws(() => workspace.selectPackages({ library: '^2.0.0' }), /outside/)
    rmSync(resolve(root, 'games'), { recursive: true })
    // An archived package is also a standalone check target.
    assert.equal(checkTarget({ id: 'library', kind: 'package' }, root).status, 0)
    rmSync(resolve(root, 'packages/library'), { recursive: true, force: true })
    renameSync(resolve(root, 'held'), resolve(root, 'packages/library'))
    put(root, 'packages/library/topic/two.json', { title: 'Two', body: ['An explanatory test entry.'] })
    assert.equal(publishPackage('library', root, { launch: true }).version, '1.1.0')
    const unchanged = packageCompatibility('library', root)
    assert.equal(unchanged.previous, '1.1.0')
    assert.equal(unchanged.type, 'unchanged')
    assert.equal(unchanged.proposed, '1.1.1')
    rmSync(resolve(root, 'packages/library/topic/one.json'))
    assert.equal(publishPackage('library', root, { launch: true }).version, '2.0.0')
    renameSync(resolve(root, 'packages/library'), resolve(root, 'held-again'))
    put(root, 'packages/other/package.json', namedConfig(root, 'other', { library: '~1.0.0' }))
    lockTarget({ id: 'other', kind: 'package' }, root)
    put(root, 'packages/course/package.json', namedConfig(root, 'course', { library: '^1.0.0', other: '^1.0.0' }))
    const locked = lockTarget({ id: 'course', kind: 'package' }, root)
    assert.equal(locked.dependencies.library.version, '1.0.0')
    assert.equal(upgradeTarget({ id: 'course', kind: 'package' }, 'library', root).dependencies.library.version, '1.0.0')
    put(root, 'packages/other/README.md', 'A changed retained source dependency.')
    const refreshed = upgradeTarget({ id: 'course', kind: 'package' }, 'library', root)
    assert.deepEqual(refreshed.dependencies.library, locked.dependencies.library)
    assert.equal(refreshed.dependencies.other.version, '1.0.0')
    assert.notEqual(refreshed.dependencies.other.hash, locked.dependencies.other.hash)
    const index = releaseIndex(root).packages.library
    assert.deepEqual(Object.keys(index), ['1.0.0', '1.1.0', '2.0.0'])
    const release = { ...index['1.0.0'], version: '1.0.0' }
    const file = resolve(root, 'releases', release.file)
    writeFileSync(file, Buffer.concat([readFileSync(file), Buffer.from('tampered')]))
    assert.throws(() => releaseSource('library', release, root), /archive hash mismatch/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('publication compares dependent runtime checks and reports a major behavioral change', () => {
  const root = project()
  try {
    put(root, 'packages/library/package.json', namedConfig(root, 'library'))
    const code = value => `export const answerValue = ${value}; export function register() {}`
    put(root, 'packages/library/core/index.js', code(42))
    put(root, 'packages/library/test/contract.test.js', "import test from 'node:test'; import assert from 'node:assert/strict'; import { answerValue } from '../core/index.js'; test('public value', () => assert.equal(typeof answerValue, 'number'))")
    lockTarget({ id: 'library', kind: 'package' }, root)
    assert.equal(publishPackage('library', root, { launch: true }).version, '1.0.0')
    put(root, 'packages/course/package.json', namedConfig(root, 'course', { library: '^1.0.0' }))
    put(root, 'packages/course/core/index.js', `
      import { answerValue } from 'library'
      export function register(kernel) {
        kernel.play('course/probe', { initial: () => '', read: x => x, write: x => x, normalize: x => x, run: () => ({ pass: true }), judge: report => report })
        kernel.check('course/probe', Object.assign(() => [{ text: 'probe ' + answerValue }], { phase: 'runtime' }))
        kernel.check('course/examples', () => [{ fail: true, text: 'Authoring example is incomplete' }])
      }
    `)
    put(root, 'packages/course/view/index.jsx', `
      function Probe() { return null }
      export function register(kernel) { kernel.play('course/probe', { component: Probe, preview: Probe }) }
    `)
    put(root, 'packages/course/capabilities/play.json', { extends: 'play', items: { probe: {} } })
    put(root, 'packages/course/levels/sum.json', { title: 'Probe', tasks: [{ id: 'probe', play: 'course/probe', brief: 'Observe the public value.' }] })
    lockTarget({ id: 'course', kind: 'package' }, root)
    put(root, 'packages/library/core/index.js', code(43))
    const release = publishPackage('library', root, { launch: true })
    assert.equal(release.version, '2.0.0')
    assert.equal(release.compatibility.type, 'behavior')
    assert.deepEqual(release.affected, [{ id: 'course', kind: 'package' }])
    assert.match(release.compatibility.behavior[0].before.stdout, /probe 42/)
    assert.match(release.compatibility.behavior[0].after.stdout, /probe 43/)
    assert.equal(release.compatibility.behavior[0].before.status, 0)
    assert.equal(release.compatibility.behavior[0].after.status, 0)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('publication requires an explicit launch switch', () => {
  assert.throws(() => publishPackage('unused'), /disabled before launch/)
})
