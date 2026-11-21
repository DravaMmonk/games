// Independent package authoring uses synthetic content and the existing domain readers.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runtimeOf, readPackage } from '../../../games/kit/engine/resolver.js'
import { checkGame } from '../../../games/kit/engine/checks.js'
import { lockTarget } from '../../../games/kit/engine/releases.js'
import { packageLevel, packageLevelOrder } from '../../../games/kit/engine/package-play.js'
import { contentAssets, CONTENT_FILE } from '../../../games/kit/app/content-assets.js'
import { pageContent } from '../../../games/kit/app/page-content.js'
import { contentSchemas } from '../../../games/kit/engine/content.js'
import { holds } from '../../circuit/core/index.js'
import { usable } from '../../circuit/core/course.js'
import { openPackage } from '../../../games/kit/engine/ops/workspace.js'
import { adopt, readLog, runChangeset, undo } from '../../../games/kit/engine/ops/changeset.js'
import { proofsRoot, installLogicFixture } from './fixture.js'
import { copyTestProject, packageWordsFixture, testProject } from '../../../games/kit/engine/test-fixture.js'

const roots = []
after(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })))
let librarySeed

function library() {
  if (!librarySeed) {
    const { root, put } = testProject('package-content-')
    roots.push(root)
    installLogicFixture(root)
    put('packages/library/package.json', { kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: { circuit: '^0.0.0', logic: '^0.0.0', qed: '^0.0.0' }, ...packageWordsFixture(put, 'library') })
    put('packages/library/parts/apply.json', { name: 'Apply', desc: 'Apply an implication.', icon: 'GitFork', family: 'logic/rule', inputs: [{ name: 'imp', type: 'logic/judgment' }, { name: 'a', type: 'logic/judgment' }], outputType: 'logic/judgment', op: 'logic/mp' })
    lockTarget({ kind: 'package', id: 'library' }, root)
    librarySeed = root
  }
  const project = copyTestProject(librarySeed, 'package-content-')
  roots.push(project.root)
  return project
}

test('a parts-only package opens without a course, checks and writes its own log without a game', async () => {
  const { root } = library()
  const ws = openPackage('library', root)
  const content = ws.content()
  assert.deepEqual(ws.changes(), [])
  assert.deepEqual(content.levels, [])
  assert.equal('eras' in content, false)
  assert.equal('chapters' in content, false)
  const domain = await runtimeOf(content)
  const { lines } = await checkGame(content, { domain, root })
  assert.deepEqual(lines.filter((line) => line.fail), [])
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
  const { root, id } = proofsRoot()
  roots.push(root)
  const dir = resolve(root, 'packages', id, 'trays')
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'tools.json'), JSON.stringify({ values: ['impI'] }))
  const content = readPackage(id, root)
  assert.deepEqual(packageLevelOrder(content), ['given', 'apply', 'suppose'].map(level => `${id}/${level}`))
  const source = content.levels.find(l => l.id === `${id}/suppose`)
  assert.ok(content.relationEdges.requires.some(edge => edge.from === `${id}/apply` && edge.to === source.id))
  source.tasks[0].tray = `${id}/tools`
  const shell = packageLevel(content, source.id)
  const domain = await runtimeOf(shell)
  const { course, levels } = domain.spec(shell)
  assert.deepEqual(levels.map(l => l.id), [source.id])
  assert.deepEqual(course.plan.requires.get(source.id), [])
  const at = { id: source.id, task: 0 }
  const passed = new Set()
  assert.deepEqual(usable(course, at, passed), [`${id}/impI`])
  const canPlace = holds(course, at, passed)
  assert.equal(canPlace(`${id}/impI`, 'A'), true)
  assert.equal(canPlace(`${id}/mp`), false)
  delete source.tasks[0].tray
  assert.ok(usable(domain.spec(shell).course, at, passed).includes(`${id}/mp`))
  assert.throws(() => packageLevel(content, 'missing'), /no level/)
})

test('single-level play offers direct rule cards only for parts in its declared tray', async () => {
  const { root, id } = proofsRoot()
  roots.push(root)
  const dir = resolve(root, 'packages', id, 'trays')
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'tools.json'), JSON.stringify({ values: ['impI'] }))
  const content = readPackage(id, root)
  const level = content.levels.find(l => l.id === `${id}/suppose`)
  level.tasks[0] = {
    id: `${id}/direct`, kind: 'logic/machine', tray: `${id}/tools`, directRuleCards: true,
    want: 'logic/proved', tests: [{ goal: 'Rain → Rain' }],
    solution: ['box = logic/directBackward-proofs_impI(in)', 'out <- box'],
  }
  const shell = packageLevel(content, level.id)
  const domain = await runtimeOf(shell)
  const { logic } = domain.spec(shell)
  const task = logic.LEVELS[0].tasks[0]
  const view = logic.machineBoards.forTask(task)
  const offer = view.offerIn(task, new Set())
  assert.ok(offer.types.includes('logic/directBackward-proofs_impI'))
  assert.ok(!offer.types.includes('logic/directBackward-proofs_mp'))
  assert.ok(!offer.types.includes('logic/directBackward-logic_assumption'))
  assert.equal(view.holdsIn(task, new Set())('logic/directBackward-proofs_impI'), true)
  assert.equal(view.holdsIn(task, new Set())('logic/directBackward-logic_assumption'), false)
})

test('a direct rule tray offers the bound cards instead of their rule sources', async () => {
  const { root, id } = proofsRoot()
  roots.push(root)
  const dir = resolve(root, 'packages', id, 'trays')
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'tools.json'), JSON.stringify({ values: ['impI'], directRuleCards: true }))
  const content = readPackage(id, root)
  const level = content.levels.find(l => l.id === `${id}/suppose`)
  const card = `logic/directBackward-${id}_impI`
  level.tasks[0] = {
    id: `${id}/direct`, kind: 'logic/machine', tray: `${id}/tools`,
    want: 'logic/becomes', tests: [{ goal: 'Rain → Rain', becomes: [['Rain ⊢ Rain']] }],
    solution: [`box = ${card}(in)`, 'out <- box'],
  }
  const shell = packageLevel(content, level.id)
  const domain = await runtimeOf(shell)
  const { logic } = domain.spec(shell)
  const task = logic.LEVELS[0].tasks[0]
  const view = logic.machineBoards.forTask(task)
  assert.deepEqual(view.offerIn(task, new Set()), { shown: [card], folded: [], types: [card] })
  assert.equal(view.holdsIn(task, new Set())(`${id}/impI`), false)
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
  const domain = await runtimeOf(content)
  const check = async () => (await checkGame(content, { domain, authoring: true, root })).lines
  const lines = await check()
  assert.deepEqual(lines.filter(l => l.fail), [])
  assert.deepEqual(lines.filter(l => l.level === 'problems/implication'), [
    { level: 'problems/implication', fail: false, text: 'problems/implication Implication: solution PASS [1 steps]' },
    { level: 'problems/implication', fail: false, text: '  naive fails' },
  ])
  const [task] = content.levels[0].tasks
  const { naive } = task
  task.naive = task.solution
  assert.deepEqual((await check()).filter(l => l.fail), [
    { level: 'problems/implication', fail: true, text: '  naive PASSES (bad)' },
  ])
  task.naive = naive
  content.levels[0].gives = ['library/missing']
  assert.ok((await check()).some(l => l.fail && /library\/missing/.test(l.text)))
})

test('package dependencies are readable while only the selected layer can be edited', async () => {
  const { root, put } = library()
  put('packages/extra/package.json', { kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: { library: '^1.0.0', circuit: '^0.0.0' } })
  lockTarget({ kind: 'package', id: 'extra' }, root)
  const ws = openPackage('extra', root)
  assert.ok(ws.content().registries['circuit/part']['library/apply'])
  const wrongLayer = await runChangeset(ws, { ops: [{ op: 'override.put', layer: 'library', kind: 'circuit/part', name: 'library/apply', data: { desc: 'Wrong layer' } }] }, { check: false })
  assert.equal(wrongLayer.failed, 0)
  assert.match(wrongLayer.problems[0], /open layer library/)
  const gameOp = await runChangeset(ws, { ops: [{ op: 'game.set', path: 'title', value: 'Game title' }] }, { check: false })
  assert.equal(gameOp.failed, 0)
  assert.match(gameOp.problems[0], /game workspace's to change/)
  const edited = await runChangeset(ws, { ops: [{ op: 'override.put', layer: 'extra', kind: 'circuit/part', name: 'library/apply', data: { desc: 'Local override' } }] }, { write: true, check: false })
  assert.equal(edited.ok, true, edited.problems.join('\n'))
  assert.deepEqual(edited.files, ['packages/extra/overrides/library/parts/apply.json'])
  assert.equal(readPackage('library', root).partDefs.parts['library/apply'].desc, 'Apply an implication.')
  assert.equal(readPackage('extra', root).partDefs.parts['library/apply'].desc, 'Local override')
  assert.deepEqual(readLog(openPackage('library', root)), [])
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
