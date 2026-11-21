import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { storyRoot } from '../test-fixture.js'
import { openGame, openPackage } from './workspace.js'
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

test('game edge patches settle together and still reject missing prerequisite references', async t => {
  const { root, id } = storyRoot()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const put = (file, value) => writeFileSync(join(root, file), JSON.stringify(value))
  put('packages/story/levels/next.json', { title: 'Next question', tasks: [{ id: 'next', play: 'story/answer', brief: 'Answer yes.' }] })
  put('games/story/chapters/ground.json', { levels: ['story/given', 'story/next'], chapter: { title: '@opening' } })
  mkdirSync(join(root, 'packages/story/relations'))
  put('packages/story/relations/route.json', { kind: 'requires', edges: [] })
  const edge = (from) => ({
    op: 'override.put', layer: '@story', kind: 'relation', name: 'story/route',
    data: { edges: { add: [{ from, to: 'story/next' }] } },
  })
  const ws = openGame(id, root, { scope: 'game' })
  const draft = await runChangeset(ws, { ops: [edge('#story/unused'), edge('story/given')] }, { check: false })
  assert.equal(draft.ok, true, draft.problems.join('\n'))
  assert.deepEqual(draft.content.relationEdges.requires, [{ from: 'story/given', to: 'story/next' }])
  assert.deepEqual(ws.content().relationEdges.requires, [])
  const invalid = await runChangeset(ws, { ops: [edge('story/missing')] }, { check: false })
  assert.equal(invalid.ok, false)
  assert.match(invalid.problems.join('\n'), /story\/missing/)
})

test('a layout draft checks the touched chapter and preserves the write guards', async t => {
  const { root, id } = storyRoot()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const file = join(root, 'games/story/chapters/ground.json')
  const layout = rows => ({ ops: [{ op: 'chapter.set', chapter: 'ground', path: ['rows'], value: rows }] })
  const open = () => openGame(id, root, { scope: 'game' })
  const local = { changesOnly: true, domain: { spec: () => { throw new Error('layout should not build a runtime') } } }

  const draft = layout([['story/given']])
  const preview = await runChangeset(open(), draft, { ...local, check: false })
  assert.equal(preview.checkedChanges, true)
  assert.equal(preview.ok, true, preview.problems.join('\n'))
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).rows, undefined)

  const invalid = await runChangeset(open(), layout([['story/given'], ['story/given']]), { ...local, write: true })
  assert.equal(invalid.ok, false)
  assert.match(invalid.problems.join('\n'), /on the map twice/)
  const stale = await runChangeset(open(), draft, { ...local, write: true, base: 99 })
  assert.equal(stale.ok, false)
  assert.match(stale.problems.join('\n'), /changed since you saw it/)

  const saved = await runChangeset(open(), draft, { ...local, write: true })
  assert.equal(saved.ok, true, saved.problems.join('\n'))
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).rows, [['story/given']])
  const reverted = await undo(open(), { ...local, write: true })
  assert.equal(reverted.ok, true, reverted.problems.join('\n'))
  assert.equal(reverted.checkedChanges, true)
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).rows, undefined)
})

test('apply reuses the checked draft only while the project inputs remain unchanged', async t => {
  const { root, id } = storyRoot({ runtimeProbe: true })
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const open = () => openGame(id, root, { scope: 'game' })
  const draft = { ops: [{ op: 'chapter.set', chapter: 'ground', path: ['number'], value: 2 }] }
  const checked = await runChangeset(open(), draft, { changesOnly: true })
  assert.equal(checked.ok, true, checked.problems.join('\n'))
  assert.ok(checked.lines.some(({ text }) => text === 'check count 1'))
  const same = await runChangeset(open(), { ...draft, why: 'A reason entered after checking' }, { changesOnly: true, write: true })
  assert.equal(same.ok, true, same.problems.join('\n'))
  assert.deepEqual(same.lines, checked.lines)

  const next = { ops: [{ ...draft.ops[0], value: 3 }] }
  const nextPreview = await runChangeset(open(), next, { changesOnly: true })
  assert.ok(nextPreview.lines.some(({ text }) => text === 'check count 2'))
  writeFileSync(join(root, 'games/story/extra.json'), '{}')
  const saved = await runChangeset(open(), next, { changesOnly: true, write: true })
  assert.equal(saved.ok, true, saved.problems.join('\n'))
  assert.ok(saved.lines.some(({ text }) => text === 'check count 3'))
})

test('applying a course removal records level IDs and leaves their package files intact', async t => {
  const { root, id } = storyRoot()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const file = join(root, 'packages/story/levels/given.json')
  const savedSource = readFileSync(file, 'utf8')
  const open = () => openGame(id, root, { scope: 'game' })
  const edit = { ops: [{ op: 'chapter.set', chapter: 'ground', path: ['levels'], value: [] }] }
  const preview = await runChangeset(open(), edit, { check: false })
  assert.equal(preview.ok, true, preview.problems.join('\n'))
  assert.deepEqual(preview.removedLevels, ['story/given'])
  const result = await runChangeset(open(), edit, { write: true })
  assert.equal(result.ok, true, result.problems.join('\n'))
  assert.deepEqual(readLog(open()).at(-1).removedLevels, ['story/given'])
  assert.equal(readFileSync(file, 'utf8'), savedSource)
  const restored = await undo(open(), { write: true })
  assert.equal(restored.ok, true, restored.problems.join('\n'))
  assert.deepEqual(open().content().sourceChapters[0].levels, ['story/given'])
  assert.equal(readLog(open()).at(-1).removedLevels, undefined)
})
