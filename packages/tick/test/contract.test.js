import test from 'node:test'
import assert from 'node:assert/strict'
import { createPluginKernel, evaluatePlay } from '../../../games/kit/engine/index.js'
import { taskReports } from '../../../games/kit/engine/baseline-reports.js'
import { pluginMeanings } from '../../../games/kit/engine/plugins.js'
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
  const work = busPlay.read(task.solution, context)
  const saved = busPlay.write(work)
  assert.deepEqual(busPlay.read(saved, context), work)
  assert.equal(evaluatePlay(kernel, task, saved, context).verdict.pass, true)
  const spec = runtime.spec(content)
  assert.deepEqual(await runtime.validate(spec), [{
    level: 'sample/one', fail: false, text: 'sample/one One: answer PASS (1 tests, 4 ticks), naive fails test 1',
  }])
  const agent = kernel.tables.agent.get('tick/board')
  assert.ok(agent.observe(context))
  assert.equal(agent.act(context, "bit <- line").pass, true)
  assert.equal(agent.act(context, "").pass, false)
})

test('the standalone baseline records a timed circuit verdict', async () => {
  const kernel = createPluginKernel()
  circuit(kernel.forPackage('circuit', 'core'))
  register(kernel.forPackage('tick', 'core'))
  const records = await taskReports(runtime.spec(content), pluginMeanings(kernel))
  assert.equal(records.length, 1)
  assert.equal(records[0].report.reference.report.pass, true)
  assert.equal(records[0].report.naive.report.pass, false)
})
