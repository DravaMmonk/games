import test from 'node:test'
import assert from 'node:assert/strict'
import { createPluginKernel, evaluatePlay } from '../../../games/kit/engine/index.js'
import { packageCodeProblems, installPackageImports } from '../../../games/kit/engine/plugin-boundaries.js'
import { register as circuit } from '../../circuit/core/index.js'
import { register, busPlay, runtime } from '../core/index.js'

import { content, task } from './contract-fixture.js'

test('tick core registers, checks, round-trips and blind-plays in Node', async () => {
  installPackageImports()
  assert.deepEqual(packageCodeProblems('tick', new URL('../../../', import.meta.url).pathname), [])
  const kernel = createPluginKernel()
  circuit(kernel.forPackage('circuit', 'core'))
  register(kernel.forPackage('tick', 'core'))
  const context = { content, task }
  const reference = task.solution
  const naive = task.naive
  const work = busPlay.read(reference, context)
  assert.deepEqual(busPlay.read(busPlay.write(work), context), work)
  assert.equal(evaluatePlay(kernel, task, reference, context).verdict.pass, true)
  assert.equal(evaluatePlay(kernel, task, naive, context).verdict.pass, false)
  const spec = runtime.spec(content)
  assert.deepEqual((await runtime.validate(spec)).filter(line => line.fail), [])
  const agent = kernel.tables.agent.get('tick/board')
  assert.ok(agent.observe(context))
  assert.equal(agent.act(context, "bit <- line").pass, true)
  assert.equal(agent.act(context, "").pass, false)
})

test('standalone baseline uses the tick runner for each packaged level', async () => {
  const { readPackage, runtimeOf } = await import('../../../games/kit/engine/resolver.js')
  const { contentSchemas } = await import('../../../games/kit/engine/content.js')
  const { packageLevel } = await import('../../../games/kit/engine/package-play.js')
  const { taskReports } = await import('../../../games/kit/engine/baseline-reports.js')
  const root = new URL('../../../', import.meta.url).pathname
  const content = readPackage('tick', root)
  const runtime = await runtimeOf(content, root)
  for (const level of content.levels) {
    const records = await taskReports(runtime.spec(packageLevel(content, level.id)), contentSchemas.get(content).meanings)
    assert.equal(records.length, level.tasks.length)
    assert.ok(records.every(record => record.report.reference.report.pass), level.id)
  }
})
