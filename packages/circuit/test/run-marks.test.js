import assert from 'node:assert/strict'
import { test } from 'node:test'
import { workSignature } from '../core/stamp.js'
import { completedRun, markForWork } from '../../../games/kit/shell/run-marks.js'

test('a run mark follows the judged wiring and settings across changes to board presentation', () => {
  const input = { id: 'in', type: 'input', x: 0, params: { value: 2, enabled: true } }
  const out = { id: 'out', type: 'output' }
  const wire = { from: 'in', to: 'out', port: 'in' }
  const board = { nodes: [input, out], wires: [wire] }
  const mark = { workKey: workSignature(board), mark: completedRun }
  const laidOut = { ...board, nodes: [{ ...input, x: 120, slot: 3, params: { enabled: true, value: 2 } }, out], blocks: [{ nodes: ['in'] }] }
  assert.equal(markForWork(mark, workSignature(laidOut)), completedRun)
  assert.equal(markForWork(mark, workSignature({ ...board, wires: [] })), undefined)
  const edited = { ...board, nodes: [{ ...input, params: { ...input.params, value: 3 } }, out] }
  assert.equal(markForWork(mark, workSignature(edited)), undefined)
})
