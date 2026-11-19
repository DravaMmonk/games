import test from 'node:test'
import assert from 'node:assert/strict'
import { createPluginKernel } from '../../../games/kit/engine/plugins.js'
import { evaluatePlay } from '../../../games/kit/engine/plugin-runtime.js'
import { register as registerScalar } from '../../numlib/core/index.js'
import { register } from '../core/index.js'
import { boardPlay } from '../core/board-play.js'

const fixture = () => {
  const parts = { 'sample/add': { name: 'Add', desc: 'Add inputs', family: 'circuit/value', icon: 'Plus', op: 'numlib/add' } }
  return {
    id: 'sample', title: 'Sample', eras: [], trays: {},
    standalone: { level: 'sample/sum' }, glossary: { groups: [], entries: [] },
    partDefs: { parts }, registries: { 'circuit/part': parts },
    levels: [{ id: 'sample/sum', title: 'Sum', tasks: [{
      id: 'sample/task', play: 'circuit/board', brief: 'Add both inputs',
      inputs: [{ name: 'a', label: 'A' }, { name: 'b', label: 'B' }], outputs: [{ name: 'out', label: 'Result' }],
      tests: [{ inputs: { a: 2, b: 0 }, expect: { out: 2 } }],
      hidden: [{ inputs: { a: -1, b: 4 }, expect: { out: 3 } }],
      solution: ['sum = sample/add(a, b)', 'out <- sum'], naive: ['out <- a'],
    }] }],
  }
}

test('circuit core registers, checks, round-trips and blind-plays in Node', async () => {
  const content = fixture()
  const kernel = createPluginKernel()
  register(kernel.forPackage('circuit', 'core'))
  registerScalar(kernel.forPackage('numlib', 'core'))
  assert.deepEqual(await kernel.checks({ content }), [{
    plugin: 'circuit/boards', level: 'sample/sum', fail: false, text: 'sample/task: circuit reference and naive PASS',
  }])
  const task = content.levels[0].tasks[0]
  const context = { content, task }
  const start = boardPlay.initial(context)
  assert.equal(start.nodes.length, 3)
  const graph = boardPlay.read(task.solution, context)
  assert.deepEqual(boardPlay.read(boardPlay.write(graph), context), graph)
  assert.deepEqual(evaluatePlay(kernel, task, task.solution, context).verdict, { pass: true, score: 1 })
  const naive = evaluatePlay(kernel, task, task.naive, context)
  assert.deepEqual(naive.report.runs.map(run => run.outputs.out), [2, -1])
  assert.equal(naive.report.fail.check, 1)
  assert.equal(naive.verdict.pass, false)
  const agent = kernel.tables.agent.get('circuit/board')
  const { brief, inputs, outputs } = task
  assert.deepEqual(agent.observe(context), { brief, inputs, outputs })
  const attempt = agent.act(context, task.solution)
  assert.deepEqual(attempt, { work: graph, verdict: { pass: true, score: 1 } })

  // Reusing an authored object must pick up an edited hidden case on the next evaluation.
  task.hidden[0].expect.out = 4
  const changed = evaluatePlay(kernel, task, task.solution, context)
  assert.equal(changed.verdict.pass, false)
  assert.equal(changed.report.fail.check, 1)
  assert.deepEqual(await kernel.checks({ content }), [{
    plugin: 'circuit/boards', level: 'sample/sum', fail: true, text: 'sample/task: circuit reference and naive FAIL',
  }])
})
