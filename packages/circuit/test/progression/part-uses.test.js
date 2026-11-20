import { test } from 'node:test'
import assert from 'node:assert/strict'
import { partUses } from '../../core/progression/part-uses.js'

test('a part page lists the levels that bring in, give or award the part and its stages, in level order', () => {
  const content = {
    partDefs: { parts: { 'p/dm': { stages: [{ id: 'p/dm-two', afterTask: 'p/late-1' }, { id: 'dm-three' }] }, 'p/other': {} } },
    levels: [
      { id: 'p/first', adds: ['p/dm'], tasks: [{ id: 'p/first' }] },
      { id: 'p/late', tasks: [{ id: 'p/late-0', gives: ['p/other'] }, { id: 'p/late-1', awards: ['p/dm-three', 'p/other'] }] },
      { id: 'p/form', requiresObjects: ['p/dm.form'] },
    ],
  }
  assert.deepEqual(partUses(content, 'p/dm'), [
    { kind: 'adds', level: 'p/first', task: undefined, stage: 0, path: ['adds', 0] },
    { kind: 'awards', level: 'p/late', task: 1, stage: 2, path: ['tasks', 1, 'awards', 0] },
    { kind: 'after', level: 'p/late', task: 1, stage: 1, path: ['tasks', 1] },
    { kind: 'requiresObjects', level: 'p/form', task: undefined, stage: 0, path: ['requiresObjects', 0] },
  ])
  assert.deepEqual(partUses(content, 'p/missing'), [])
})
