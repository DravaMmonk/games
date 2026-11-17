// node --test games/kit/studio/pending-view.test.js — what an editor shows while its writes are pending.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pendingValue, writtenBy } from './pending-view.js'

test('an editor shows its own pending write, the value before writes taken back, else the preview', () => {
  const saved = [{ from: 'a', to: 'b' }]
  const one = { op: 'relation.set' }, two = { op: 'relation.set' }, other = { op: 'relation.set' }
  const store = new WeakMap()
  const { note, written } = writtenBy('r', store)
  note([one], [], saved)
  note([two], [{ from: 'b', to: 'c' }], [])
  const touches = (op) => op === other
  assert.deepEqual(pendingValue(saved, [one, two], [one], written, touches), [{ from: 'b', to: 'c' }])
  assert.deepEqual(pendingValue(saved, [one], [one, two], written, touches), [])
  // Both taken back while the preview still shows them: the value before the first.
  assert.deepEqual(pendingValue([{ from: 'b', to: 'c' }], [], [one, two], written, touches), saved)
  // Edited elsewhere after the editor's write: the preview's.
  assert.deepEqual(pendingValue(saved, [one, other], [one, other], written, touches), saved)
  assert.deepEqual(pendingValue(saved, [], [], written, touches), saved)
  // Another editor's writes are not this one's.
  assert.equal(writtenBy('s', store).written(one), null)
})
