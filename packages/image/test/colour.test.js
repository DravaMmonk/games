import test from 'node:test'
import assert from 'node:assert/strict'
import { channel, compare, compose, image, zip } from 'imglib'
import { NODE_TYPES } from '../core/engine/nodes.js'
import { runnerOf } from '../core/engine/graph.js'

const plane = (values, w = values.length) => ({ w, h: values.length / w, data: Float32Array.from(values) })

test('output combines RGB ports, fills unconnected channels and still accepts a single image', () => {
  const runner = runnerOf(NODE_TYPES)
  const nodes = ['r', 'g', 'out'].map((id) => ({ id, type: id === 'out' ? 'output' : 'input', params: { name: id } }))
  const inputs = { r: plane([0.2, 0.4]), g: image(1, 1, 0.5) }
  const graph = { nodes, wires: [{ from: 'r', to: 'out', port: 'r' }, { from: 'g', to: 'out', port: 'g' }] }
  const out = runner.evaluate(graph, inputs).values.get('out')
  assert.deepEqual([...channel(out, 0).data], [...inputs.r.data])
  assert.deepEqual([...channel(out, 1).data], [0.5, 0.5])
  assert.deepEqual([...channel(out, 2).data], [0, 0])
  graph.wires = [{ from: 'r', to: 'out', port: 'in' }]
  assert.equal(runner.evaluate(graph, inputs).values.get('out'), inputs.r)
})

test('an RGB image can be corrected directly with a single-channel illumination map', () => {
  const runner = runnerOf(NODE_TYPES)
  const original = compose(plane([0.8, 0.4]), plane([0.3, 0.5]), plane([0.2, 0.7]))
  const light = plane([0.5, 0.25])
  const photo = zip(original, light, (a, b) => a * b)
  const graph = { nodes: [
    { id: 'photo', type: 'input', params: { name: 'photo' } },
    { id: 'light', type: 'input', params: { name: 'light' } },
    { id: 'divide', type: 'image/arith', params: { op: 'div' } },
    { id: 'out', type: 'output', params: { name: 'out' } },
  ], wires: [
    { from: 'photo', to: 'divide', port: 'a' }, { from: 'light', to: 'divide', port: 'b' },
    { from: 'divide', to: 'out', port: 'in' },
  ] }
  assert.equal(compare(runner.evaluate(graph, { photo, light }).values.get('out'), original).pass, true)
})

test('colour input exposes the full image and independent RGB outputs', async () => {
  const { imageKit } = await import('../core/engine/kit.js')
  const kit = imageKit(NODE_TYPES)
  const lines = ['out.r <- photo.r', 'out.g <- photo.g', 'out.b <- photo.b']
  const graph = kit.fromText(lines, { inputs: ['photo'] })
  assert.deepEqual(kit.toText(graph), lines)
  const rgb = compose(plane([0.2, 0.4]), plane([0.3, 0.5]), plane([0.6, 0.7]))
  const values = kit.evaluate(graph, { photo: rgb }).values
  assert.equal(values.get('photo'), rgb)
  assert.deepEqual([...values.get('photo#r').data], [...channel(rgb, 0).data])
  assert.deepEqual([...values.get('photo#g').data], [...channel(rgb, 1).data])
  assert.deepEqual([...values.get('photo#b').data], [...channel(rgb, 2).data])
  assert.equal(compare(values.get('out'), rgb).pass, true)
})

test('image content and editor imports enforce the same task ports', async () => {
  const [{ imageKit }, { startBoard }, { read }] = await Promise.all([
    import('../core/engine/kit.js'), import('../core/engine/board.js'), import('../../circuit/core/board/text.js'),
  ])
  const kit = imageKit(NODE_TYPES)
  const grey = plane([0.2, 0.4])
  const task = { tests: [{ inputs: { in: grey }, expected: { out: grey } }] }
  for (const [line, refusal] of [
    ['out <- in.r', /has no output “r”/],
    ['out.r <- in', /has no input called “r”/],
    ['a = image/arith[constantSide=b](b: in)', /has no input called “b”/],
    ['a = image/arith[unknown=1](in, in)', /has no setting “unknown”/],
  ]) {
    const { errors } = read(line, startBoard(task), kit.boardParts(task.tests[0]), Object.keys(NODE_TYPES))
    assert.equal(errors.length, 1)
    assert.match(errors[0].en, refusal)
    assert.throws(() => kit.fromText([line], task), error => {
      assert.equal(error.line, 1)
      assert.deepEqual(error.errors, errors)
      return true
    })
  }
})
