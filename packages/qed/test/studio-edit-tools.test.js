// Package authoring tools run against synthetic content in Node.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { lockTarget } from '../../../games/kit/engine/releases.js'
import { packageWordsFixture } from '../../../games/kit/engine/test-fixture.js'
import { proofsRoot } from './fixture.js'

const { root, id: GAME } = proofsRoot()
let tools
before(async () => {
  process.env.GAMES_ROOT = root
  ;({ TOOLS: tools } = await import('../../../games/kit/engine/ops/tools.js'))
})
after(() => rmSync(root, { recursive: true, force: true }))

const call = async (tool, args) => {
  if (args.level && !args.level.includes('/')) args = { ...args, level: `${GAME}/${args.level}` }
  return tools[tool].run(args)
}
const onDisk = file => readFileSync(join(root, 'packages', GAME, file), 'utf8')

test('package preview uses dependency order for copy diagnostics and leaves files untouched', async () => {
  const before = onDisk('levels/given.json')
  const originalCatalog = onDisk('i18n/en.json')
  const value = `See <level-ref to="${GAME}/missing"></level-ref>.`
  const ops = [
    { op: 'text.set', level: 'given', path: 'tasks[0].brief', lang: 'en', value },
  ]
  const body = await call('preview', { package: GAME, changeset: { ops } })
  assert.equal(body.ok, false)
  assert.equal(body.failed, null)
  assert.equal(body.content.levels.find((l) => l.id === `${GAME}/given`).tasks[0].brief.en, value)
  assert.deepEqual(body.order, ['given', 'apply', 'suppose'].map(id => `${GAME}/${id}`))
  assert.deepEqual(body.lines, [{
    fail: true, text: `text levels.0.tasks.0.brief refers to a missing level: ${GAME}/missing`, levels: [`${GAME}/given`],
  }])
  const catalog = `packages/${GAME}/i18n/en.json`
  assert.deepEqual(body.changes.map((c) => c.file).sort(), [catalog])
  const brief = JSON.parse(before).tasks[0].brief.slice(1)
  assert.equal(JSON.parse(body.changes.find((c) => c.file === catalog).after)[brief], 'See <level-ref to="missing"></level-ref>.')
  assert.equal(onDisk('levels/given.json'), before)
  assert.equal(onDisk('i18n/en.json'), originalCatalog, 'preview leaves the changed catalog on disk untouched')

  const bad = await call('preview', { package: GAME, changeset: { ops: [ops[0], { op: 'level.set', level: 'nope', path: 'x', value: 1 }] } })
  assert.equal(bad.failed, 1)
  assert.equal(bad.content, null)
  assert.deepEqual(bad.order, [])
  assert.match(bad.problems[0], /^op 2 \(level.set\)/)
})

test('a board can be seeded from pending edits and rendered from saved content', async () => {
  const text = [`# blueprint 1 ${GAME} suppose`, 'f = impI[A=A](body: z) {', '  body {', '    m1 = mp(p, f.body)', '    z = mp(q, m1)', '  }', '}', 'goal <- f'].join('\n')
  const changed = await call('seed', { package: GAME, level: 'suppose', path: 'tasks[0].solution', changeset: { ops: [{ op: 'level.blueprint', level: 'suppose', path: 'tasks[0].solution', text }] } })
  assert.equal(changed.task, 0)
  assert.equal(changed.data.nodes.find(node => node.id === 'f')?.type, `${GAME}/impI`)
  assert.equal(changed.data.nodes.find(node => node.id === 'z')?.type, `${GAME}/mp`)
  const { boards } = await call('render', { package: GAME, level: 'suppose', format: 'svg' })
  assert.deepEqual(boards.map(board => board.path), ['tasks[0].solution'])
  assert.match(boards[0].svg, /^<svg[\s\S]*>m2<\/text>/)
})

test('the tools list, preview and write a package that no game selects', async () => {
  const pkg = join(root, 'packages', 'library')
  mkdirSync(join(pkg, 'i18n'), { recursive: true })
  const words = packageWordsFixture((path, value) => writeFileSync(join(root, path), JSON.stringify(value, null, 2) + '\n'), 'library')
  writeFileSync(join(pkg, 'package.json'), `${JSON.stringify({ kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: { circuit: '^0.0.0', logic: '^0.0.0', qed: '^0.0.0' }, ...words })}\n`)
  mkdirSync(join(pkg, 'parts'), { recursive: true })
  writeFileSync(join(pkg, 'parts/apply.json'), JSON.stringify( { name: 'Apply', desc: 'Apply an implication.', icon: 'GitFork', family: 'logic/rule', inputs: [{ name: 'imp', type: 'logic/judgment' }, { name: 'a', type: 'logic/judgment' }], outputType: 'logic/judgment', op: 'logic/mp' }))
  const quick = await call('preview', { package: 'library', check: false })
  assert.equal(quick.ok, false)
  assert.deepEqual(quick.lines.filter(line => line.fail).map(({ problem }) => [problem?.rule, problem?.reason]), [
    ['dependency', 'missing lock'],
  ])
  assert.deepEqual(quick.content.levels, [])
  assert.equal(quick.content.packageTarget.id, 'library')
  lockTarget({ kind: 'package', id: 'library' }, root)
  const packages = await call('packages', {})
  const library = packages.find(entry => entry.id === 'library')
  assert.equal(library.title.en, 'library')
  assert.equal(library.desc.zh, '测试包。')
  const modified = await call('modify', { package: 'library', changeset: { ops: [{ op: 'parts.set', path: ['parts', 'apply', 'desc'], value: 'A revised description.' }] } })
  assert.equal(modified.written, true, modified.problems.join('\n'))
  assert.deepEqual(modified.files, ['packages/library/parts/apply.json'])
  assert.equal((await call('log', { package: 'library' })).head, 1)
})

test('reading tools expose vocabulary, reference results, board text and dependencies', async () => {
  const vocabulary = await call('vocabulary', { game: GAME })
  assert.deepEqual(vocabulary.modules, ['logic'])
  assert.ok(vocabulary.vocabulary.kinds.primitive && vocabulary.operations['task.move'].params.fields.to)

  assert.deepEqual(await call('run_reference', { game: GAME, level: 'apply' }), { ok: true, lines: [`${GAME}/apply Apply: solution PASS [2 steps]`] })

  assert.match((await call('render', { game: GAME, level: 'suppose' })).text, /^proofs\/suppose · Suppose\n[\s\S]*tasks\[0\]\.solution:\n {2}f = proofs\/impI/)
  assert.equal((await call('render', { game: GAME, level: 'suppose', format: 'png' })).rendered, false)
  assert.match((await call('deps', { game: GAME })).text, /^flowchart LR/)
})

test('modify refuses a broken reference, previews a diff, and writes a loadable edit with its reason', async () => {
  const invalid = { op: 'text.set', level: 'suppose', path: 'tasks[0].brief', lang: 'en', value: 'See <level-ref to="missing"></level-ref>.' }
  const level = onDisk('levels/suppose.json')
  const originalCatalog = onDisk('i18n/en.json')
  const refused = await call('modify', { package: GAME, changeset: { ops: [invalid] } })
  assert.equal(refused.ok, false)
  assert.match(refused.problems.join('\n'), /refers to a missing level: proofs\/missing/)
  assert.equal(onDisk('levels/suppose.json'), level)
  assert.equal(onDisk('i18n/en.json'), originalCatalog)

  const hint = { op: 'text.set', level: 'suppose', path: 'tasks[0].hint[0]', lang: 'en', value: 'Set the box’s assumption to “Today is Saturday”, the first half of the sentence.' }
  const catalog = onDisk('i18n/en.json')
  const preview = await call('modify', { package: GAME, changeset: { ops: [hint] }, dryRun: true })
  assert.equal(preview.ok && !preview.written, true)
  assert.match(preview.diff, new RegExp(`^--- a/packages/${GAME}/i18n/en.json`))
  assert.equal(onDisk('i18n/en.json'), catalog)
  const done = await call('modify', { package: GAME, changeset: { why: 'a clearer hint', ops: [hint] } })
  assert.equal(done.written, true, done.problems.join('\n'))
  const ref = JSON.parse(onDisk('levels/suppose.json')).tasks[0].hint[0]
  assert.match(ref, /^@/)
  assert.equal(JSON.parse(onDisk('i18n/en.json'))[ref.slice(1)], hint.value)
  assert.equal(JSON.parse(onDisk('changes.jsonl').trim().split('\n').at(-1)).why, 'a clearer hint')
})

test('search and replace: hits across the game, a replace as a changeset that modify applies; history outside git says so', async () => {
  const found = await call('search', { package: GAME, query: { find: 'assume', kinds: ['text'] } })
  assert.ok(found.count > 0 && found.hits.every((h) => h.kind === 'text' && h.at.length), JSON.stringify(found).slice(0, 300))
  const { changeset, changes } = await call('replace', { package: GAME, query: { find: 'Saturday', caseSensitive: true }, with: 'Sunday' })
  assert.ok(changeset.ops.length >= 1 && changeset.ops.every((op) => op.op === 'text.set' && op.lang === 'en' && op.value))
  assert.ok(changes.every((c) => c.after.includes('Sunday') && !c.after.includes('Saturday')))
  const done = await call('modify', { package: GAME, changeset })
  assert.equal(done.written, true, done.problems.join('\n'))
  assert.equal((await call('search', { package: GAME, query: { find: 'Saturday', caseSensitive: true } })).count, 0)
  const old = await call('history', { package: GAME, level: 'suppose' })
  assert.equal(old.found, false)
  assert.match(old.why, /git/i)
})
