// Studio tools that exercise game assembly and the play hooks through Vite.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { readContent, contentLayers } from '../../../games/kit/engine/resolver.js'
import { packageEntries } from '../../../games/kit/engine/plugin-node.js'
import { closeGames, loadModule } from '../../../games/kit/engine/games.mjs'
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
  await assert.rejects(() => call('play_level', { package: GAME, level: `${GAME}/missing` }), /missing/)
})

test('game audit reports check lines and run_tests reports each proof case', async () => {

  const audit = await call('audit', { game: GAME })
  assert.equal(audit.ok, true, audit.failures.join('\n'))
  assert.ok(audit.lines.some((l) => l.startsWith(`${GAME}/suppose `)))

  const proof = await call('run_tests', { game: GAME, level: 'suppose' })
  assert.equal(proof.covered && proof.pass, true)
  assert.deepEqual(proof.tests.map(({ pass }) => pass), [true, true])
  assert.match(proof.tests[1].shows, /A → C/)

})
