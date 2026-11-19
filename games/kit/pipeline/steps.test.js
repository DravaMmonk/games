import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stepOf } from './steps.js'

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
