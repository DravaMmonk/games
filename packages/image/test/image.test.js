import { withProgressFixture } from '../../qed/test/fixture.js'
// The image board as content and saves hold it: blueprint text both ways (a course's references too), how a board
// read from text is laid out, and a packed part running the player's own circuit, on a course written here; and a
// course read, of that course and of every image game, writing nothing into its content.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deepFreeze } from '../../../games/kit/engine/content.js'
import { captureWorkshop, publishWorkshop, workshopIdentity } from '../../workshop/core/workshop.js'
import { packedBoards } from 'circuit'
import { courseWorkshop } from '../../workshop/core/workshop-view.js'
import { fresh as freshBoardProgress } from '../../circuit/core/progress.js'
import { fromFn } from 'imglib'
import { MATCHING } from '../core/engine/parts/matching.js'
import { imageDefinitions } from '../core/engine/definitions.js'
import { picture } from '../core/items/pictures.js'
import { constraintOf, depthOf } from '../core/items/constraints.js'
import { imageWorks } from '../core/work.js'
import { imageBoards } from '../core/engine/board-view.js'
import { play } from '../core/play.js'

// A course of three levels: one a built part runs, one holds that part, one is two tasks.
const L = (s) => ({ zh: s, en: s })
const square = { "image/square": { x0: 4, y0: 4, s: 8 } }
const filter = (id, rest) => ({ id, kind: 'image/graph', brief: L('b'), scene: "image/filter", setup: { target: "image/same" }, tests: [{ label: L('t'), in: square }], ...rest })
const level = (id, tasks, once = {}) => ({ id, title: L(id), after: L('a'), intro: [{ t: L('i') }], ...once, tasks })
const wide = ['l = image/shift[dir=left](in)', 'r = image/shift[dir=right](in)', 'h = image/max(l, r)', 'out <- h']
const content = deepFreeze(withProgressFixture({
  registries: { tag: { 'circuit/part:circuit/primitives': { kind: 'circuit/part', values: ["image/const", "image/add", "image/sub", "image/mul", "image/arith", "image/merge"] } } },
  eras: [{ id: 0, levels: [{ id: 'wide' }, { id: 'use' }, { id: 'two' }], links: [{ from: 'wide', to: 'use' }, { from: 'use', to: 'two' }], chapter: { title: L('c'), label: L('l'), question: L('q') } }],
  levels: [
    level('wide', [filter('wide', { solution: wide, publishes: [{ part: 'widen', variant: 'base' }] })]),
    level('use', [filter('use', { solution: ['k = image/const[c="pi/8"]()', 'm = image/arith[op=mul](in, k)', 'p = widen(m)', 'out <- p'], naive: ['out <- in'] })]),
    level('two', [filter('two_1', { solution: ['s = image/shift[dir=up, n=2](in)', 'out <- s'] }), filter('two_2', { carries: true, solution: ['t = image/threshold[t=0.3](in)', 'out <- t'] })], { adds: ["image/shift"] }),
  ],
  partDefs: { parts: {
    widen: { name: L('p'), desc: L('d'), inside: [{ id: 'base', reference: { solution: wide } }] },
    'library/proof': { name: L('Proof'), outputType: 'logic/judgment', inside: [{ id: 'base', reference: { kind: 'logic/proof', solution: ['goal <- p'] } }] },
  } },
}))
const image = imageWorks(content)
const { fromText, toText } = image.kit

test('image boards accept compatible parts from other packages and filter foreign port signatures', () => {
  const input = { name: 'in', type: 'logic/judgment' }
  const proof = { name: L('Proof'), inputs: [input], outputType: 'logic/judgment' }
  const { types } = imageDefinitions({ parts: {
    'filters/rectifier': { name: L('Rectifier'), op: 'image/relu' },
    'proofs/rule': proof,
    'proofs/box': { ...proof, regions: [{ name: 'body', type: 'logic/judgment' }] },
  } })
  assert.deepEqual(types['filters/rectifier'].inputs, ['in'])
  assert.deepEqual([...types['filters/rectifier'].eval({ in: fromFn(2, 1, x => x ? 2 : -1) }).data], [0, 2])
  assert.equal(types['proofs/rule'], undefined)
  assert.equal(types['proofs/box'], undefined)
})

test('matching reports degenerate homographies and returns an empty mask for sparse lines', () => {
  assert.throws(() => MATCHING.homography.eval({ pairs: { w: 4, data: [0, 0, 0, 0] } }, { k: 10 }), /do not fix a homography/)
  const onePoint = fromFn(2, 2, (x, y) => Number(!x && !y))
  assert.deepEqual(Array.from(MATCHING.ransac.eval({ in: onePoint }, { k: 10 }).data), [0, 0, 0, 0])
})

test('blueprint text reads into a board and writes back the same', () => {
  const lines = ['k = image/const[c="pi/8"]()', 's = image/shift[dir=left, n=2](in)', 'm = image/arith[op=mul](s, k)', 'out <- m']
  const b = fromText(lines)
  assert.deepEqual(b.nodes.find((n) => n.id === 's').params, { dir: 'left', n: 2, border: 'zero' })
  assert.equal(b.nodes.find((n) => n.id === 'k').params.c, Math.PI / 8)
  assert.deepEqual(b.wires.filter((w) => w.to === 'm'), [{ from: 's', to: 'm', port: 'a' }, { from: 'k', to: 'm', port: 'b' }])
  assert.deepEqual(toText(b), lines)
})

test('a frozen course prepares tasks and round-trips task and packed reference boards', () => {
  for (const raw of content.levels) {
    const played = image.levelById[raw.id]
    assert.deepEqual(played.tasks.map((t) => t.key), raw.tasks.map((t) => t.id))
    for (const [k, task] of raw.tasks.entries()) {
      assert.ok(Array.isArray(played.tasks[k].palette), task.id)
      assert.deepEqual(toText(played.tasks[k].solution), task.solution, task.id)
    }
  }
  assert.deepEqual(toText(image.kit.types.widen.circuitOf()), content.partDefs.parts.widen.inside[0].reference.solution)
  assert.equal(image.kit.partOf('library/proof'), null)
})

test('a packed part runs the circuit the player passed its level with, in its own course only', () => {
  const input = { in: picture("image/square") }
  const runOf = (course) => {
    const { solution } = course.levelById.use.tasks[0]
    return () => Array.from(course.kit.evaluate(solution, input).outputs.out.data)
  }
  const run = runOf(image)
  const reference = run()
  image.syncOwn({ wide: fromText(['out <- in']) })
  assert.notDeepEqual(run(), reference)
  // Another read of the same content keeps circuits of its own: the first read's is not its part.
  assert.deepEqual(runOf(imageWorks(content))(), reference)
  assert.notDeepEqual(run(), reference)
  const dangling = fromText(['out <- in'])
  image.syncOwn({ wide: { ...dangling, wires: [{ from: 'missing', to: 'out', port: 'in' }] } })
  assert.deepEqual(run(), reference)
  image.syncOwn({ wide: image.levelById.wide.tasks[0].solution })
  assert.deepEqual(run(), reference)
})

test('a course reward runs and displays the exact workshop version used by its passing board', () => {
  const made = imageWorks(content)
  const circuit = imageBoards(made)
  const source = made.levelById.wide.tasks[0]
  const game = { circuit, partDefs: content.partDefs, workshop: {}, levels: [{ tasks: [{ key: 'wide', source }] }] }
  const passthrough = made.kit.fromText(['out <- in'])
  const take = (graph, id, name, parts = {}) => captureWorkshop(graph, {
    scope: id, name, description: '', parts: made.kit.boardParts(), resolve: made.kit.partOf,
    identity: (type) => workshopIdentity(content.partDefs, type), defaults: made.kit.defaultParams,
    book: { parts },
  })
  const inner = take(passthrough, 'user_inner', 'Inner component')
  const wrap = (part) => ({
    nodes: [...passthrough.nodes, { id: 'wrapped', type: part.id }],
    wires: [{ from: 'in', to: 'wrapped', port: 'in' }, { from: 'wrapped', to: 'out', port: 'in' }],
  })
  const original = take(wrap(inner), 'user_first', 'Original version', { [inner.id]: inner })
  const upgrade = take(source.solution, 'user_second', 'New version')
  let library = publishWorkshop({ parts: { [inner.id]: inner }, published: {}, featured: {} }, original, { id: original.id, lineage: 'demo' })
  library = publishWorkshop(library, upgrade, { id: upgrade.id, lineage: 'demo', rank: 1 })
  const saved = { wide: wrap(original) }
  const bindings = courseWorkshop(game, () => library)
  const use = made.levelById.use.tasks[0]
  const run = () => made.kit.runLevel(use, use.solution, { traced: true }).runs[0]
  const reference = run().outputs.out
  const active = bindings.bind('wide', saved.wide)
  assert.equal(JSON.stringify(active), JSON.stringify(saved.wide))
  for (const built of [{ wide: active }, bindings.restore(JSON.parse(JSON.stringify(saved)))]) {
    made.syncOwn(built)
    const result = run()
    assert.notDeepEqual(result.outputs.out, reference)
    assert.ok(result.trace.some(({ path }) => path?.join('/') === 'p/wrapped'))
    const views = packedBoards(circuit, (opened, view) => ({ ...opened, view }))
    const reward = views.root('widen')
    const placed = reward.circuit.nodes.find(({ id }) => id === 'wrapped')
    assert.equal(reward.view.extraPart(placed.type).name, 'Original version')
    assert.deepEqual(reward.view.extraPart(placed.type).graph, original.graph)
    assert.deepEqual(reward.view.extraPart(inner.id).graph, inner.graph)
  }
  delete library.parts[inner.id]
  made.syncOwn(bindings.restore(saved))
  assert.deepEqual(run().outputs.out, reference)
})

test('image text play opens on the same valid inherited board as the editor', () => {
  const [previous, task] = image.levelById.two.tasks
  const circuit = imageBoards(image)
  const context = (board) => ({
    game: { image, circuit }, level: { ...task, source: task }, flags: new Set(['shift']),
    progress: { ...freshBoardProgress(), passed: [previous.key], built: { [previous.key]: board } },
  })
  assert.match(play.open(context(previous.solution)).start, /shift/)
  const corrupt = { ...previous.solution, wires: previous.solution.wires.map((wire) => wire.from === 'in' ? { ...wire, from: 'in#r' } : wire) }
  assert.equal(play.open(context(corrupt)).start, null)
})

test('image text play preserves the three channels of each pixel', () => {
  const task = image.levelById.wide.tasks[0]
  const rgb = { w: 2, h: 1, c: 3, data: new Float32Array([0.125, 0.25, 0.5, 1, 0, 0.75]) }
  const output = { w: 1, h: 1, c: 3, data: [0, 0.5, 1] }
  const source = { ...task, tests: [{ label: 'colour', inputs: { in: rgb }, expected: { out: output } }] }
  const opened = play.open({
    game: { image, circuit: imageBoards(image) }, level: { ...source, source }, flags: new Set(), progress: freshBoardProgress(),
  })
  assert.equal(opened.tests[0].text, 'in:\n2×1 · RGB\n(0.13,0.25,0.5) (1,0,0.75)\nout (target):\n1×1 · RGB\n(0,0.5,1)')
})

test('a packed image trace and its test verdict share the evaluated output', () => {
  const task = image.levelById.use.tasks[0]
  const [run] = image.kit.runLevel(task, task.solution, { traced: true }).runs
  const inside = run.trace?.find(({ path, id }) => path?.[0] === 'p' && id === 'h')
  assert.ok(inside)
  assert.equal(inside.value, run.outputs.out)
  assert.equal(image.kit.runLevel(task, task.solution).runs[0].trace, undefined)
  const direct = image.levelById.wide.tasks[0]
  assert.equal(image.kit.runLevel(direct, direct.solution, { traced: true }).runs[0].trace, undefined)
})

test('network constraints follow wires from named outputs', () => {
  const nodes = [{ id: 'in', type: 'input' }, { id: 'out', type: 'output' }]
  const encoded = {
    nodes: [...nodes, { id: 'e', type: 'image/dg-encode', params: { k: 2 } }],
    wires: [{ from: 'in', to: 'e', port: 'input' }, { from: 'e', to: 'out', port: 'r' }],
  }
  const bottleneck = constraintOf({ "image/bottleneck": { max: 2 } })
  assert.equal(bottleneck({}, encoded), '')
  const bypass = { ...encoded, wires: [...encoded.wires, { from: 'in#b', to: 'out', port: 'b' }] }
  assert.match(bottleneck({}, bypass).en, /does not pass through the encoder/)

  const layers = {
    nodes: [...nodes, { id: 'a', type: 'image/learn3' }, { id: 'b', type: 'image/lrnConv' }],
    wires: [{ from: 'in#r', to: 'a', port: 'input' }, { from: 'a#result', to: 'b', port: 'input' }, { from: 'b#result', to: 'out', port: 'in' }],
  }
  assert.equal(depthOf(layers), 2)
})
