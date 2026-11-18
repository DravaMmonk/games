import test from 'node:test'
import assert from 'node:assert/strict'
import { S, find, shapeAt, validate } from './schema.js'
import { describe } from './content-schemas.js'
import { qualifyVocabulary } from './capabilities.js'
import { withKindDeclarations } from './plugin-kinds.js'
import { structureProblems } from './release-data.js'

const about = { en: 'The result appears after submitting.', zh: '提交后才显示这个结果。' }
const declaration = { declares: 'package', overrides: {} }
const shape = (name, value) => ({ kind: 'shape', name, value })
const level = task => ({ title: 'Example', tasks: [{ id: 'one', brief: 'Run it', play: 'sample/run', ...task }] })

test('one play schema reads registered cases owned by multiple packages', () => {
  const layers = [
    { id: 'sample', objects: [
      shape('result', S.text({ about })),
      shape('first', S.obj({ model: S.oneOf(['sample/first']), result: S.shape('sample/result') })),
      { kind: 'kind', name: 'task', value: { ...declaration, extends: 'task', play: 'sample/run', caseGroups: 'model', fields: {
        config: { type: 'by', field: 'model', casesFrom: 'model' },
      } } },
    ] },
    { id: 'course', config: { uses: { sample: '^1.0.0' } }, objects: [
      shape('second', S.obj({ model: S.oneOf(['course/second']), note: S.opt(S.shape('sample/result')) })),
    ] },
  ]
  const vocabulary = withKindDeclarations({ kinds: { model: {
    'sample/first': { shape: 'sample/first' }, 'course/second': { shape: 'course/second' },
  } } }, layers, true)
  const example = level({ config: { model: 'course/second', note: 'Ready' } })
  assert.deepEqual(validate(vocabulary.level, example, { vocabulary }), [])
  const path = ['tasks', 0, 'config', 'note']
  assert.deepEqual(shapeAt(vocabulary.level, example, path, { vocabulary }), S.opt(S.text({ about })))
  assert.ok(find(vocabulary.level, example, 'text', { vocabulary }).some(field => field.path.join('.') === path.join('.')))
  assert.equal(describe(vocabulary).shapeDeclarations['course/second'].fields.note.name, 'sample/result')
  assert.deepEqual(validate(vocabulary.level, level({ config: { model: 'sample/first' } }), { vocabulary }), [
    { at: '.tasks[0].config.result', says: 'is missing' },
  ])
})

test('shape references qualify, reject missing shapes and reject cycles even when unused', () => {
  const vocab = qualifyVocabulary('sample', { kinds: { item: { one: { params: S.shape('word') } } } })
  assert.equal(vocab.kinds.item['sample/one'].params.name, 'sample/word')
  assert.throws(() => withKindDeclarations(vocab, [{ id: 'sample', objects: [shape('a', S.shape('sample/missing'))] }]), /undeclared schema shape sample\/missing/)
  assert.throws(() => withKindDeclarations(vocab, [{ id: 'sample', objects: [
    shape('a', S.list(S.shape('sample/b'))), shape('b', S.shape('sample/a')),
  ] }]), /schema shape cycle/)
  assert.throws(() => withKindDeclarations(vocab, [{ id: 'sample', objects: [shape('a', S.text({ about: { en: 'Missing Chinese' } }))] }]), /needs Chinese text/)
})

test('expansion retains string patterns and schema compatibility ignores tooltip removal', () => {
  const authored = S.str({ pattern: '^[a-z_][a-z_0-9]*$', about })
  const vocabulary = { shapes: { 'sample/word': authored } }
  const word = S.shape('sample/word')
  assert.deepEqual(validate(word, '_item1', { vocabulary }), [])
  assert.deepEqual(validate(word, '1item', { vocabulary }), validate(authored, '1item'))
  assert.deepEqual(structureProblems(authored, S.str({ pattern: authored.pattern })), [])
  assert.deepEqual(structureProblems(S.str(), authored), ['surface.pattern is a new bound'])
})
