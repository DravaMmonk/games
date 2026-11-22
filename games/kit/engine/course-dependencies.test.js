import assert from 'node:assert/strict'
import { test } from 'node:test'
import { coursePrerequisiteWarnings } from './course-dependencies.js'

test('route audits flag redundant local links only when another route guarantees the prerequisite', () => {
  const levels = ['start', 'middle', 'optional', 'alternate', 'end'].map(id => ({
    id, skippable: id === 'optional',
  }))
  const link = (from, to, options) => ({ from, to, ...options })
  const content = { eras: [{ id: 'main', levels, links: [
    link('start', 'middle'),
    link('middle', 'optional'),
    link('optional', 'alternate'),
    link('alternate', 'end'),
    link('start', 'end'),
    link('optional', 'end', { required: true }),
    link('middle', 'end', { fromGame: 'other' }),
  ] }] }

  assert.deepEqual(coursePrerequisiteWarnings(content), [{
    warn: true, rule: 'redundant-prerequisite', level: 'end',
    text: 'end: the direct prerequisite start is redundant because alternate already requires it',
  }])
})
