import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reportRuns, runOutputTests } from './test-run.js'
import { paceOf } from './playback-pace.js'
import { runTestGroups, splitTests } from './tests.js'

const task = { tests: [{ label: 'example' }], hidden: [{ label: 'held back' }] }

test('the full test order is shared and the visible list marks cases only when they are revealed', () => {
  const full = [{ label: 'example' }, { label: 'held back', hidden: true }]
  const concealed = splitTests(task, false)
  assert.equal(concealed.shown, task.tests)
  assert.equal(concealed.hiddenCount, 1)
  assert.deepEqual(concealed.all.tests, full)
  const revealed = splitTests(task, true)
  assert.equal(revealed.shown, revealed.all.tests)
  assert.equal(revealed.hiddenCount, 0)
  assert.deepEqual(revealed.shown, full)
  assert.deepEqual(task.hidden, [{ label: 'held back' }])
})

test('one report scores both groups and keeps replay only for visible cases', () => {
  const attempts = []
  let scores = 0
  let constraints = 0
  const constrained = { ...task, constraint: () => { constraints++; return 'too many parts' } }
  const domain = {
    runTest: (_task, _work, entry, { traced }) => {
      attempts.push([entry.label, traced])
      return { outputs: { out: entry.hidden ? 0 : 1 }, ...(traced && { trace: [entry.label] }) }
    },
    check: (_task, _entry, outputs) => [{ name: 'out', pass: outputs.out === 1, reason: 'wrong answer' }],
    score: (_task, _work, runs) => { scores++; return { examples: runs.length } },
  }
  const run = (revealed) => runTestGroups(constrained, revealed, (all, traceCount) => runOutputTests(domain, all, null, { traced: true, traceCount }))

  const concealed = run(false)
  assert.deepEqual(attempts, [['example', true], ['held back', false]])
  assert.equal(scores, 1)
  assert.equal(constraints, 1)
  assert.equal(concealed.pass, false)
  assert.deepEqual(concealed.checked.fail, { why: 'too many parts' })
  assert.deepEqual(concealed.checked.score, { examples: 2 })
  assert.deepEqual(concealed.checked.runs.map(({ trace }) => trace), [['example']])
  assert.deepEqual(concealed.hidden, { count: 1, failed: 1 })
  assert.deepEqual(concealed.report.runs.map(({ pass }) => pass), [true, false])
  assert.equal(concealed.report.runs[1].trace, undefined)

  const revealed = run(true)
  assert.deepEqual(attempts.slice(2), [['example', true], ['held back', true]])
  assert.equal(revealed.hidden, null)
  assert.equal(revealed.checked.fail.check, 1)
  assert.deepEqual(revealed.checked.runs.map(({ trace }) => trace), [['example'], ['held back']])
})

test('a task report keeps the complete run and gives the first case failure precedence over the final constraint', () => {
  const caseError = { en: 'Cannot evaluate this case' }
  const runs = [{}, { error: caseError }, { fail: { why: 'later' } }, {}]
  const constraint = 'too many parts'
  const score = { nodes: 5 }
  assert.deepEqual(reportRuns(runs, { score, constraint }), { runs, fail: { check: 1, why: caseError }, pass: false, score, constraint })
  assert.deepEqual(reportRuns([{}], { constraint }).fail, { why: constraint })
})

test('a run plays its first test slowly and the rest fast, at a pace that does not depend on its length', () => {
  assert.deepEqual(paceOf(0, 5, 1), { per: 650, stride: 1 })
  assert.deepEqual(paceOf(1, 5, 1), { per: 110, stride: 1 })
  const long = paceOf(0, 1000, 1)
  assert.equal(long.per, 650)
  assert.ok(long.stride > 1)
  assert.ok(long.per * (Math.ceil(1000 / long.stride) - 1) <= 12000)
  assert.deepEqual(paceOf(0, 1000, 0.5), { ...long, per: 1300 })
  assert.deepEqual(paceOf(0, 1000, 2), { ...long, per: 325 })
  assert.deepEqual(paceOf(1, 1000, 2), { ...paceOf(1, 1000, 1), per: 55 })
})
