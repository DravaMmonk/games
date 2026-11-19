import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { proofsRoot } from '../../qed/test/fixture.js'
import { readPackage } from '../../../games/kit/engine/resolver.js'
import { packageLevel } from '../../../games/kit/engine/package-play.js'
import { loadPlugins } from '../../../games/kit/engine/plugin-node.js'
import { runtimeFromPlugins } from '../../../games/kit/engine/runtime.js'

let fixture
before(() => { fixture = proofsRoot() })
after(() => { if (fixture) rmSync(fixture.root, { recursive: true, force: true }) })

test('logic core checks a standalone proof and exposes deterministic work and blind-play protocols', async () => {
  const { root, id } = fixture
  const shell = packageLevel(readPackage(id, root), `${id}/apply`)
  const task = shell.levels[0].tasks[0]
  const kernel = await loadPlugins(shell, root)
  const runtime = runtimeFromPlugins(shell, kernel)
  assert.deepEqual(await runtime.validate(runtime.spec(shell)), [{
    level: `${id}/apply`, fail: false, text: `${id}/apply Apply: solution PASS [2 steps]`,
  }])
  const protocol = kernel.tables.play.get(task.kind)
  const context = { content: shell, task }
  const reference = protocol.read(task.solution, context)
  assert.deepEqual(protocol.read(protocol.write(reference), context), reference)
  const report = protocol.run(reference, context)
  assert.equal(protocol.judge(report).pass, true)
  const agent = kernel.tables.agent.get(task.kind)
  assert.equal(agent.observe(context).kind, 'circuit')
  assert.equal(agent.act(context, task.solution.join('\n')).pass, true)
  assert.equal(agent.act(context, 'goal <- r').pass, false)
  assert.deepEqual(protocol.run(reference, context), report)
  const mixed = { ...shell, levels: shell.levels.map(level => ({ ...level, tasks: [...level.tasks, { id: 'foreign', play: 'circuit/board' }] })) }
  assert.equal(protocol.judge(protocol.run(reference, { ...context, content: mixed })).pass, true)
})
