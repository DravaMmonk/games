// Studio and MCP tool behavior, using the production tools directly.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readContent, contentLayers } from '../../../games/kit/engine/resolver.js'
import { lockTarget } from '../../../games/kit/engine/releases.js'
import { packageEntries } from '../../../games/kit/engine/plugin-node.js'
import { closeGames, loadModule } from '../../../games/kit/engine/games.mjs'
import { packageWordsFixture } from '../../../games/kit/engine/test-fixture.js'
import { proofsRoot } from './fixture.js'

const { root, id: GAME } = proofsRoot()
let tools
before(async () => {
  process.env.GAMES_ROOT = root
  ;({ TOOLS: tools } = await import('../../../games/kit/engine/ops/tools.js'))
})
after(async () => {
  await closeGames()
  rmSync(root, { recursive: true, force: true })
})

const call = async (tool, args) => {
  if (args.level && !args.level.includes('/')) args = { ...args, level: `${GAME}/${args.level}` }
  return tools[tool].run(args)
}
const onDisk = file => readFileSync(join(root, 'packages', GAME, file), 'utf8')

test('Studio restores the course progression policy after transferring content', async () => {
  const content = readContent(GAME, root)
  const entries = packageEntries(contentLayers(content), root)
  const loaders = Object.fromEntries(entries.map(({ id, core, view }) => [id, async () => ({
    core: core && await loadModule(core),
    view: view && await loadModule(view),
  })]))
  const { loadGame } = await loadModule(new URL('../../../games/kit/app/load-game.js', import.meta.url).pathname)
  const game = await loadGame(structuredClone(content), loaders)
  const level = game.byId[`${GAME}/apply`]
  const at = { id: level.id, task: 0 }

  assert.deepEqual(game.course.availableParts(at), [`${GAME}/mp`])
  const apply = game.parts.all.find(({ part }) => part === `${GAME}/mp`)
  const badges = game.mapBadges(level, { solved: new Set(), all: true })
  assert.deepEqual(badges.map(({ label, fresh }) => ({ label, fresh })), [{ label: apply.name, fresh: true }])
})

test('a pending changeset previewed: its content, lines by level and files, nothing written', async () => {
  const before = onDisk('levels/suppose.json')
  const ops = [
    { op: 'text.set', level: 'suppose', path: 'tasks[0].brief', lang: 'en', value: 'Prove it with one box.' },
  ]
  const body = await call('preview', { package: GAME, changeset: { ops } })
  assert.equal(body.failed, null)
  assert.equal(body.content.levels.find((l) => l.id === `${GAME}/suppose`).tasks[0].brief.en, 'Prove it with one box.')
  assert.ok(body.order.includes(`${GAME}/suppose`) && body.lines.every((l) => Array.isArray(l.levels)))
  assert.ok(body.lines.some((l) => l.levels.includes(`${GAME}/suppose`) && /^proofs\/suppose /.test(l.text)), 'a domain line is about its level')
  const catalog = `packages/${GAME}/i18n/en.json`
  assert.deepEqual(body.changes.map((c) => c.file).sort(), [catalog])
  const brief = JSON.parse(before).tasks[0].brief.slice(1)
  assert.equal(JSON.parse(body.changes.find((c) => c.file === catalog).after)[brief], 'Prove it with one box.')
  assert.equal(onDisk('levels/suppose.json'), before, 'a preview writes nothing')

  const bad = await call('preview', { package: GAME, changeset: { ops: [ops[0], { op: 'level.set', level: 'nope', path: 'x', value: 1 }] } })
  assert.equal(bad.failed, 1)
  assert.equal(bad.content, null)
  assert.match(bad.problems[0], /^op 2 \(level.set\)/)
})

test('a board seeded for the game, drawn as SVG', async () => {
  const seed = await call('seed', { package: GAME, level: 'suppose', path: 'tasks[0].solution' })
  assert.equal(seed.task, 0)
  assert.ok(Array.isArray(seed.data.nodes) && seed.data.nodes.some((n) => n.type === `${GAME}/impI`), JSON.stringify(seed).slice(0, 300))
  const text = [`# blueprint 1 ${GAME} suppose`, 'f = impI[A=A](body: z) {', '  body {', '    m1 = mp(p, f.body)', '    z = mp(q, m1)', '  }', '}', 'goal <- f'].join('\n')
  const changed = await call('seed', { package: GAME, level: 'suppose', path: 'tasks[0].solution', changeset: { ops: [{ op: 'level.blueprint', level: 'suppose', path: 'tasks[0].solution', text }] } })
  assert.ok(changed.data.nodes.some((n) => n.id === 'z'), 'seeded from the content as the changeset leaves it')
  const { boards } = await call('render', { package: GAME, level: 'suppose', format: 'svg' })
  assert.match(boards[0].svg, /^<svg/)
})

test('blueprint preview, seed, and tests use the requested task', async () => {
  const level = 'given'
  const { id, ...data } = readContent(GAME, root).levels.find((item) => item.id === `${GAME}/${level}`)
  const first = data.tasks[0]
  const second = { ...first, id: `${id}_2`, brief: { en: first.brief.en }, hint: [], tests: [{ premises: { p: 'A', spare: 'A' }, goal: 'A' }] }
  const changeset = { ops: [{ op: 'level.replace', level, data: { ...data, tasks: [first, second] } }] }
  const request = { package: GAME, level, path: 'tasks[1].solution', changeset }

  const seed = await call('seed', request)
  assert.equal(seed.task, 1)
  assert.ok(seed.data.nodes.some((node) => node.id === 'spare'))
  const draw = await call('render', request)
  assert.equal(draw.text, second.solution.join('\n'))
  const gate = { id: second.id, kind: 'logic/gates', target: 'B', brief: second.brief, solution: ['out <- B'] }
  const gateChange = { ops: [{ op: 'level.replace', level, data: { ...data, tasks: [first, gate] } }] }
  const run = await call('run_tests', { ...request, changeset: gateChange })
  assert.equal(run.task, 1, JSON.stringify(run))
  assert.equal(run.pass, true, JSON.stringify(run))
  assert.match(run.tests[0].shows.en, /^B\b/)

  const wrong = { ...request, path: 'tasks[1].hint' }
  assert.match((await call('seed', wrong)).note, /has no board/)
  assert.match((await call('run_tests', wrong)).why, /has no board/)
})

test('the tools list, preview and write a package that no game selects', async () => {
  const pkg = join(root, 'packages', 'library')
  mkdirSync(join(pkg, 'i18n'), { recursive: true })
  const words = packageWordsFixture((path, value) => writeFileSync(join(root, path), JSON.stringify(value, null, 2) + '\n'), 'library')
  writeFileSync(join(pkg, 'package.json'), `${JSON.stringify({ kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: { circuit: '^0.0.0', logic: '^0.0.0', qed: '^0.0.0' }, ...words })}\n`)
  mkdirSync(join(pkg, 'parts'), { recursive: true })
  writeFileSync(join(pkg, 'parts/apply.json'), JSON.stringify( { name: 'Apply', desc: 'Apply an implication.', icon: 'GitFork', family: 'logic/rule', inputs: [{ name: 'imp', type: 'logic/judgment' }, { name: 'a', type: 'logic/judgment' }], outputType: 'logic/judgment', op: 'logic/mp' }))
  lockTarget({ kind: 'package', id: 'library' }, root)
  const packages = await call('packages', {})
  const library = packages.find(entry => entry.id === 'library')
  assert.equal(library.title.en, 'library')
  assert.equal(library.desc.zh, '测试包。')
  const preview = await call('preview', { package: 'library' })
  assert.equal(preview.ok, true, preview.problems.join('\n'))
  assert.deepEqual(preview.content.levels, [])
  assert.equal(preview.content.packageTarget.id, 'library')
  const modified = await call('modify', { package: 'library', changeset: { ops: [{ op: 'parts.set', path: ['parts', 'apply', 'desc'], value: 'A revised description.' }] } })
  assert.equal(modified.written, true, modified.problems.join('\n'))
  assert.deepEqual(modified.files, ['packages/library/parts/apply.json'])
  assert.equal((await call('log', { package: 'library' })).head, 1)
})


test('the single-level shell feeds the same package level to the screen and blind-play hooks', async () => {
  const level = `${GAME}/apply`
  const opened = await call('play_level', { package: GAME, level })
  assert.deepEqual(opened.content.standalone, { level })
  assert.deepEqual(opened.content.eras, [])
  assert.equal('chapters' in opened.content, false)
  assert.deepEqual(opened.content.levels.map(l => l.id), [level])
  const played = await call('run_tests', { package: GAME, level })
  assert.equal(played.covered, true, played.why)
  assert.equal(played.pass, true)
  const seeded = await call('seed', { package: GAME, level })
  assert.ok(seeded.data)
  await assert.rejects(() => call('play_level', { package: GAME, level: `${GAME}/missing` }), /missing/)
})

test('reading tools: vocabulary, audit, run_reference, run_tests, render, deps', async () => {
  const vocabulary = await call('vocabulary', { game: GAME })
  assert.deepEqual(vocabulary.modules, ['logic'])
  assert.ok(vocabulary.vocabulary.kinds.primitive && vocabulary.operations['task.move'].params.fields.to)

  const audit = await call('audit', { game: GAME })
  assert.equal(audit.ok, true, audit.failures.join('\n'))
  assert.ok(audit.lines.some((l) => l.startsWith(`${GAME}/suppose `)))

  assert.deepEqual(await call('run_reference', { game: GAME, level: 'apply' }), { ok: true, lines: [`${GAME}/apply Apply: solution PASS [2 steps]`] })

  const proof = await call('run_tests', { game: GAME, level: 'suppose' })
  assert.equal(proof.covered && proof.pass, true)
  assert.deepEqual(proof.tests.map(({ pass }) => pass), [true, true])
  assert.match(proof.tests[1].shows, /A → C/)

  assert.match((await call('render', { game: GAME, level: 'suppose' })).text, /^proofs\/suppose · Suppose\n[\s\S]*tasks\[0\]\.solution:\n {2}f = proofs\/impI/)
  assert.equal((await call('render', { game: GAME, level: 'suppose', format: 'png' })).rendered, false)
  assert.match((await call('deps', { game: GAME })).text, /^flowchart LR/)
})

test('modify refuses a failing changeset, previews a diff, and writes a passing one with its reason', async () => {
  const goal = { op: 'level.set', level: 'suppose', path: 'tasks[0].tests[0].goal', value: 'A → (B → C)' }
  // The reference no longer proves the new goal: refused, nothing written.
  const level = onDisk('levels/suppose.json')
  const refused = await call('modify', { package: GAME, changeset: { ops: [goal] } })
  assert.equal(refused.ok, false)
  assert.ok(refused.problems.some((p) => p.startsWith(`${GAME}/suppose`)), refused.problems.join('\n'))
  assert.equal(onDisk('levels/suppose.json'), level)

  const hint = { op: 'text.set', level: 'suppose', path: 'tasks[0].hint[0]', lang: 'en', value: 'Set the box’s assumption to “Today is Saturday”, the first half of the sentence.' }
  const preview = await call('modify', { package: GAME, changeset: { ops: [hint] }, dryRun: true })
  assert.equal(preview.ok && !preview.written, true)
  assert.match(preview.diff, new RegExp(`^--- a/packages/${GAME}/i18n/en.json`))
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
