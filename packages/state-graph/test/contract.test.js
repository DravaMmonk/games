import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { evaluatePlay } from '../../../games/kit/engine/plugin-runtime.js'
import { loadPlugins } from '../../../games/kit/engine/plugin-node.js'
import { runtimeOf } from '../../../games/kit/engine/resolver.js'
import { loadModule, closeGames } from '../../../games/kit/engine/games.mjs'
import { tableFixture } from './fixture.js'
import { resolve } from 'node:path'
import { robotOf } from '../../table/core/model/robots.js'
import { WORLDS } from '../core/model/worlds.js'
let fixture
before(() => { fixture = tableFixture() })
after(async () => {
  try {
    await closeGames()
  } finally {
    fixture?.cleanup()
  }
})

test('table consumer registers, checks, round-trips and blind-plays in Node', async () => {
  const { content, root } = fixture
  const task = content.levels[0].tasks[0]
  const context = { content, task }
  const runtime = await runtimeOf(content, root)
  assert.deepEqual((await runtime.validate(runtime.spec(content))).filter(line => line.fail), [])
  const kernel = await loadPlugins(content, root)
  const good = evaluatePlay(kernel, task, task.solution, context)
  assert.equal(good.verdict.pass, true)
  assert.equal(evaluatePlay(kernel, task, task.naive, context).verdict.pass, false)
  const core = kernel.tables.play.get(task.play)
  assert.deepEqual(core.read(core.write(good.work), context), good.work)
  const agent = kernel.tables.agent.get(task.play)
  assert.equal(agent.observe(context).kind, 'circuit')
  assert.equal(agent.act(context, task.solution.join('\n')).pass, true)
  assert.equal(agent.act(context, task.naive.join('\n')).pass, false)
})

test('table and state-graph core/view compose with circuit and image', async () => {
  const { content, root } = fixture
  const kernel = await loadPlugins(content, root, loadModule, true)
  const task = content.levels[0].tasks[0]
  const context = { content, task, kernel }
  const require = createRequire(new URL('../../../site/package.json', import.meta.url))
  const { renderToString } = require('react-dom/server')
  const { createElement } = require('react')
  const { preview } = kernel.tables.playView.get(task.play)
  const html = renderToString(createElement(preview, { context, work: kernel.tables.play.get(task.play).initial(context), onChange: () => {} }))
  assert.match(html, /class="cl-board"/)
})

test('the robot window shows intrinsic sweep values and recorded table values', async () => {
  const { robotWindow } = await loadModule(resolve(import.meta.dirname, '../../table/view/ui/robotDrawing.js'))
  const world = WORLDS['state-graph/parts']
  const picture = robotWindow({
    world, test: { s: 'cats', dict: { cats: 0, ats: 2 } }, robot: robotOf('state-graph/broom'),
    task: { facts: [], given: { offers: { view: ['seg', 'cost'], facts: [] } } },
    cell: { i: 4, id: '4' }, shown: new Map([['0', 5], ['1', null]]), reads: new Set(['0', '2']),
    empty: new Set(['2']), lit: ['cost'],
  })
  const [prior, cost] = picture.win.arm.sweeps
  assert.deepEqual(cost.cells.map(({ value }) => value), ['0', '2', '—', '—'])
  assert.deepEqual(prior.cells.map(({ value, state }) => [value, state]), [['5', 'read'], ['—', ''], ['', 'empty'], ['', '']])
})
