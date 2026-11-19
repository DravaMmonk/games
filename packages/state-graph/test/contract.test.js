import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { evaluatePlay } from '../../../games/kit/engine/plugin-runtime.js'
import { loadPlugins } from '../../../games/kit/engine/plugin-node.js'
import { runtimeFromPlugins } from '../../../games/kit/engine/runtime.js'
import { closeGames } from '../../../games/kit/engine/games.mjs'
import { tableFixture } from './fixture.js'
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
  const kernel = await loadPlugins(content, root)
  const runtime = runtimeFromPlugins(content, kernel)
  assert.deepEqual(await runtime.validate(runtime.spec(content)), [{ text: '2 runs' }])
  const good = evaluatePlay(kernel, task, task.solution, context)
  assert.equal(good.verdict.pass, true)
  const core = kernel.tables.play.get(task.play)
  assert.deepEqual(core.read(core.write(good.work), context), good.work)
  const agent = kernel.tables.agent.get(task.play)
  assert.equal(agent.observe(context).kind, 'circuit')
  assert.equal(agent.act(context, task.solution.join('\n')).pass, true)
  assert.equal(agent.act(context, task.naive.join('\n')).pass, false)
})

test('Studio reports the failed case of a prepared robot board', async () => {
  const { root, content } = fixture
  const previous = process.env.GAMES_ROOT
  process.env.GAMES_ROOT = root
  try {
    const { TOOLS } = await import('../../../games/kit/engine/ops/tools.js')
    const result = await TOOLS.run_tests.run({ game: content.id, level: content.levels[0].id, path: 'tasks[0].naive' })
    assert.equal(result.covered, true, result.why)
    assert.equal(result.refused, null)
    assert.equal(result.pass, false)
    assert.deepEqual(result.tests.map(({ pass }) => pass), [false])
  } finally {
    if (previous === undefined) delete process.env.GAMES_ROOT
    else process.env.GAMES_ROOT = previous
  }
})
