import { levelMarks } from '../../progress/core/index.js'
import { circuitFixtureSchema } from '../../qed/test/fixture.js'
// Authoring operations on a circuit workspace: edits, refusals and reversible changes.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { S } from '../../../games/kit/engine/schema.js'
import { defineVocabulary } from '../../../games/kit/engine/vocabulary.js'
import { operationsFor } from '../../../games/kit/engine/ops/operations.js'
import { openGame, openPackage } from '../../../games/kit/engine/ops/workspace.js'
import { runChangeset, readLog, undo } from '../../../games/kit/engine/ops/changeset.js'
import { copyTestProject } from '../../../games/kit/engine/test-fixture.js'
import { withParts } from '../core/parts/define.js'
import { taskLevel } from '../../../games/kit/engine/tasks.js'

import { textKey } from '../../../games/kit/engine/i18n.js'
import { writeContentFixture } from '../../qed/test/fixture.js'

const VOCAB = { ...defineVocabulary({
  module: 'toy',
  version: 1,
  kinds: { primitive: { a: { about: 'a' }, b: { about: 'b' }, c: { about: 'c' } } },
  game: S.obj({ title: S.text(), chapters: S.list(S.str({ reference: 'chapter' })), description: S.opt(S.text()) }),
  // What a toy level says once is its whole puzzle; its one task is only its id.
  level: taskLevel({ title: S.text(), brief: S.opt(S.text()), tests: S.opt(S.list(S.any())), adds: S.opt(S.list(S.ref('primitive', { reference: 'circuit/part' }))), solution: S.opt(S.board()), from: S.opt(S.level()) }, {}, { parts: true }),
}), levelMarks }
const DOMAIN = { vocabulary: VOCAB }
const roots = []
after(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })))
function temporaryRoot(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix))
  roots.push(root)
  return root
}

// Each operation gets a fresh workspace. Tests that write files clone the fixture.
let toyTemplate
function toyRoot({ write = false } = {}) {
  toyTemplate ??= writeToy()
  const root = write ? copyTestProject(toyTemplate, 'ops-toy-').root : toyTemplate
  if (write) roots.push(root)
  return root
}
const openToyGame = (root = toyRoot()) => openGame('toy', root, { vocabulary: VOCAB })
const openToyPackage = (root = toyRoot()) => openPackage('toy', root, { vocabulary: VOCAB })
function writeToy() {
  const root = temporaryRoot('ops-toy-template-')
  const game = {
    vocabulary: 1, title: { en: 'Toy' },
    chapters: [{ id: 'one', levels: ['toy/a1', 'toy/a2', 'toy/a3'] }, { id: 'two', levels: ['b1', 'b2', 'c1'] }],
    description: { en: 'A toy game' },
  }
  const glossary = { groups: [{ id: 'g', title: 'G' }], entries: [{ id: 'e', group: 'g', title: { en: 'E' }, body: ['see <level-ref to="a2"></level-ref>'], at: 'a2' }] }
  const levels = Object.fromEntries(['a1', 'a2', 'a3', 'b1', 'b2', 'c1'].map((id) => [id, {
    title: { en: id }, tests: [1], ...(id === 'b1' && { from: 'a2', brief: { en: 'after <level-ref to="a2"></level-ref>', zh: '接着 <level-ref to="a2"></level-ref>' } }), tasks: [{ id }],
  }]))
  writeContentFixture(root, 'toy', { game, glossary, levels, tagOverrides: { 'progress/tags/level/optional': ['toy/a3'] } }, VOCAB)
  return root
}
const run = (ws, op, args) => {
  const vocabulary = ws.schemas ?? circuitFixtureSchema(VOCAB)
  return operationsFor(vocabulary)[op].apply(ws, args, { vocabulary, domain: DOMAIN })
}
const undone = (ws, inverse) => { for (const { op, ...args } of inverse) run(ws, op, args) }
/** Check the inverse against the assembled content, then resume from the result of the first application. */
function roundTrip(ws, op, args) {
  const before = ws.content()
  const { inverse } = run(ws, op, args)
  const after = ws.snapshot()
  undone(ws, inverse)
  assert.deepEqual(ws.content(), before, `${op}: its inverse puts the content back`)
  ws.restore(after)
}
const level = (ws, id) => ws.levels.get(id)

test('field edits, patches and replacements reject id changes before mutation', () => {
  const ws = openToyPackage()
  const base = level(ws, 'a1')
  const changed = { ...base, tasks: [{ id: 'new' }] }
  const before = ws.snapshot()
  for (const [op, args] of [
    ['level.set', { level: 'a1', path: 'id', value: 'new' }],
    ['level.set', { level: 'a1', path: 'tasks[0].id', value: 'new' }],
    ['level.unset', { level: 'a1', path: 'tasks[0].id' }],
    ['level.set', { level: 'a1', path: 'tasks[0]', value: { id: 'new' } }],
    ['level.set', { level: 'a1', path: 'tasks', value: changed.tasks }],
    ['level.patch', { level: 'a1', fields: { tasks: changed.tasks } }],
    ['level.patch', { level: 'a1', fields: { id: 'new' } }],
    ['level.replace', { level: 'a1', data: changed }],
    ['entry.set', { entry: 'e', path: 'id', value: 'new' }],
    ['entry.patch', { entry: 'e', fields: { id: 'new' } }],
    ['entry.put', { entry: 'e', data: { ...ws.contentObjects.entry.get('e'), id: 'new' } }],
  ]) {
    assert.throws(() => run(ws, op, args), /id cannot change; create a new object, then delete the old one/, op)
    assert.deepEqual(ws.snapshot(), before, `${op} leaves the workspace intact`)
  }
  for (const kind of ['tag', 'relation', 'section']) {
    const plural = { tag: 'tags', relation: 'relations', section: 'sections' }[kind]
    const objects = kind === 'section' ? ws.contentObjects.section : ws[plural]
    objects.set(kind === 'tag' ? 'level:object' : 'object', {})
    assert.throws(() => run(ws, `${kind}.set`, { [kind]: 'object', ...(kind === 'tag' && { member: 'level' }), path: 'id', value: 'new' }), /id cannot change/)
  }
})

test('stable ids allow list reordering, insertion, deletion and undo', () => {
  const ws = openToyGame()
  const chapters = ws.game.chapters
  roundTrip(ws, 'game.set', { path: 'chapters', value: [...chapters].reverse() })
  roundTrip(ws, 'game.set', { path: 'chapters', value: [...ws.game.chapters, '@toy/new'] })
  roundTrip(ws, 'game.unset', { path: 'chapters[0]' })
  roundTrip(ws, 'level.set', { level: 'a1', path: 'tasks[0].id', value: 'a1' })
  roundTrip(ws, 'game.unset', { path: 'description' })
  assert.equal(Object.hasOwn(ws.game, 'description'), false)
})

test('part variants, setting definitions, blueprints and overrides preserve ids', () => {
  const ws = openToyPackage()
  run(ws, 'part.add', { part: 'made', data: { inside: [{ id: 'base', reference: {} }] } })
  assert.deepEqual(Object.keys(ws.partDefs.parts), ['made'])
  for (const args of [
    { path: 'parts.made.id', value: 'new' },
    { path: 'parts.made.inside[0].id', value: 'new' },
    { path: 'parts.made.inside', value: [{ id: 'new', reference: {} }] },
  ]) assert.throws(() => run(ws, 'parts.set', args), /id cannot change/)
  run(ws, 'blueprint.put', { data: { eras: [{ id: 'chapter' }] } })
  assert.throws(() => run(ws, 'blueprint.set', { path: 'eras[0].id', value: 'new' }), /id cannot change/)
  assert.throws(() => run(ws, 'blueprint.put', { data: { eras: [{ id: 'new' }] } }), /id cannot change/)
  assert.throws(() => run(ws, 'parts.set', { path: [], value: { parts: {} } }), /manage objects/)
  assert.throws(() => run(ws, 'parts.set', { path: 'settings', value: {} }), /settings belong to a part/)
  for (const merge of [false, true]) {
    for (const id of ['a1', 'toy/a1']) {
      const data = { ...level(ws, 'a1'), tasks: [{ id }] }
      roundTrip(ws, 'override.put', { layer: ws.layer, kind: 'level', name: 'toy/a1', data, merge })
    }
    assert.throws(() => run(ws, 'override.put', { layer: ws.layer, kind: 'level', name: 'toy/a1', data: { tasks: [{ id: 'new' }] }, merge }), /id cannot change/)
  }
})

test('a refused id edit restores all earlier operations in its changeset', async () => {
  const ws = openToyPackage()
  const before = ws.content()
  for (const op of [
    { op: 'level.set', level: 'a1', path: 'tasks[0].id', value: 'new' },
    { op: 'entry.put', entry: 'e', data: { ...ws.contentObjects.entry.get('e'), id: 'new' } },
  ]) {
    const result = await runChangeset(ws, { ops: [{ op: 'level.set', level: 'a1', path: 'tests', value: [2] }, op] }, { check: false, domain: DOMAIN })
    assert.equal(result.ok, false)
    assert.equal(result.failed, 1, result.problems.join('\n'))
    assert.match(result.problems.join('\n'), /id cannot change/)
    assert.deepEqual(ws.content(), before)
  }
})

test('level.set, level.unset, level.patch and level.replace edit one level', () => {
  const ws = openToyGame()
  const title = level(ws, 'a1').title
  roundTrip(ws, 'level.set', { level: 'a1', path: 'tests[1]', value: 2 })
  assert.deepEqual(level(ws, 'a1').tests, [1, 2])
  roundTrip(ws, 'level.set', { level: 'a1', path: 'brief', value: { en: '甲' } })
  // A new field goes where the schema lists it: brief after title, before tests.
  assert.deepEqual(Object.keys(level(ws, 'a1')), ['title', 'brief', 'tests', 'tasks'])
  roundTrip(ws, 'level.unset', { level: 'a1', path: 'tests[0]' })
  assert.deepEqual(level(ws, 'a1').tests, [2])
  roundTrip(ws, 'level.patch', { level: 'a1', fields: { brief: null, adds: ['a'] } })
  assert.deepEqual(level(ws, 'a1'), { title, tests: [2], adds: ['a'], tasks: [{ id: 'a1' }] })
  roundTrip(ws, 'level.replace', { level: 'a1', data: { title: 'A', tasks: [{ id: 'a1' }] } })
  assert.deepEqual(level(ws, 'a1'), { title: 'A', tasks: [{ id: 'a1' }] })
  assert.throws(() => run(ws, 'level.set', { level: 'a1', path: 'x.y', value: 1 }), /no such field/)
  assert.throws(() => run(ws, 'level.unset', { level: 'a1', path: 'brief' }), /nothing there/)
})

test('level.adds adds and takes parts, and drops an empty list', () => {
  const ws = openToyGame()
  roundTrip(ws, 'level.adds', { level: 'a2', add: ['a', 'b'] })
  roundTrip(ws, 'level.adds', { level: 'a2', remove: ['a'], add: ['c'] })
  assert.deepEqual(level(ws, 'a2').adds, ['b', 'c'])
  roundTrip(ws, 'level.adds', { level: 'a2', remove: ['b', 'c'] })
  assert.equal(level(ws, 'a2').adds, undefined)
  assert.throws(() => run(ws, 'level.adds', { level: 'a2', remove: ['a'] }), /does not bring in a/)
})

test('level.blueprint writes a board as blueprint text, and only a board', () => {
  const ws = openToyGame()
  roundTrip(ws, 'level.blueprint', { level: 'a1', path: 'solution', text: '# blueprint 1 toy a1\nm = mp(p, q)\ngoal <- m\n' })
  assert.deepEqual(level(ws, 'a1').solution, ['m = mp(p, q)', 'goal <- m'])
  assert.throws(() => run(ws, 'level.blueprint', { level: 'a1', path: 'solution', text: 'm = mp(p' }), /line 1/)
  assert.throws(() => run(ws, 'level.blueprint', { level: 'a1', path: 'brief', text: 'goal <- p' }), /not a board/)
})

test('level.add and level.remove update placement while preserving content references', () => {
  const ws = openToyGame()
  roundTrip(ws, 'level.add', { level: 'n1', data: { title: 'N' } })
  assert.deepEqual(ws.contentObjects.chapter.get('one').levels, ['toy/a1', 'toy/a2', 'toy/a3'])
  roundTrip(ws, 'level.remove', { level: 'n1' })
  assert.throws(() => run(ws, 'level.remove', { level: 'a2' }), /still named/)
  roundTrip(ws, 'level.remove', { level: 'c1' })
  assert.ok(!ws.contentObjects.chapter.get('two').levels.includes('toy/c1'))

})

test('game tag patches update the assembled route and undo cleanly', () => {
  const ws = openToyGame()
  roundTrip(ws, 'override.put', {
    layer: ws.layer, kind: 'tag', name: levelMarks.optional, member: 'level', data: { values: { add: ['toy/a2'] } },
  })
  assert.equal(ws.content().eras[0].levels.find(level => level.id === 'toy/a2').optional, true)
})

test('a game puts its own wording over a package text, which the package keeps; the package workspace reads its own', async () => {
  const root = toyRoot({ write: true })
  const ws = openToyGame(root)
  const original = level(ws, 'b1').title
  roundTrip(ws, 'text.override', { level: 'b1', path: 'title', lang: 'en', value: 'Ours' })
  assert.equal(ws.content().levels.find(({ id }) => id === 'toy/b1').title.en, 'Ours')
  assert.deepEqual(level(ws, 'b1').title, original)
  assert.deepEqual(ws.content().overridden, { [`toy/${textKey(original)}`]: { en: 'b1' } })
  assert.throws(() => run(ws, 'text.override', { in: 'game', path: 'title', lang: 'en', value: 'x' }), /the game's own text/)
  const written = await runChangeset(openToyGame(root), { ops: [{ op: 'text.override', level: 'b1', path: 'title', lang: 'en', value: 'Ours' }] }, { write: true, check: false, domain: DOMAIN })
  assert.equal(written.ok, true, written.problems.join('\n'))
  assert.deepEqual(written.files, ['games/toy/overrides/toy/i18n/en.json'])
  assert.equal(openToyGame(root).content().levels.find(({ id }) => id === 'toy/b1').title.en, 'Ours')
  assert.equal(openToyPackage(root).content().levels.find(({ id }) => id === 'toy/b1').title.en, 'b1')
  const refused = await runChangeset(openToyGame(root), { ops: [{ op: 'level.set', level: 'b1', path: 'tests', value: [] }] }, { check: false, domain: DOMAIN })
  assert.match(refused.problems[0], /the package workspace's to change/)
})

test('text.set edits one language at a field path and round trips', () => {
  const root = toyRoot()
  const ws = openToyGame(root)
  const pkg = openToyPackage(root)
  const before = level(ws, 'b1').brief
  const gameTitle = ws.game.title
  const entryTitle = pkg.contentObjects.entry.get('e').title
  roundTrip(ws, 'text.set', { level: 'b1', path: 'brief', lang: 'en', value: 'then' })
  assert.deepEqual(level(ws, 'b1').brief, { ...before, en: 'then' })
  roundTrip(ws, 'text.set', { level: 'b1', path: 'brief', lang: 'fr', value: 'ensuite' })
  assert.deepEqual(level(ws, 'b1').brief, { ...before, en: 'then', fr: 'ensuite' })
  roundTrip(ws, 'text.set', { in: 'game', path: 'title', lang: 'zh', value: '玩具' })
  assert.deepEqual(ws.game.title, { ...gameTitle, zh: '玩具' })
  roundTrip(pkg, 'text.set', { entry: 'e', path: 'title', lang: 'ja', value: '項目' })
  assert.deepEqual(pkg.contentObjects.entry.get('e').title, { ...entryTitle, ja: '項目' })
  assert.throws(() => run(ws, 'text.set', { level: 'b1', path: 'from', lang: 'en', value: 'x' }), /not a text/)
})

test('preview, apply and undo a locale edit across a workspace reopen', async () => {
  const root = toyRoot({ write: true })
  const ws = openToyPackage(root)
  const source = join(root, 'packages', 'toy', 'levels', 'b1.json')
  const catalog = 'packages/toy/i18n/fr.json'
  const before = readFileSync(source, 'utf8')
  const key = textKey(level(ws, 'b1').brief)
  const ops = [{ op: 'text.set', level: 'b1', path: 'brief', lang: 'fr', value: 'Ensuite' }]
  const options = { check: false, domain: DOMAIN }
  const preview = await runChangeset(ws, { ops }, options)
  assert.equal(preview.ok, true, preview.problems.join('\n'))
  assert.equal(preview.content.levels.find((level) => level.id === 'toy/b1').brief.fr, 'Ensuite')
  assert.deepEqual(preview.files, [catalog])
  assert.equal(existsSync(join(root, catalog)), false)

  const applied = await runChangeset(ws, { ops }, { ...options, write: true })
  assert.equal(applied.ok, true, applied.problems.join('\n'))
  assert.equal(readFileSync(source, 'utf8'), before)
  assert.deepEqual(JSON.parse(readFileSync(join(root, catalog), 'utf8')), { [key]: 'Ensuite' })
  const reopened = openToyPackage(root)
  assert.equal(level(reopened, 'b1').brief.fr, 'Ensuite')
  const undone = await undo(reopened, { ...options, write: true })
  assert.equal(undone.ok, true, undone.problems.join('\n'))
  assert.equal(existsSync(join(root, catalog)), false)
  assert.equal(readFileSync(source, 'utf8'), before)

  const stale = openToyPackage(root)
  const remove = { ops: [{ op: 'level.unset', level: 'b1', path: 'brief' }] }
  assert.equal((await runChangeset(reopened, remove, { ...options, write: true })).ok, true)
  const late = await runChangeset(stale, { ops }, { ...options, write: true })
  assert.match(late.problems[0], /changed on disk since the game was opened/)
  assert.equal(existsSync(join(root, catalog)), false)
})

test('entry.put, entry.patch and entry.remove edit the encyclopedia', () => {
  const ws = openToyPackage()
  roundTrip(ws, 'entry.put', { entry: 'f', data: { title: 'F', body: [] } })
  assert.deepEqual([...ws.contentObjects.entry.keys()], ['e', 'f'])
  roundTrip(ws, 'entry.patch', { entry: 'e', fields: { title: 'E2', at: null } })
  assert.deepEqual(ws.contentObjects.entry.get('e'), { title: 'E2', body: ['see <level-ref to="a2"></level-ref>'] })
  roundTrip(ws, 'entry.remove', { entry: 'e' })
  assert.deepEqual([...ws.contentObjects.entry.keys()], ['f'])
})

test('a package changeset is checked atomically, logged and undone independently of its game', async () => {
  const root = toyRoot({ write: true })
  const ws = openToyPackage(root)
  const options = { write: true, check: false, domain: DOMAIN }
  const editedLevel = join(root, 'packages/toy/levels/a3.json')
  const original = readFileSync(editedLevel, 'utf8')
  const refused = await runChangeset(ws, { ops: [{ op: 'level.set', level: 'a1', path: 'from', value: 'gone' }] }, options)
  assert.equal(refused.ok, false)
  assert.match(refused.problems.join('\n'), /toy\/gone/)
  assert.deepEqual(readLog(ws), [])
  const bad = await runChangeset(ws, { ops: [{ op: 'level.set', level: 'nope', path: 'title', value: 'No' }] }, options)
  assert.match(bad.problems[0], /^op 1 \(level.set\): level: "nope" is no level of this game/)
  const why = 'a rewritten puzzle and an extra level'
  const done = await runChangeset(ws, { why, ops: [
    { op: 'level.set', level: 'a3', path: 'tests', value: [2] },
    { op: 'level.add', level: 'n1', data: { title: 'N', tasks: [{ id: 'n1' }] } },
  ] }, options)
  assert.equal(done.ok, true, done.problems.join('\n'))
  assert.deepEqual(done.files, ['packages/toy/levels/a3.json', 'packages/toy/levels/n1.json'])
  assert.deepEqual(JSON.parse(readFileSync(editedLevel, 'utf8')).tests, [2])
  assert.equal(JSON.parse(readFileSync(join(root, 'packages/toy/levels/n1.json'), 'utf8')).tasks[0].id, 'n1')
  assert.deepEqual(readLog(ws).map((e) => [e.seq, e.why]), [[1, why]])
  assert.deepEqual(readLog(openToyGame(root)), [])
  assert.match((await undo(ws, { ...options, seq: 0 })).problems[0], /#0 is not the change/)
  const back = await undo(ws, { ...options, seq: 1 })
  assert.equal(back.ok, true, back.problems.join('\n'))
  assert.equal(readFileSync(editedLevel, 'utf8'), original)
  assert.equal(existsSync(join(root, 'packages/toy/levels/n1.json')), false)
  assert.deepEqual(readLog(ws).map((e) => e.undoes), [undefined, 1])
  assert.match((await undo(ws, options)).problems[0], /nothing to undo/)
})

test('tasks by id: task.add, task.move in a level and across levels, task.remove, each undone', async () => {
  const T = defineVocabulary({ module: 'tasked', version: 1, kinds: {}, game: VOCAB.game, level: taskLevel({ title: S.text() }, { brief: S.text() }) })
  const tx = (s) => ({ en: s })
  const levels = new Map([['p', { title: tx('p'), tasks: [{ id: 'p', brief: tx('p1') }, { id: 'p2', brief: tx('p2') }] }], ['q', { title: tx('q'), tasks: [{ id: 'q', brief: tx('q1') }] }], ['r', { title: tx('r'), tasks: [{ id: 'r1', brief: tx('r1') }] }]])
  const ws = { levels: new Map(levels), game: { eras: [] } }
  const go = (op, args) => operationsFor(circuitFixtureSchema(T))[op].apply(ws, args, { vocabulary: T, domain: null })
  const ids = (id) => ws.levels.get(id).tasks.map((x) => x.id)
  const before = JSON.stringify([...ws.levels])
  // A level's only task moved out leaves it empty, for the same changeset to remove (the check refuses it otherwise).
  const merged = go('task.move', { task: 'r1', to: { level: 'q' } })
  assert.deepEqual([ws.levels.get('r').tasks, ids('q')], [[], ['q', 'r1']])
  for (const { op, ...args } of merged.inverse) go(op, args)
  const added = go('task.add', { level: 'p', data: { brief: tx('new') }, first: true })
  assert.deepEqual(ids('p'), ['p-2', 'p', 'p2'])
  assert.throws(() => go('task.add', { level: 'q', data: { id: 'p', brief: tx('x') } }), /there is a task p already/)
  assert.throws(() => go('task.add', { level: 'p', data: { id: 'r', brief: tx('x') } }), /r is a level’s id/)
  const inLevel = go('task.move', { task: 'p2', to: { level: 'p', first: true } })
  assert.deepEqual(ids('p'), ['p2', 'p-2', 'p'])
  const across = go('task.move', { task: 'p', to: { level: 'q', after: 'q' } })
  assert.deepEqual([ids('p'), ids('q')], [['p2', 'p-2'], ['q', 'p']])
  assert.throws(() => go('task.remove', { task: 'r1' }), /only task: remove the level/)
  const removed = go('task.remove', { task: 'p-2' })
  assert.deepEqual(ids('p'), ['p2'])
  for (const done of [removed, across, inLevel, added]) for (const { op, ...args } of done.inverse) go(op, args)
  assert.equal(JSON.stringify([...ws.levels]), before)
})

// A toy whose parts are data (games/design/README.md 6.8): engine resources in its vocabulary, its parts in parts/<name>.json.
const PVOCAB = defineVocabulary({
  module: 'ptoy',
  version: 1,
  kinds: { operation: { add: { about: 'a + b', args: [{ name: 'a', type: 'kernel/number' }, { name: 'b', type: 'kernel/number' }], returns: 'kernel/number' } }, family: { value: { about: 'numbers' } } },
  game: S.obj({ title: S.text(), chapters: S.list(S.str({ reference: 'chapter' })) }),
  level: S.obj({ title: S.text(), brief: S.opt(S.text()), adds: S.opt(S.list(S.ref('primitive', { reference: 'circuit/part' }))), solution: S.opt(S.board()), uses: S.opt(S.map(S.str(), { key: S.ref('primitive', { reference: 'circuit/part' }) })) }),
})
const sum = { name: { en: '和' }, desc: { en: 'a + b' }, icon: 'Plus', family: 'value', inputs: [{ name: 'a', type: 'kernel/number' }, { name: 'b', type: 'kernel/number' }], outputType: 'kernel/number', op: 'add' }
let partsTemplate
const partsRoot = () => partsTemplate ??= writePartsToy()
const openPartsGame = () => openGame('ptoy', partsRoot(), { vocabulary: PVOCAB })
const openPartsPackage = () => openPackage('ptoy', partsRoot(), { vocabulary: PVOCAB })
function writePartsToy() {
  const root = temporaryRoot('ops-ptoy-')
  const game = { vocabulary: 1, title: { en: 'Toy' }, chapters: [{ id: 'one', levels: ['a1'] }] }
  const glossary = { groups: [], entries: [] }
  const partDefs = { parts: { sum } }
  const levels = { a1: { title: 'A', brief: { en: '用 <part-ref to="sum"></part-ref>' }, adds: ['sum'], solution: ['s = sum(a, b)', 'out <- s'] } }
  writeContentFixture(root, 'ptoy', { game, glossary, partDefs, levels, tagOverrides: { 'circuit/tags/circuit/part/primitives': ['ptoy/sum'] } }, PVOCAB)
  return root
}
const prun = (ws, op, args) => operationsFor(circuitFixtureSchema(PVOCAB))[op].apply(ws, args, { vocabulary: withParts(circuitFixtureSchema(PVOCAB), ws.partDefs), domain: { vocabulary: PVOCAB } })

test('part operations edit and restore the registry and refuse to remove a referenced part', () => {
  const ws = openPartsGame()
  const before = JSON.stringify(ws.content())
  const added = prun(ws, 'part.add', { part: 'twice', data: { ...sum, inputs: [{ name: 'a' }], op: 'add' }, after: 'sum' })
  assert.deepEqual(Object.keys(ws.partDefs.parts), ['sum', 'twice'])
  const said = prun(ws, 'text.set', { in: 'parts', path: 'parts.twice.name', lang: 'en', value: '两倍' })
  assert.deepEqual(ws.partDefs.parts.twice.name, { ...sum.name, en: '两倍' })
  const removed = prun(ws, 'part.remove', { part: 'twice' })
  assert.deepEqual(Object.keys(ws.partDefs.parts), ['sum'])
  for (const { op, ...args } of removed.inverse) prun(ws, op, args)
  for (const done of [said, added]) for (const { op, ...args } of done.inverse) prun(ws, op, args)
  assert.equal(JSON.stringify(ws.content()), before)
  assert.throws(() => prun(ws, 'part.remove', { part: 'sum' }), /still named at levels\/a1.json adds\[0\], levels\/a1.json brief.en, levels\/a1.json solution\[0\], overrides\/circuit\/tags\/circuit\/part\/primitives\.json values\.add\[0\]/)
  assert.throws(() => prun(ws, 'parts.set', { path: 'parts.sum', value: {} }), /part.add/)
  assert.throws(() => prun(ws, 'part.add', { part: 'twice', data: sum, after: 'none' }), /no part none/)
  // A map's key naming a part also prevents removal.
  prun(ws, 'level.set', { level: 'a1', path: 'uses', value: { sum: 'twice', other: 'once' } })
  assert.throws(() => prun(ws, 'part.remove', { part: 'sum' }), /levels\/a1.json uses.sum/)
})

test('inline settings are edited and undone with their part', () => {
  const ws = openPartsGame()
  const before = ws.content()
  const data = { k: { control: 'slider', min: 0, max: 4 } }
  const change = prun(ws, 'parts.set', { path: ['parts', 'sum', 'settings'], value: data })
  assert.deepEqual(ws.partDefs.parts.sum.settings, data)
  for (const { op, ...args } of change.inverse) prun(ws, op, args)
  assert.deepEqual(ws.content(), before)
})

test('operations consume assembled names and keep package source references local', async () => {
  const ws = openPartsPackage()
  const result = await runChangeset(ws, { ops: [{ op: 'level.set', level: 'ptoy/a1', path: 'uses', value: { 'ptoy/sum': 'selected' } }] }, { check: false, domain: { vocabulary: PVOCAB } })
  assert.equal(result.ok, true, result.problems.join('\n'))
  assert.deepEqual(result.files, ['packages/ptoy/levels/a1.json'])
  assert.deepEqual(JSON.parse(result.changes[0].after).uses, { sum: 'selected' })
  assert.deepEqual(result.content.levels[0].uses, { 'ptoy/sum': 'selected' })
  assert.equal(ws.levels.get('a1').uses, undefined)
  const before = ws.snapshot()
  const refused = await runChangeset(ws, { ops: [{ op: 'level.set', level: 'ptoy/a1', path: 'adds', value: ['library/missing'] }] }, { check: false, domain: { vocabulary: PVOCAB } })
  assert.equal(refused.ok, false)
  assert.match(refused.problems.join('\n'), /library\/missing/)
  assert.deepEqual(ws.snapshot(), before)
})

test('assembled part selectors and registry paths address layer-local source objects', async () => {
  const ws = openPartsPackage()
  const result = await runChangeset(ws, { ops: [
    { op: 'parts.set', path: ['parts', 'ptoy/sum', 'inputs', 0, 'label'], value: { en: 'First input' } },
    { op: 'part.add', part: 'ptoy/other', data: sum, after: 'ptoy/sum' },
  ] }, { check: false, domain: { vocabulary: PVOCAB } })
  assert.equal(result.ok, true, result.problems.join('\n'))
  assert.ok(result.changes.some(({ file }) => file.endsWith('/parts/sum.json')))
  assert.ok(result.changes.some(({ file }) => file.endsWith('/parts/other.json')))
  assert.equal(result.content.partDefs.parts['ptoy/sum'].inputs[0].label.en, 'First input')
  assert.ok(result.content.registries['circuit/part']['ptoy/other'])
})

test('package objects retain qualified names and translations across writes and reversible field edits', async () => {
  const root = toyRoot({ write: true })
  const ws = openToyPackage(root)
  const result = await runChangeset(ws, { ops: [
    { op: 'relation.put', relation: 'toy/package-path', data: { kind: 'requires', edges: [{ from: 'a1', to: 'a2' }] } },
    { op: 'tag.put', tag: 'toy/pick', member: 'level', data: { title: { en: 'Basics' }, values: ['toy/a1', 'toy/a2'] } },
    { op: 'section.put', section: 'toy/words', data: { title: { en: 'Words' }, values: ['toy/e'] } },
  ] }, { write: true, check: false, domain: DOMAIN })
  assert.equal(result.ok, true, result.problems.join('\n'))
  assert.ok(result.files.includes('packages/toy/tags/level/pick.json'))
  assert.ok(result.files.includes('packages/toy/sections/words.json'))
  const reopened = openToyPackage(root)
  const content = reopened.content()
  assert.deepEqual(content.sections['toy/words'].values, ['toy/e'])
  assert.equal(content.sections['toy/words'].title.en, 'Words')
  assert.deepEqual(content.tags['level:toy/pick'].values, ['toy/a1', 'toy/a2'])
  assert.equal(content.tags['level:toy/pick'].title.en, 'Basics')
  assert.deepEqual(content.relationEdges.requires, [{ from: 'toy/a1', to: 'toy/a2' }])
  roundTrip(reopened, 'tag.set', { tag: 'pick', member: 'level', path: 'values', value: [] })
  roundTrip(reopened, 'relation.set', { relation: 'package-path', path: 'edges', value: [] })
  roundTrip(reopened, 'section.set', { section: 'words', path: 'values', value: [] })
  assert.deepEqual(reopened.tags.get('level:pick').values, [])
  assert.deepEqual(reopened.relations.get('package-path').edges, [])
  assert.deepEqual(reopened.contentObjects.section.get('words').values, [])
  const refused = await runChangeset(ws, { ops: [{ op: 'tag.put', tag: '@toy/forbidden', member: 'level', data: { values: [] } }] }, { check: false, domain: DOMAIN })
  assert.equal(refused.ok, false)
})


test('removing a level clears its tag, relation placements and supports undo', () => {
  const ws = openToyGame()
  run(ws, 'tag.put', { tag: 'levels', member: 'level', data: { values: ['c1'] } })
  run(ws, 'relation.put', { relation: 'path', data: { kind: 'requires', edges: [{ from: 'b2', to: 'c1' }] } })
  roundTrip(ws, 'level.remove', { level: 'c1' })
  assert.deepEqual(ws.tags.get('level:levels').values, [])
  assert.deepEqual(ws.relations.get('path').edges, [])
})


test('entry membership cannot be patched through the encyclopedia projection', async () => {
  const root = toyRoot()
  const ws = openToyPackage(root)
  const result = await runChangeset(ws, { ops: [{ op: 'entry.patch', entry: 'e', fields: { group: 'g' } }] }, { check: false, domain: DOMAIN })
  assert.equal(result.ok, false)
  assert.match(result.problems.join('\n'), /not a field here/)
  assert.equal(ws.contentObjects.entry.get('e').group, undefined)
})


test('package operations write collection tags and local items on levels and tasks', async () => {
  const root = toyRoot({ write: true })
  const ws = openToyPackage(root)
  const result = await runChangeset(ws, { why: 'Declare package-owned progression.', ops: [
    { op: 'tag.put', tag: 'numbers', member: 'circuit/part', data: { values: ['a', 'b'] } },
    { op: 'level.set', level: 'a1', path: 'adds', value: ['a'] },
    { op: 'level.set', level: 'a1', path: 'local', value: ['#numbers'] },
    { op: 'level.set', level: 'a1', path: 'tasks[0].adds', value: ['b'] },
    { op: 'level.set', level: 'a1', path: 'tasks[0].local', value: ['b'] },
  ] }, { write: true, check: false, domain: DOMAIN })
  assert.equal(result.ok, true, result.problems.join('\n'))
  const reopened = openToyPackage(root).content()
  assert.deepEqual(reopened.tags['circuit/part:toy/numbers'].values, ['a', 'b'])
  assert.deepEqual(reopened.levels.find((level) => level.id === 'toy/a1').local, ['a', 'b'])
  assert.deepEqual(reopened.levels.find((level) => level.id === 'toy/a1').tasks[0].local, ['b'])
  const game = openToyGame(root)
  const refused = await runChangeset(game, { ops: [
    { op: 'level.set', level: 'a1', path: 'local', value: [] },
  ] }, { check: false, domain: DOMAIN })
  assert.equal(refused.ok, false)
})


test('package preview returns a single structured problem for a missing tag member', async () => {
  const root = toyRoot()
  const ws = openToyPackage(root)
  const result = await runChangeset(ws, { ops: [{ op: 'tag.put', tag: 'gone-test', member: 'level', data: { values: ['toy/nowhere'] } }] }, { check: false, domain: DOMAIN })
  const problems = result.lines.filter(line => line.problem?.target === 'toy/nowhere').map(line => line.problem)
  assert.equal(result.ok, false)
  assert.equal(result.failed, null)
  assert.equal(problems.length, 1)
  assert.deepEqual(problems[0].object, { kind: 'tag', name: 'toy/gone-test', member: 'level' })
  assert.equal(problems[0].path, 'values[0]')
  assert.equal(existsSync(join(root, 'packages/toy/tags/level/gone-test.json')), false)
})
