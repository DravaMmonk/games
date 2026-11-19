import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { stepOf } from './steps.js'
import { testProject } from '../engine/test-fixture.js'

test('the queue reports one copy of shared findings and retains distinct findings at the same location', async () => {
  const blueprint = { rule: 'bp-missing', at: 'sample', says: 'no blueprint' }
  const check = { rule: 'check', at: 'sample/one', says: 'reference failed' }
  const pedagogy = { rule: 'progression', at: 'sample/one', says: 'missing prerequisite' }
  const terminology = [
    { rule: 'term', at: 'sample/one', says: 'undefined input name' },
    { rule: 'term', at: 'sample/one', says: 'undefined output name' },
  ]
  const inspection = {
    id: 'sample',
    content: { id: 'sample' },
    noBlueprint: () => blueprint,
    domain: async () => ({}),
    spec: async () => ({}),
    checks: async () => [check],
    conformance: async () => [blueprint],
    pedagogy: async () => ({ failures: [pedagogy], reports: [] }),
    terminology: async () => ({ failures: terminology }),
  }
  const result = await stepOf('queue').gate(inspection, { steps: { review: { runs: [{ findings: [] }] } } })
  assert.deepEqual(result, {
    failures: [
      { ...blueprint, rule: 'blueprint:bp-missing' },
      { ...check, rule: 'domain:check' },
      { ...pedagogy, rule: 'levels:progression' },
      ...terminology.map(item => ({ ...item, rule: 'copy:term' })),
    ],
    reports: [],
  })
})

test('the domain gate reports the owning package and the nested contract failure', async t => {
  const { root, put } = testProject('games-domain-contract-')
  const previous = process.env.GAMES_ROOT
  process.env.GAMES_ROOT = root
  t.after(() => {
    if (previous === undefined) delete process.env.GAMES_ROOT
    else process.env.GAMES_ROOT = previous
    rmSync(root, { recursive: true, force: true })
  })
  put('packages/sample/test/nested/board.test.mjs', `
    import test from 'node:test'
    test('nested board contract', () => { throw new Error('output port was missing') })
  `)
  const inspection = {
    content: { levels: [{ tasks: [{ play: 'sample/board' }] }] },
    domain: async () => ({}),
    spec: async () => ({}),
    checks: async () => [],
  }
  const { failures } = await stepOf('domain').gate(inspection)
  assert.equal(failures.length, 1)
  assert.equal(failures[0].rule, 'package-test')
  assert.equal(failures[0].at, 'sample')
  assert.match(failures[0].says, /nested board contract/)
  assert.match(failures[0].says, /output port was missing/)
})
