import assert from 'node:assert/strict'
import { test } from 'node:test'
import { courseLinks, courseRemoval, courseReorder, routeMove, singleLevelRemoval } from './course-impact.js'

const a = 'p/a', b = 'p/b', c = 'p/c', d = 'p/d'
const edge = (from, to) => ({ from, to })

test('deleting a chapter removes its transitive successors and patches only the affected rows', () => {
  const chapters = [
    { id: '@g/one', levels: [a] },
    { id: '@g/two', levels: [b, c, d], rows: [[b], [c, d]] },
  ]
  const plan = courseRemoval(chapters, [edge(a, b), edge(b, c), { ...edge(c, d), fromGame: 'other' }], [a], '@g/one')
  assert.deepEqual(plan.affected.map(({ ids }) => ids), [[a], [b, c]])
  assert.deepEqual(plan.ops, [
    { op: 'chapter.set', chapter: 'two', path: ['levels'], value: [d] },
    { op: 'chapter.set', chapter: 'two', path: ['rows'], value: [[null, d]] },
    { op: 'game.set', path: ['chapters'], value: ['@g/two'] },
    { op: 'chapter.remove', chapter: 'one' },
  ])
})

function setup(knowledge = false) {
  const first = { id: '@g/one', levels: [a] }
  const second = { id: '@g/two', levels: [b, c, d] }
  const edges = [edge(a, b), edge(a, c), edge(b, d)]
  const relation = { kind: 'requires', edges }
  const levels = [a, b, c, d].map(id => ({ id, ...(id === b && knowledge && { requires: [a] }) }))
  const content = {
    id: 'g', levels, relations: { 'p/route': relation },
    registries: { level: Object.fromEntries(levels.map(level => [level.id, level])) },
    eras: [
      { ...first, levels: [{ id: a }], links: [] },
      { ...second, levels: levels.slice(1), links: edges },
    ],
  }
  return [content, [first, second], [second, first]]
}

test('reorder removes all conflicting edges from one override without touching other prerequisites', () => {
  const [content, before, after] = setup()
  const plan = courseReorder(content, {}, courseLinks(content, {}), before, after)
  assert.deepEqual(plan.blocked, [])
  assert.deepEqual(plan.ops, [
    { op: 'override.put', layer: '@g', kind: 'relation', name: 'p/route', data: { edges: { remove: [edge(a, b), edge(a, c)] } } },
  ])
})

test('reorder reports an independent knowledge dependency even when an authored edge can be removed', () => {
  const [content, before, after] = setup(true)
  const plan = courseReorder(content, {}, courseLinks(content, {}), before, after)
  assert.deepEqual(plan.blocked.map(({ from, to, source }) => [from, to, source]), [[a, b, 'knowledge']])
})

test('moving a route card disconnects the exact course override and preserves other links', () => {
  const [content] = setup()
  const edgeWithFlag = { ...edge(a, b), required: true }
  const edges = [edgeWithFlag, edge(a, c), edge(b, d), { ...edge(a, b), game: 'other' }]
  content.relations['p/route'].edges = edges
  content.relationEdges = { requires: edges }
  const plan = routeMove(content, {}, [[a], [b, c], [d]], [[a, b], [c], [d]])
  assert.deepEqual(plan.removed, [edgeWithFlag])
  assert.deepEqual(plan.blocked, [])
  assert.deepEqual(plan.ops[0].data.edges, { remove: [edgeWithFlag] })
})

test('an indirect row conflict cuts a real link through an unplaced level', () => {
  const [content] = setup()
  content.relationEdges = { requires: content.relations['p/route'].edges }
  const plan = routeMove(content, {}, [[a], [c], [d]], [[d], [a], [c]])
  assert.deepEqual(plan.removed, [edge(b, d)])
  assert.deepEqual(plan.ops[0].data.edges, { remove: [edge(b, d)] })
})

test('a tag-generated row conflict is not written as a concrete edge removal', () => {
  const [content] = setup()
  content.relations['p/route'].edges = [edge('#p/group', b)]
  content.relationEdges = { requires: [edge(a, b)] }
  const plan = routeMove(content, {}, [[a], [b]], [[b], [a]])
  assert.deepEqual(plan, { removed: [], blocked: [edge(a, b)], ops: [] })
})

test('single-level removal cuts exact incident links and leaves dependent levels and their other links in the course', () => {
  const [content, chapters] = setup()
  chapters[1].rows = [[b, c], [d]]
  const plan = singleLevelRemoval(content, {}, chapters, courseLinks(content, {}), b)
  assert.deepEqual(plan.blocked, [])
  assert.deepEqual(plan.affected.map(({ ids }) => ids), [[b]])
  assert.deepEqual(plan.disconnected, [edge(a, b), edge(b, d)])
  assert.deepEqual(plan.ops, [
    { op: 'override.put', layer: '@g', kind: 'relation', name: 'p/route', data: { edges: { remove: [edge(a, b), edge(b, d)] } } },
    { op: 'chapter.set', chapter: 'two', path: ['levels'], value: [c, d] },
    { op: 'chapter.set', chapter: 'two', path: ['rows'], value: [[null, c], [d]] },
  ])
})

test('an independently required knowledge edge blocks single removal even when the authored link can be disconnected', () => {
  const [content, chapters] = setup(true)
  const links = courseLinks(content, {})
  const single = singleLevelRemoval(content, {}, chapters, links, a)
  assert.deepEqual(single.blocked.map(({ from, to, source }) => [from, to, source]), [[a, b, 'knowledge']])
  assert.deepEqual(single.ops, [])
  assert.deepEqual(courseRemoval(chapters, links, [a]).affected.map(({ ids }) => ids), [[a], [b, c, d]])
})
