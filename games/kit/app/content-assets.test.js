import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contentAssets, CONTENT_FILE } from './content-assets.js'
import { S } from '../engine/schema.js'
import { CHAPTERS } from '../engine/course-schema.js'
import { assemble } from '../engine/content.js'
import { pageContent } from './page-content.js'

test('the page loads independent course and package catalogs, and a translation changes the manifest', async () => {
  const vocabulary = { kinds: {}, game: S.obj({ title: S.text(), chapters: CHAPTERS }), level: S.obj({ title: S.text() }) }
  const courseTitle = { en: 'Course', zh: '课程', $key: '@toy/heading' }
  const chapterTitle = { en: 'Opening', zh: '开场', $key: '@toy/chapter' }
  const levelTitle = { en: 'Level', zh: '关卡', $key: 'toy/heading' }
  const content = assemble({
    id: 'toy',
    schemas: vocabulary,
    game: { title: courseTitle, chapters: ['@toy/main'] },
    contentObjects: { chapter: { '@toy/main': { title: chapterTitle, levels: ['toy/first'] } } },
    levels: [['toy/first', { title: levelTitle }]],
  })
  const assets = contentAssets(content)
  const manifest = JSON.parse(assets.get(CONTENT_FILE))
  assert.equal(manifest.game.title, '@@toy/heading')
  assert.equal(manifest.levels[0][1].title, '@toy/heading')
  assert.deepEqual(JSON.parse(assets.get(manifest.locales.package.zh)), { 'toy/heading': '关卡' })
  assert.deepEqual(JSON.parse(assets.get(manifest.locales.course.zh)), { '@toy/chapter': '开场', '@toy/heading': '课程' })

  const restored = await pageContent(manifest, 'https://example.test/toy/', (url) => new Response(assets.get(url.pathname.slice('/toy/'.length))), vocabulary)
  assert.deepEqual(restored.objectProblems, [])
  assert.deepEqual(restored.title, courseTitle)
  assert.deepEqual(restored.sourceChapters, [{ id: '@toy/main', title: chapterTitle, levels: ['toy/first'] }])
  assert.deepEqual(restored.levels, [{ id: 'toy/first', title: levelTitle }])

  const revised = contentAssets({ ...content, title: { ...content.title, en: 'Course title' } })
  const next = JSON.parse(revised.get(CONTENT_FILE))
  assert.notEqual(next.locales.course.en, manifest.locales.course.en)
  assert.equal(next.locales.course.zh, manifest.locales.course.zh)
  assert.deepEqual(next.locales.package, manifest.locales.package)

  const duplicate = { ...content, levels: [...content.levels, { ...content.levels[0], id: 'second' }] }
  assert.throws(() => contentAssets(duplicate), /package: text key toy\/heading is used by multiple fields/)
})

test('browser assembly resolves kind metadata from the published package catalogs', async () => {
  const declaration = { declares: 'package', overrides: { package: ['*'], game: ['$text'] }, folder: 'pictures', schema: { type: 'obj', fields: {} }, studio: { name: '@sample/kind.picture.name', icon: 'Image' } }
  const manifest = {
    id: 'sample', game: {}, levels: [], glossary: { groups: [], entries: [] },
    contentObjects: { kind: { 'sample/picture': declaration }, 'sample/picture': {} },
    locales: { course: {}, package: { en: 'i18n/package/en.json' } },
  }
  const content = await pageContent(manifest, 'https://example.test/sample/',
    () => new Response(JSON.stringify({ 'sample/kind.picture.name': 'Picture' })),
    { packageCode: true })
  assert.equal(content.objectKinds['sample/picture'].studio.name.en, 'Picture')
})
