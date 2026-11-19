import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defineCourse as defineCircuitCourse } from '../../core/index.js'
import { usable } from '../../core/course.js'
import { progressFieldsProblems } from '../../core/progress-fields.js'
import { defineCourse } from '../../core/progression/index.js'
import { courseChecks, referenceChecks } from '../../core/progression/content-checks.js'

const partPolicy = checks => ({ 'progress/policy': { parts: { kind: 'circuit/part', checks } } })

test('circuit offers the whole tray and progress limits it to held members', () => {
  const first = { id: 'first' }, second = { id: 'second' }
  const options = {
    levels: [first, second],
    parts: { outside: {}, early: {}, late: {} },
    primitives: ['outside', 'early', 'late'],
    adds: at => at.id === 'first' ? ['outside', 'early'] : ['late'],
    trays: { main: { items: ['late', 'early'] } },
    tray: () => 'main',
  }
  assert.deepEqual(usable(defineCircuitCourse(options), first), ['late', 'early'])
  const course = defineCourse(options)
  assert.deepEqual(usable(course, first), ['early'])
  assert.deepEqual(usable(course, second), ['late', 'early'])
})

test('a tray can include unlisted parts only under a grant policy', () => {
  const content = {
    levels: [{ id: 'level', adds: ['part'], tasks: [{ opens: ['upgraded'], setup: { stages: [] } }] }],
    registries: {
      'circuit/part': { part: { stages: [{ id: 'upgraded' }] } },
      'circuit/tray': { tray: { includeUnlisted: true } },
    },
  }
  assert.deepEqual(progressFieldsProblems(content).map(problem => problem.at), ['trays/tray.json.includeUnlisted'])
  content.registries['progress/policy'] = { parts: { kind: 'circuit/part', grants: true } }
  assert.deepEqual(progressFieldsProblems(content), [])
})

test('the reference check reports each unavailable part once per level across tasks and boards', () => {
  const board = (...types) => ({ nodes: types.map(type => ({ type })) })
  const first = { id: 'first', unlocks: ['early'] }
  const task = board('qualified', 'missing')
  const level = { id: 'lesson', tasks: [task, board('missing')] }
  const levels = [first, level]
  const course = defineCircuitCourse({
    levels,
    parts: { qualified: {}, missing: {}, hidden: {}, given: {} },
    available: () => [],
    gives: () => ['given'],
    boards: () => [task, board('hidden', 'given')],
  })
  course.availableParts = (_at, flags) => flags.has('early') ? ['qualified'] : []
  const content = { packageTarget: { id: 'sample' }, registries: partPolicy(['availability']) }
  const messages = courseChecks({ spec: { specs: [{ course, levels }, { course, levels: [level] }] }, content })
  assert.deepEqual(messages, ['missing', 'hidden'].map(part => ({
    fail: true, level: level.id, text: `lesson: circuit/part ${part} is unavailable to the reference work`,
  })))
})

test('part links accept the earliest unlock or declared placement', () => {
  const game = {
    levels: [{ id: 'intro' }, { id: 'first', unlocks: ['by-unlock'] }, { id: 'later', unlocks: ['by-placement'] }],
    parts: { all: [{ key: 'by-placement', at: ['later', 'first'] }, { key: 'by-unlock', at: ['later'] }] },
  }
  const links = ['by-placement', 'by-unlock']
  const order = ['intro', 'first', 'later']
  const lines = referenceChecks({
    game, content: { registries: partPolicy(['references']) },
    opensBy: (earned, at) => order.indexOf(earned) <= order.indexOf(at),
    levelLinks: () => order.map(id => [id, links]),
  })
  assert.deepEqual(lines, links.map(key => ({ fail: true, text: `intro links the part ${key}, earned later (at first)` })))
})
