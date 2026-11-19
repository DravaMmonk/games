// node --test (npm test) — which levels' kept checks a change reaches (check-cache.js), on a small course written here.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkCache, levelKeys } from './check-cache.js'

const level = (id, answer, title = id) => ({ id, title: { zh: title }, answer, tasks: [{ id: `${id}t`, answer }] })
const content = (levels) => ({ id: 'toy', domain: 'toy', levels })
// a → b → c, and d on its own branch after a.
const course = {
  index: new Map(['a', 'b', 'c', 'd'].map((id, k) => [id, k])),
  before: (x, y) => ({ b: ['a'], c: ['a', 'b'], d: ['a'] }[y] ?? []).includes(x),
}
const keys = (levels) => levelKeys(content(levels), course).keys
const changed = (before, after) => [...before.keys()].filter((id) => before.get(id) !== after.get(id))
const base = [level('a', 1), level('b', 2), level('c', 3), level('d', 4)]

test('a level’s own words change only its own key', () => {
  assert.deepEqual(changed(keys(base), keys([level('a', 1, 'renamed'), ...base.slice(1)])), ['a'])
})

test('a level’s answer changes its key and those of the levels after it, not those beside it', () => {
  assert.deepEqual(changed(keys(base), keys([base[0], level('b', 9), ...base.slice(2)])), ['b', 'c'])
  assert.deepEqual(changed(keys(base), keys([level('a', 9), ...base.slice(1)])), ['a', 'b', 'c', 'd'])
})

test('the game around its levels changes every key', () => {
  const other = levelKeys({ ...content(base), registries: { tag: { 'circuit/part:circuit/primitives': { kind: 'circuit/part', values: ['x'] } } } }, course).keys
  assert.deepEqual(changed(keys(base), other), ['a', 'b', 'c', 'd'])
})

test('a saved task check is reused across reads and invalidated by its prerequisites', t => {
  const directory = mkdtempSync(join(tmpdir(), 'games-check-cache-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const open = options => checkCache('toy', { directory, ...options })
  const original = open()
  const memo = original.memo(content(base), { course })
  const lines = [{ level: 'b', text: 'checked task' }]
  assert.deepEqual(memo('bt', 'proof', () => lines), lines)
  assert.deepEqual(memo('bt', 'proof', () => assert.fail('rechecked in the same run')), lines)
  original.save()

  const next = open()
  const read = levels => next.memo(content(levels), { course })
  const renamed = [level('a', 1, 'renamed'), ...base.slice(1)]
  assert.deepEqual(read(renamed)('bt', 'proof', () => assert.fail('rechecked after a wording edit')), lines)
  assert.deepEqual(read(base)('bt', 'schema', () => [{ text: 'different check' }]), [{ text: 'different check' }])
  const revised = [level('a', 9), ...base.slice(1)]
  assert.deepEqual(read(revised)('bt', 'proof', () => [{ text: 'ran again' }]), [{ text: 'ran again' }])
  const fresh = open({ fresh: true }).memo(content(base), { course })
  assert.deepEqual(fresh('bt', 'proof', () => []), [])
})

test('a cache with an invalid disk payload reruns the check', t => {
  const directory = mkdtempSync(join(tmpdir(), 'games-check-cache-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  for (const payload of ['{', 'null', '42', '[]']) {
    writeFileSync(join(directory, 'toy.json'), payload)
    const cache = checkCache('toy', { directory })
    const lines = [{ text: 'recomputed' }]
    assert.deepEqual(cache.memo(content(base), { course })('bt', 'proof', () => lines), lines, payload)
  }
})
