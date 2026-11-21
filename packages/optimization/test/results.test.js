import assert from 'node:assert/strict'
import { test } from 'node:test'
import { completionResult } from 'kernel'
import { optimize } from '../core/index.js'

test('goals rank complete attempts independently with mixed directions and stable ties', () => {
  const objectives = optimize({
    'sample/quality': { rank: [{ metric: 'quality', direction: 'max' }, { metric: 'cost', direction: 'min' }], label: '{quality} · {cost}' },
    'sample/time': { rank: [{ metric: 'time', direction: 'min' }], label: '{time}' },
  })
  const incomplete = {}
  assert.equal(objectives.record(incomplete, completionResult({ quality: 4 })), incomplete)

  const first = objectives.record({}, completionResult({ quality: 4, cost: 8, time: 3 }))
  const second = objectives.record(first, completionResult({ quality: 5, cost: 12, time: 4 }))
  const third = objectives.record(second, completionResult({ quality: 5, cost: 9, time: 5 }))
  assert.equal(objectives.record(third, completionResult({ quality: 5, cost: 9, time: 6 })), third)
  assert.deepEqual(third, {
    'sample/quality': { values: { quality: 5, cost: 9, time: 5 } },
    'sample/time': { values: { quality: 4, cost: 8, time: 3 } },
  })
  assert.deepEqual(objectives.summary(third), { label: '{quality} · {cost}', values: { quality: 5, cost: 9, time: 5 } })
})
