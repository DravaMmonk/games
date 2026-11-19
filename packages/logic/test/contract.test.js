import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { proofsRoot } from '../../qed/test/fixture.js'
import { readContent, readPackage, runtimeOf } from '../../../games/kit/engine/resolver.js'
import { packageLevel } from '../../../games/kit/engine/package-play.js'
import { loadPlugins } from '../../../games/kit/engine/plugin-node.js'
import { evaluatePlay } from '../../../games/kit/engine/plugin-runtime.js'
import { closeGames, gameOf } from '../../../games/kit/engine/games.mjs'

// Both contracts read the same synthetic proof course without writing it.
const { root, id } = proofsRoot()
after(() => rmSync(root, { recursive: true, force: true }))

test('logic core checks a standalone proof and exposes deterministic work and blind-play protocols', async () => {
  const content = readContent(id, root)
  const runtime = await runtimeOf(content, root)
  assert.deepEqual((await runtime.validate(runtime.spec(content))).filter(line => line.fail), [])
  const shell = packageLevel(readPackage(id, root), `${id}/apply`)
  const task = shell.levels[0].tasks[0]
  const kernel = await loadPlugins(shell, root)
  const protocol = kernel.tables.play.get(task.kind)
  const context = { content: shell, task }
  const reference = protocol.read(task.solution, context)
  assert.deepEqual(protocol.read(protocol.write(reference), context), reference)
  assert.equal(protocol.judge(protocol.run(reference, context)).pass, true)
  assert.equal(protocol.judge(protocol.run(protocol.read(['goal <- r'], context), context)).pass, false)
  const agent = kernel.tables.agent.get(task.kind)
  assert.ok(agent.observe(context))
  assert.equal(agent.act(context, task.solution.join('\n')).pass, true)
  assert.equal(agent.act(context, 'goal <- r').pass, false)
  assert.deepEqual(protocol.run(reference, context), protocol.run(reference, context))
  const mixed = { ...shell, levels: shell.levels.map(level => ({ ...level, tasks: [...level.tasks, { id: 'foreign', play: 'circuit/board' }] })) }
  assert.equal(protocol.judge(protocol.run(reference, { ...context, content: mixed })).pass, true)
})

test('logic core and view compose with circuit and QED through Vite and render a proof', async () => {
  try {
    const content = readContent(id, root)
    const game = await gameOf(content, { view: true })
    const kernel = game.pluginKernel
    const task = content.levels[0].tasks[0]
    const context = { content, task, kernel }
    const require = createRequire(new URL('../../../site/package.json', import.meta.url))
    const { renderToString } = require('react-dom/server')
    const { createElement } = require('react')
    const view = kernel.tables.playView.get('logic/proof')
    const work = kernel.tables.play.get('logic/proof').initial(context)
    assert.match(renderToString(createElement(view.preview, { context, work, onChange() {} })), /class="cl-board"/)
    // The generic evaluator uses the same registered play when tasks declare it explicitly.
    assert.equal(evaluatePlay(kernel, { ...task, play: task.kind }, task.solution, context).verdict.pass, true)
  } finally { await closeGames() }
})
