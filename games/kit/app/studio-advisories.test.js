import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { adviceLine, settledStore } from './studio-advisories.js'
import { TOOLS } from '../engine/ops/tools.js'

test('a decision on an advisory is kept until it is reopened', () => {
  const store = settledStore(join(mkdtempSync(join(tmpdir(), 'advisories-')), 'kept', 'advisories.json'))
  assert.deepEqual(store.read(), {})
  assert.deepEqual(Object.keys(store.update(['a', 'b'])), ['a', 'b'])
  assert.deepEqual(Object.keys(store.update([], ['a'])), ['b'])
  const found = { id: 'b', rule: 'copy-length', level: 'demo/one', path: 'title', says: 'title zh 8/6' }
  assert.deepEqual(adviceLine(found, store.read()), {
    advice: true, id: 'b', rule: 'copy-length', level: 'demo/one', levels: ['demo/one'], text: 'demo/one title: title zh 8/6', settled: true,
    problem: { rule: 'copy-length', object: { kind: 'level', name: 'demo/one' }, path: 'title' },
  })
})

test('the operation tools offer no advisory', () => {
  assert.deepEqual(Object.keys(TOOLS).filter(name => /advis/.test(name)), [])
})
