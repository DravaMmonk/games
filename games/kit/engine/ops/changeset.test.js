import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { storyRoot } from '../test-fixture.js'
import { openPackage } from './workspace.js'
import { adopt, readLog, runChangeset, undo } from './changeset.js'
import { driftOf, hashOf } from './log.js'

const levelFile = 'packages/story/levels/given.json'
const catalogFile = 'packages/story/i18n/en.json'
const options = { check: false, write: true }
const retitle = value => ({ ops: [{ op: 'level.set', level: 'given', path: 'title', value }] })

function workspace(t) {
  const { root, id } = storyRoot()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return {
    open: () => openPackage(id, root),
    read: file => readFileSync(join(root, file), 'utf8'),
    patch: (file, fields) => {
      const path = join(root, file)
      writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, 'utf8')), ...fields }))
    },
  }
}

test('changeset writes record file hashes and refuse both stale files and stale log bases', async t => {
  const { open, read } = workspace(t)
  const first = open()
  const applied = await runChangeset(first, retitle('First edit'), options)
  assert.equal(applied.ok, true, applied.problems.join('\n'))
  assert.deepEqual(readLog(first)[0].files, [{ file: levelFile, after: hashOf(read(levelFile)) }])

  const winner = open()
  const loser = open()
  const saved = await runChangeset(winner, retitle('Second edit'), options)
  assert.equal(saved.ok, true, saved.problems.join('\n'))
  const conflict = await runChangeset(loser, retitle('Conflicting edit'), options)
  assert.equal(conflict.ok, false)
  assert.match(conflict.problems[0], /changed on disk since the game was opened: packages\/story\/levels\/given.json/)

  const staleBase = await runChangeset(open(), retitle('Outdated edit'), { ...options, base: 1 })
  assert.equal(staleBase.ok, false)
  assert.match(staleBase.problems[0], /changed since you saw it \(its log is at #2, not #1\)/)
  assert.equal(JSON.parse(read(levelFile)).title, 'Second edit')
  assert.deepEqual(readLog(first).map(entry => entry.seq), [1, 2])
})

test('undo preserves manual edits, including changes recorded by compact adoption', async t => {
  const { open, read, patch } = workspace(t)
  const original = read(levelFile)
  adopt(open(), 'Initial inventory')
  const applied = await runChangeset(open(), retitle('Authored title'), options)
  assert.equal(applied.ok, true, applied.problems.join('\n'))

  patch(catalogFile, { manual: 'Unrelated wording' })
  const unrelated = open()
  assert.deepEqual(driftOf(unrelated, unrelated.onDisk()), [catalogFile])
  adopt(unrelated, 'Unrelated hand edit')
  assert.deepEqual(readLog(unrelated).at(-1).files.map(({ file }) => file), [catalogFile])
  assert.deepEqual(driftOf(unrelated, unrelated.onDisk()), [])

  const reverted = await undo(open(), options)
  assert.equal(reverted.ok, true, reverted.problems.join('\n'))
  assert.equal(readLog(unrelated).at(-1).undoes, 2)
  assert.equal(read(levelFile), original)
  assert.equal(JSON.parse(read(catalogFile)).manual, 'Unrelated wording')

  assert.equal((await runChangeset(open(), retitle('Another edit'), options)).ok, true)
  patch(levelFile, { title: 'By hand' })
  const related = open()
  assert.deepEqual(driftOf(related, related.onDisk()), [levelFile])
  const refusal = /cannot be undone: changed since it was made: packages\/story\/levels\/given.json/
  assert.match((await undo(related, options)).problems[0], refusal)
  adopt(related, 'Related hand edit')
  assert.deepEqual(driftOf(related, related.onDisk()), [])
  assert.match((await undo(related, options)).problems[0], refusal)
  assert.equal(JSON.parse(read(levelFile)).title, 'By hand')
})

test('a thrown package check restores the workspace and never writes or logs', async t => {
  const { open } = workspace(t)
  const ws = open()
  const before = ws.snapshot()
  const disk = ws.onDisk()
  for (const [phase, problem] of [['spec', 'projection broke'], ['checkPhase', 'runtime check broke']]) {
    const domain = { spec: () => ({}), [phase]: () => { throw new Error(problem) } }
    const result = await runChangeset(ws, retitle('Unsaved title'), { write: true, domain })
    assert.equal(result.ok, false)
    assert.equal(result.failed, null)
    assert.deepEqual(result.problems, [`story/given: ${problem}`])
    assert.deepEqual(ws.snapshot(), before)
    assert.deepEqual(ws.onDisk(), disk)
    assert.deepEqual(readLog(ws), [])
  }
})

test('a loadable edit can be written while authored examples are incomplete', async t => {
  const { open, read } = workspace(t)
  const ws = open()
  const domain = {
    spec: () => ({}),
    checkPhase: ({ phase }) => {
      assert.equal(phase, 'runtime')
      return []
    },
    validate: () => { throw new Error('an authoring example is incomplete') },
  }
  const result = await runChangeset(ws, retitle('Draft title'), { write: true, domain })
  assert.equal(result.ok, true, result.problems.join('\n'))
  assert.equal(JSON.parse(read(levelFile)).title, 'Draft title')
  assert.equal(readLog(ws).length, 1)
})

test('a dry run can omit file texts while preserving the edit and leaving the workspace intact', async t => {
  const { open } = workspace(t)
  const ws = open()
  const before = ws.snapshot()
  const disk = ws.onDisk()
  const edit = retitle('Preview title')
  const full = await runChangeset(ws, edit, { check: false })
  const slim = await runChangeset(ws, edit, { check: false, texts: false })
  assert.equal(full.ok, true, full.problems.join('\n'))
  assert.equal(slim.ok, true, slim.problems.join('\n'))
  assert.deepEqual(full.files, [levelFile])
  assert.deepEqual([slim.changes, slim.diff, slim.files], [[], '', []])
  assert.deepEqual(slim.content, full.content)
  assert.equal(slim.content.levels[0].title, 'Preview title')
  assert.deepEqual(ws.snapshot(), before)
  assert.deepEqual(ws.onDisk(), disk)
  assert.deepEqual(readLog(ws), [])
})
