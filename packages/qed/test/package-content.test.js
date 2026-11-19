// Independent package authoring uses synthetic content and the existing domain readers.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { contentTargets, gameCatalog, runtimeOf, readContent, readPackage } from '../../../games/kit/engine/resolver.js'
import { checkGame } from '../../../games/kit/engine/checks.js'
import { lockTarget } from '../../../games/kit/engine/releases.js'
import { packageLevel, packageLevelOrder } from '../../../games/kit/engine/package-play.js'
import { contentAssets, CONTENT_FILE } from '../../../games/kit/app/content-assets.js'
import { pageContent } from '../../../games/kit/app/page-content.js'
import { contentSchemas } from '../../../games/kit/engine/content.js'
import { holds } from '../../circuit/core/index.js'
import { usable } from '../../circuit/core/course.js'
import { openGame, openPackage } from '../../../games/kit/engine/ops/workspace.js'
import { adopt, readLog, runChangeset, undo } from '../../../games/kit/engine/ops/changeset.js'
import { proofsRoot, copyProofsRoot, installLogicFixture } from './fixture.js'
import { packageWordsFixture } from '../../../games/kit/engine/test-fixture.js'

const roots = []
after(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })))
let proofSeed
function proofWorkspace() {
  if (!proofSeed) {
    proofSeed = proofsRoot()
    roots.push(proofSeed.root)
  }
  const workspace = copyProofsRoot(proofSeed)
  roots.push(workspace.root)
  return workspace
}

function project() {
  const root = mkdtempSync(resolve(tmpdir(), 'package-content-'))
  roots.push(root)
  const put = (file, value) => {
    const path = resolve(root, file)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
  }
  return { root, put }
}
function library() {
  const { root, put } = project()
  installLogicFixture(root)
  put('packages/library/package.json', { kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: { circuit: '^0.0.0', logic: '^0.0.0', qed: '^0.0.0' }, ...packageWordsFixture(put, 'library') })
  put('packages/library/parts/apply.json', { name: 'Apply', desc: 'Apply an implication.', icon: 'GitFork', family: 'logic/rule', inputs: [{ name: 'imp', type: 'logic/judgment' }, { name: 'a', type: 'logic/judgment' }], outputType: 'logic/judgment', op: 'logic/mp' })
  return { root, put }
}

test('a parts-only package opens without a course, checks and writes its own log without a game', async () => {
  const { root } = library()
  lockTarget({ kind: 'package', id: 'library' }, root)
  const ws = openPackage('library', root)
  const content = ws.content()
  assert.deepEqual(ws.changes(), [])
  assert.deepEqual(content.levels, [])
  assert.equal('eras' in content, false)
  assert.equal('chapters' in content, false)
  const domain = await runtimeOf(content)
  assert.deepEqual((await checkGame(content, { domain, root })).filter((line) => line.fail), [])
  adopt(ws, 'Start the independent library log.')
  const result = await runChangeset(ws, { ops: [{ op: 'parts.set', path: ['parts', 'apply', 'desc'], value: 'Use the implication rule.' }] }, { write: true, check: false })
  assert.equal(result.ok, true, result.problems.join('\n'))
  assert.ok(result.files.every((file) => file.startsWith('packages/library/')))
  assert.equal(readLog(ws).length, 2)
  assert.equal(existsSync(resolve(root, 'games')), false)
  const back = await undo(openPackage('library', root), { write: true, check: false })
  assert.equal(back.ok, true, back.problems.join('\n'))
  assert.equal(readPackage('library', root).partDefs.parts['library/apply'].desc, 'Apply an implication.')
  const cli = execFileSync(process.execPath, [resolve(new URL('../../../games/kit/engine/', import.meta.url).pathname, 'ops/cli.js'), '--package', 'library', 'log'], { env: { ...process.env, GAMES_ROOT: root }, encoding: 'utf8' })
  assert.match(cli, /Start the independent library log/)
})

test('single-level play uses task trays, ignores prerequisites and opens settings without progress', async () => {
  const { root, id } = proofWorkspace()
  const dir = resolve(root, 'packages', id, 'trays')
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'tools.json'), JSON.stringify({ values: ['impI'] }))
  const content = readPackage(id, root)
  assert.equal('eras' in content, false)
  assert.equal('chapters' in content, false)
  assert.deepEqual(packageLevelOrder(content), ['given', 'apply', 'suppose'].map(level => `${id}/${level}`))
  const source = content.levels.find(l => l.id === `${id}/given`)
  source.tasks[0].tray = `${id}/tools`
  const shell = packageLevel(content, source.id)
  assert.equal(shell.levels.length, 1)
  assert.deepEqual(shell.eras, [])
  const { course, levels } = (await runtimeOf(shell)).spec(shell)
  assert.deepEqual(levels.map(l => l.id), [source.id])
  assert.deepEqual(course.plan.requires.get(source.id), [])
  assert.deepEqual(usable(course, { id: source.id, task: 0 }, new Set()), [`${id}/impI`])
  assert.equal(holds(course, { id: source.id, task: 0 }, new Set())(`${id}/impI`, 'A'), true)
  assert.equal(holds(course, { id: source.id, task: 0 }, new Set())(`${id}/mp`), false)
  delete source.tasks[0].tray
  const all = (await runtimeOf(shell)).spec(shell).course
  assert.ok(usable(all, { id: source.id, task: 0 }, new Set()).includes(`${id}/mp`))
  assert.throws(() => packageLevel(content, 'missing'), /no level/)
})

test('a levels-only package plays dependency parts and checks references and naive answers independently', async () => {
  const { root, put } = library()
  put('packages/problems/package.json', { kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: { library: '^1.0.0', circuit: '^0.0.0', logic: '^0.0.0', qed: '^0.0.0' } })
  put('packages/problems/levels/implication.json', {
    title: 'Implication', after: 'Use the implication.', tasks: [{ id: 'solve', kind: 'logic/proof',
      tests: [{ premises: { p: 'A → B', q: 'A' }, goal: 'B' }], cases: [{ A: 'A', B: 'B' }],
      solution: ['m = library/apply(p, q)', 'goal <- m'], naive: ['goal <- q'],
      brief: 'Prove B.', hint: ['Apply the implication.'],
    }],
  })
  lockTarget({ kind: 'package', id: 'problems' }, root)
  const content = readPackage('problems', root)
  const lines = await checkGame(content, { domain: await runtimeOf(content), root })
  assert.deepEqual(lines.filter(l => l.fail), [])
  assert.ok(lines.some(l => /naive fails/.test(l.text)))
  content.levels[0].tasks[0].naive = content.levels[0].tasks[0].solution
  assert.ok((await checkGame(content, { domain: await runtimeOf(content), root })).some(l => l.fail && /naive/.test(l.text)))
  content.levels[0].gives = ['library/missing']
  assert.ok((await checkGame(content, { domain: await runtimeOf(content), root })).some(l => l.fail && /missing/.test(l.text)))
})

test('package dependencies are readable while only the selected layer can be edited', async () => {
  const { root, put } = library()
  put('packages/extra/package.json', { kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: { library: '^1.0.0', circuit: '^0.0.0' } })
  lockTarget({ kind: 'package', id: 'library' }, root)
  lockTarget({ kind: 'package', id: 'extra' }, root)
  const ws = openPackage('extra', root)
  assert.ok(ws.content().registries['circuit/part']['library/apply'])
  const wrongLayer = await runChangeset(ws, { ops: [{ op: 'override.put', layer: 'library', kind: 'circuit/part', name: 'library/apply', data: { desc: 'Wrong layer' } }] })
  assert.equal(wrongLayer.ok, false)
  assert.match(wrongLayer.problems[0], /open layer library/)
  const gameOp = await runChangeset(ws, { ops: [{ op: 'game.set', path: 'title', value: 'Game title' }] })
  assert.equal(gameOp.ok, false)
  const edited = await runChangeset(ws, { ops: [{ op: 'override.put', layer: 'extra', kind: 'circuit/part', name: 'library/apply', data: { desc: 'Local override' } }] }, { write: true, check: false })
  assert.equal(edited.ok, true, edited.problems.join('\n'))
  assert.deepEqual(edited.files, ['packages/extra/overrides/library/parts/apply.json'])
  assert.equal(readPackage('library', root).partDefs.parts['library/apply'].desc, 'Apply an implication.')
  assert.equal(readPackage('extra', root).partDefs.parts['library/apply'].desc, 'Local override')
  assert.deepEqual(readLog(openPackage('library', root)), [])
})

test('games can edit only their own layer, and log in their own log', async () => {
  const { root, id } = proofWorkspace()
  const ws = openGame(id, root)
  const before = readFileSync(resolve(root, 'packages', id, 'parts/mp.json'), 'utf8')
  const refused = await runChangeset(ws, { ops: [{ op: 'parts.set', path: ['parts', 'mp', 'desc'], value: 'Forbidden' }] })
  assert.equal(refused.ok, false)
  const result = await runChangeset(ws, { ops: [{ op: 'game.set', path: 'title', value: 'New game title' }] }, { write: true, check: false })
  assert.equal(result.ok, true, result.problems.join('\n'))
  assert.deepEqual(result.files, [`games/${id}/game.json`, `games/${id}/i18n/en.json`])
  assert.equal(readFileSync(resolve(root, 'packages', id, 'parts/mp.json'), 'utf8'), before)
  assert.equal(readContent(id, root).title, 'New game title')
  assert.equal(readLog(openGame(id, root)).length, 1)
  assert.deepEqual(readLog(openPackage(id, root)), [])
})

test('default check targets include every game followed by unplayed packages; names can be disambiguated', () => {
  const { root, put } = project()
  const id = 'proofs'
  put(`games/${id}/game.json`, { kernel: '^0.0.0', packages: { [id]: '^0.0.0' } })
  put(`packages/${id}/package.json`, { kind: 'lib', version: '0.0.0', kernel: '^0.0.0', uses: {} })
  put('packages/library/package.json', { kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: {} })
  assert.deepEqual(contentTargets([], root), [{ id, kind: 'game' }, { id: 'library', kind: 'package' }])
  assert.deepEqual(contentTargets([id], root), [{ id, kind: 'game' }])
  assert.deepEqual(contentTargets([id], root, { package: true }), [{ id, kind: 'package' }])
  assert.throws(() => contentTargets(['missing'], root), /no game or package missing/)
})


test('hub level counts follow chapter edits without writing a second file', async () => {
  const { root, id } = proofWorkspace()
  writeFileSync(resolve(root, 'games/hub-order.json'), JSON.stringify([id]))
  const ws = openGame(id, root)
  const result = await runChangeset(ws, { ops: [{ op: 'chapter.set', chapter: 'ground', path: 'levels', value: [`${id}/given`, `${id}/apply`] }] }, { write: true, check: false })
  assert.equal(result.ok, true, result.problems.join('\n'))
  assert.deepEqual(result.files, [`games/${id}/chapters/ground.json`])
  assert.equal(gameCatalog(root)[0].levels, 2)
})


test('packages reject invalid authored package fields', async () => {
  const { root, put } = project()
  put('packages/library/package.json', { kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: {}, unknownField: true })
  assert.throws(() => readPackage('library', root), /unknownField/)
})


test('symbol files, wording, typed tags and overrides use symbols throughout authoring', async () => {
  const { root, put } = library()
  put('packages/library/symbols/and.json', { mark: 'logic/formulaAnd', name: '∧', desc: '@symbol.and.desc', icon: 'Rows3' })
  put('packages/library/i18n/en.json', { 'symbol.and.desc': 'Conjunction' })
  put('packages/library/tags/logic/symbol/formulas.json', { values: ['and'] })
  put('packages/library/trays/mixed.json', { values: ['apply', '#formulas'] })
  put('packages/extra/package.json', { kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: { library: '^1.0.0', circuit: '^0.0.0', logic: '^0.0.0' } })
  put('packages/extra/overrides/library/symbols/and.json', { icon: 'Box' })
  lockTarget({ kind: 'package', id: 'extra' }, root)
  const content = readPackage('extra', root)
  assert.equal(content.registries['logic/symbol']['library/and'].icon, 'Box')
  assert.equal(content.registries['logic/symbol']['library/and'].desc.en, 'Conjunction')
  assert.ok(content.objectProblems.some(problem => /formulas/.test(problem.says)))
  put('packages/library/trays/mixed.json', { values: ['apply'] })
  lockTarget({ kind: 'package', id: 'library' }, root)
  const ws = openPackage('library', root)
  const result = await runChangeset(ws, { why: 'Edit a symbol.', ops: [{ op: 'object.set', kind: 'logic/symbol', name: 'and', path: 'icon', value: 'Box' }, { op: 'text.set', symbol: 'and', path: 'desc', lang: 'en', value: 'Both sentences' }] }, { write: true, check: false })
  assert.equal(result.ok, true, result.problems.join('\n'))
  assert.ok(existsSync(resolve(root, 'packages/library/symbols/and.json')))
  assert.equal(existsSync(resolve(root, 'packages/library/symbol/and.json')), false)
  const edited = readPackage('library', root)
  const symbols = edited.registries['logic/symbol']
  assert.equal(symbols['library/and'].desc.en, 'Both sentences')
  assert.equal(symbols['library/and'].icon, 'Box')
  const assets = contentAssets(edited)
  const page = await pageContent(JSON.parse(assets.get(CONTENT_FILE)), 'https://example.test/',
    url => new Response(assets.get(url.pathname.slice(1))), contentSchemas.get(edited))
  assert.deepEqual(page.registries['logic/symbol'], symbols)
  const back = await undo(openPackage('library', root), { write: true, check: false })
  assert.equal(back.ok, true, back.problems.join('\n'))
  const { desc, icon } = readPackage('library', root).registries['logic/symbol']['library/and']
  assert.equal(desc.en, 'Conjunction')
  assert.equal(icon, 'Rows3')
})
