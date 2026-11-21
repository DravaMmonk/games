import { test } from 'node:test'
import assert from 'node:assert/strict'
import { latestRequest } from './latest-request.js'

test('a slow preview leaves room for only the newest waiting draft', async () => {
  const schedule = latestRequest()
  const gate = Promise.withResolvers()
  const seen = []
  const completed = schedule(async () => {
    seen.push('first')
    await gate.promise
  })
  await schedule(() => seen.push('superseded'))
  await schedule(() => seen.push('latest'))
  assert.deepEqual(seen, ['first'])
  gate.resolve()
  await completed
  assert.deepEqual(seen, ['first', 'latest'])
})
