import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fromFn, image } from 'imglib'
import { imageKit } from '../core/engine/kit.js'
import { NODE_TYPES } from '../core/engine/nodes.js'
import { ownPart } from '../core/engine/own.js'
import { constraintOf } from '../core/items/constraints.js'
import { validate } from '../core/validate.js'

function pictureTask() {
  const types = { ...NODE_TYPES }
  const kit = imageKit(types)
  const flat = image(2, 1)
  const varied = fromFn(2, 1, x => x)
  const task = {
    id: 'puzzle', key: 'puzzle-copy', kind: 'image/graph', title: 'Puzzle', inputs: ['in'], outputs: ['out'],
    tests: [{ label: 'shown', inputs: { in: flat }, expected: { out: flat } }],
    hidden: [{ label: 'hidden', inputs: { in: varied }, expected: { out: varied } }],
  }
  const solution = kit.fromText(['out <- in'], task)
  const zero = kit.fromText(['a = image/arith[op=mul, constantSide=b, constant=0](in)', 'out <- a'], task)
  return { types, kit, task: { ...task, solution }, zero }
}

function check(task, kit, publishedBy = () => []) {
  return validate({ levels: [{ id: task.id, tasks: [task] }], intros: {}, kit, packageTarget: true, publishedBy })
}

test('a hidden picture rejects a naive board and a reference that only pass the flat visible case', () => {
  const { kit, task, zero } = pictureTask()
  const lines = check({ ...task, naive: zero }, kit)
  assert.deepEqual(lines, [
    { level: 'puzzle', text: 'puzzle hidden: solution PASS  hidden:✓0' },
    { level: 'puzzle', text: 'puzzle Puzzle: solution PASS [n=0 c=0]  shown:✓0/0.000' },
    { level: 'puzzle', text: '  naive fails (hidden test)  shown:✓0/0.000' },
  ])
  assert.deepEqual(check({ ...task, solution: zero }, kit).filter(line => line.fail), [
    { level: 'puzzle', fail: true, text: 'puzzle hidden: solution FAIL  hidden:✗1' },
  ])

  const same = { ...task.tests[0], label: 'hidden' }
  assert.deepEqual(check({ ...task, hidden: [same] }, kit).filter(line => line.fail), [
    { level: 'puzzle', fail: true, text: 'puzzle: every test expects the same flat out' },
  ])
})

test('published parts run hidden cases independently of the authoring budget', () => {
  const { types, kit, task, zero } = pictureTask()
  const part = { name: 'Copy', desc: 'Copy the image.', outputType: 'image/image' }
  types['sample/copy'] = ownPart(task, 'sample/copy', part, () => task.solution, types)
  types['sample/zero'] = ownPart(task, 'sample/zero', part, () => zero, types)
  const constraint = constraintOf({ 'image/nodes': { max: 0 } }, types)
  const lines = check({ ...task, constraint }, kit, key => key === task.key ? ['sample/copy', 'sample/zero'] : [])
  assert.equal(lines.filter(line => line.text === '  its part alone passes').length, 1)
  assert.deepEqual(lines.filter(line => line.fail), [
    { level: 'puzzle', fail: true, text: "puzzle: its packed part, wired to the level's inputs, fails 1 test(s)" },
  ])
  const solution = kit.fromText(['a = sample/copy(in)', 'out <- a'], task)
  const rejected = check({ ...task, constraint, solution }, kit).filter(line => line.fail)
  assert.deepEqual(rejected, [{
    level: 'puzzle', fail: true, text: 'puzzle Puzzle: solution FAIL [n=1 c=0 用了 1 个节点，最多 0 个]  shown:✓0/0.000',
  }])
})

test('package previews allow omitted introductions but still check authored pages and tasks', () => {
  const task = { id: 'sample', kind: 'board', title: 'Sample', board: 'sample', verify: () => '' }
  const spec = { levels: [{ id: task.id, tasks: [task] }], intros: {}, kit: {}, publishedBy: () => [] }
  const verified = { level: 'sample', text: 'sample Sample: (board sample) verified' }
  assert.deepEqual(validate(spec), [{ level: 'sample', fail: true, text: 'sample: 引言：没有引言' }, verified])
  const preview = { ...spec, packageTarget: true }
  assert.deepEqual(validate(preview), [verified])
  assert.deepEqual(validate({ ...preview, intros: { sample: [{ t: '' }] } }), [
    { level: 'sample', fail: true, text: 'sample: 引言：第 1 页没有文字' }, verified,
  ])
  assert.deepEqual(check({ ...task, verify: () => 'Broken task' }, {}), [
    { level: 'sample', fail: true, text: 'sample Sample: (board sample) Broken task' },
  ])
})
