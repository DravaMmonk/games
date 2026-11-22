import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defineCourse } from '../../core/course.js'
import { courseAdvisories } from '../../core/progression/advisories.js'

test('course advisories name crowded introductions, idle parts, unused builds and pass texts that link a part', () => {
  const levels = [{ id: 'demo/a' }, { id: 'demo/b' }, { id: 'demo/c' }]
  const by = table => ({ id }) => table[id] ?? []
  const course = defineCourse({
    levels,
    adds: by({ 'demo/a': ['demo/x', 'demo/y'], 'demo/b': ['demo/scene'] }),
    needed: ({ id }) => ({ 'demo/a': ['demo/x'], 'demo/b': ['demo/x', 'demo/scene'], 'demo/c': ['demo/used'] })[id] ?? null,
    builds: by({ 'demo/b': ['demo/used', 'demo/spare'] }),
    local: part => part === 'demo/scene',
  })
  const content = { levels: [
    { id: 'demo/a', after: { zh: '用到了<part-ref to="part:demo/x"></part-ref>。' }, tasks: [] },
    { id: 'demo/b', after: '好。', tasks: [{ after: { en: 'The <part-ref to="part:demo/x"></part-ref> did it.' } }] },
    { id: 'demo/c', tasks: [] },
  ] }
  assert.deepEqual(courseAdvisories({ spec: { course }, content }), [
    { rule: 'many-new', level: 'demo/a', says: 'demo/x, demo/y' },
    { rule: 'idle-idea', level: 'demo/a', says: 'demo/y' },
    { rule: 'unused', level: 'demo/b', says: 'demo/spare' },
    { rule: 'after-part', level: 'demo/a', says: 'after' },
    { rule: 'after-part', level: 'demo/b', says: 'tasks[0].after' },
  ])
})
