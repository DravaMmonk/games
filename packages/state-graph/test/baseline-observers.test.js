import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tableReports } from '../core/baseline.js'
import { imageReports } from '../../image/core/baseline.js'
import { taskReports } from '../../../games/kit/engine/baseline-reports.js'

test('task observations retain passing/failed hand steps and hidden image traces', async () => {
  const hand = { id: 'tiny', taskId: 'hand', play: 'state-graph/fill', cells: [{ id: 's' }, { id: 'e' }], edges: [['s', 'e']], start: 's', end: 'e' }
  const [observed] = await taskReports({ levels: [{ id: 'tiny' }], table: { played: new Map([['tiny', [hand]]]) } }, [{ baselineReports: tableReports }])
  assert.equal(observed.report.reference.report.pass, true)
  assert.equal(observed.report.naive.report.pass, false)
  assert.equal(observed.report.reference.report.steps.length, 2)
  let tested
  const [image] = await taskReports({ levels: [{ id: 'tiny', tasks: [{ id: 'g', kind: 'image/graph', solution: 'yes', naive: 'no', tests: [{ n: 1 }], hidden: [{ n: 2 }] }] }], kit: { runLevel: (task, work, options) => { tested = task.tests; return { pass: work === 'yes', trace: options.traced ? ['step'] : [] } } } }, [{ baselineReports: imageReports }])
  assert.deepEqual(tested, [{ n: 1 }, { n: 2, hidden: true }])
  assert.deepEqual(image.report.reference.report.trace, ['step'])
  assert.equal(image.report.naive.report.pass, false)
})

