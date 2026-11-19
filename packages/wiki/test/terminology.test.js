import { test } from 'node:test'
import assert from 'node:assert/strict'
import { termRegistry, termUsage } from '../core/terminology.js'
import { GLOSSARY } from '../core/schema.js'
import { validate } from '../../../games/kit/engine/schema.js'

const t = (zh, en) => ({ zh, en })
const entry = (id, fields = {}) => ({ id, group: 'g', title: t('光轴', 'Optical axis'), body: [t('穿过小孔、垂直像平面的直线。', 'The line through the hole perpendicular to the image plane.')], ...fields })
const registry = (...entries) => termRegistry({ entries })
const place = (text, fields = {}) => ({ at: 'task.intro.zh', side: 'zh', text, ...fields })
const ref = (id) => `<wiki-ref to="${id}"></wiki-ref>`
const rules = (xs) => xs.map((f) => f.rule)

test('the existing entry body is the definition; bilingual and neutral aliases share its id', () => {
  const e = entry('axis', { aliases: [t('相机轴', 'Camera axis'), 'OA'] })
  const r = registry(e)
  assert.deepEqual(r.failures, [])
  assert.deepEqual(r.entries.get('axis').body, e.body)
  assert.equal(r.names.zh.get('相机轴'), 'axis')
  assert.equal(r.names.en.get('camera axis'), 'axis')
  assert.equal(r.names[''].get('oa'), 'axis')
  assert.deepEqual(validate(GLOSSARY, { groups: [{ id: 'g', title: 'G' }], entries: [{ ...e, title: { en: e.title.en }, body: [{ en: e.body[0].en }], aliases: [{ en: 'Camera axis' }, 'OA'] }] }), [])
  assert.ok(validate(GLOSSARY, { groups: [], entries: [entry('axis', { aliases: ['OA'], summary: 'a second definition' })] }).some((p) => p.at.endsWith('summary')))
})

test('empty names, empty/reference-only definitions and conflicting term names fail', () => {
  assert.ok(rules(registry(entry('axis', { title: t('光轴', ''), aliases: [t('别名', '')], body: [t(ref('other'), '<b> </b>')] })).failures).includes('term-definition'))
  assert.ok(rules(registry(entry('axis', { title: t('', '') })).failures).includes('term-name'))
  assert.deepEqual(registry(entry('axis', { title: { ja: '光軸' }, body: [{ ja: '光の中心軸。' }] })).failures, [])
  assert.ok(rules(registry(entry('axis'), entry('axis')).failures).includes('term-id'))
  const r = registry(entry('a', { aliases: [t('相机轴', '  Camera   AXIS ')] }), entry('b', { title: t('另一条轴', 'camera axis') }))
  assert.deepEqual(rules(r.failures), ['term-name-conflict'])
})

test('explanations follow actual prerequisites, including parallel routes and optional branches', () => {
  const r = registry(entry('axis', { at: 'left' }), entry('extra', { title: 'Extra', at: 'optional' }), entry('open', { title: 'Open' }))
  const before = (a, b) => ({ left: ['start'], right: ['start'], join: ['start', 'left', 'right'] }[b] ?? []).includes(a)
  const use = (id, level) => termUsage(r, [place(ref(id), { level })], before)
  assert.deepEqual(use('axis', 'left'), [])
  assert.deepEqual(use('axis', 'join'), [])
  assert.deepEqual(rules(use('axis', 'right')), ['term-unavailable'])
  assert.deepEqual(rules(use('extra', 'join')), ['term-unavailable'])
  assert.deepEqual(rules(use('axis', undefined)), ['term-unavailable'])
  assert.deepEqual(use('open', undefined), [])
  assert.deepEqual(rules(use('unknown', 'join')), ['term-reference'])
})

test('bad reference markup fails; either language is checked without mistaking part refs for terms', () => {
  const r = registry(entry('axis'))
  for (const text of ['<wiki-ref to="axis"/>', '<wiki-ref to="axis">axis</wiki-ref>', '<wiki-ref to=""></wiki-ref>']) {
    assert.ok(rules(termUsage(r, [place(text, { side: 'en' })], () => false)).includes('term-reference-format'))
  }
  assert.deepEqual(termUsage(r, [place('<part-ref to="unknown"></part-ref>')], () => false), [])
  assert.deepEqual(rules(termUsage(r, [place(ref('missing'), { side: 'en', at: 'task.hint.en' })], () => false)), ['term-reference'])
})

test('plain terminology is accepted and plain-text fields reject link markup', () => {
  const r = registry(entry('axis'))
  const desc = (text) => termUsage(r, [place(text, { literal: { rule: 'part-description-reference', says: 'component descriptions are plain text; write names without reference markup' } })], () => false)
  assert.deepEqual(desc('沿光轴移动。'), [])
  assert.deepEqual(rules(desc(ref('axis'))), ['part-description-reference'])
  assert.deepEqual(rules(desc('<part-ref to="camera"></part-ref>')), ['part-description-reference'])
  assert.deepEqual(termUsage(r, [place('沿光轴移动。')], () => false), [])
})
