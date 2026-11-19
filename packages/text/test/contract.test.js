import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { readPackage } from '../../../games/kit/engine/resolver.js'
import { checkGame } from '../../../games/kit/engine/checks.js'
import { loadPlugins } from '../../../games/kit/engine/plugin-node.js'
import { evaluatePlay } from '../../../games/kit/engine/plugin-runtime.js'
import { runtimeFromPlugins } from '../../../games/kit/engine/runtime.js'
import { lockTarget } from '../../../games/kit/engine/releases.js'
import { testProject } from '../../../games/kit/engine/test-fixture.js'

const { root, put } = testProject('text-contract-')
let content, kernel
const answer = {
  id: 'sample', play: 'text/answer', brief: 'Enter the requested text.',
  answerRule: { type: 'exact', answer: 'sample answer' },
}
const writeLevel = task => put('packages/text/levels/sample.json', { title: '@sample.title', tasks: [task] })
before(async () => {
  const dir = resolve(root, 'packages/text')
  for (const name of ['capabilities', 'core', 'kinds', 'overrides', 'package.json']) {
    cpSync(new URL(`../${name}`, import.meta.url), resolve(dir, name), { recursive: true })
  }
  put('packages/text/i18n/en.json', { 'package.title': 'Text', 'package.desc': 'Text answers', 'sample.title': 'Sample answer' })
  put('packages/text/i18n/zh.json', { 'package.title': '文字', 'package.desc': '文字作答', 'sample.title': '示例作答' })
  writeLevel({ ...answer, referenceAnswer: 'sample answer', wrongAnswers: ['wrong'] })
  lockTarget({ kind: 'package', id: 'text' }, root)
  content = readPackage('text', root)
  kernel = await loadPlugins(content, root)
})
after(() => rmSync(root, { recursive: true, force: true }))

test('text core checks a declared answer and keeps it out of the public observation', async () => {
  const runtime = runtimeFromPlugins(content, kernel)
  const { lines } = await checkGame(content, { domain: runtime, authoring: true, root })
  assert.deepEqual(lines, [{ level: 'text/sample', fail: false, text: 'text/sample: text answers PASS', plugin: 'text/answers' }])
  const [level] = content.levels
  const ctx = { level: { source: { ...level, ...level.tasks[0] } } }
  assert.deepEqual(runtime.play.open(ctx), { title: 'Sample answer', brief: 'Enter the requested text.', choices: null })
  assert.equal(runtime.play.attempt(ctx, 'sample answer').verdict.pass, true)
  assert.equal(runtime.play.attempt(ctx, 'wrong').verdict.pass, false)
})

test('answer work preserves whitespace and judges finite numbers at the tolerance boundary', () => {
  const play = kernel.tables.play.get('text/answer')
  assert.equal(play.write(play.read(' a ')), ' a ')
  const task = { play: 'text/answer', answerRule: { type: 'number', answer: 5, tolerance: 0.5 } }
  for (const [answer, pass] of [['5.5', true], ['5.50001', false], ['', false], ['Infinity', false]]) {
    assert.deepEqual(evaluatePlay(kernel, task, answer), {
      work: answer, report: { answer, pass }, verdict: { pass, score: Number(pass) },
    })
  }
})

test('published text content retains data declarations and resolves bilingual copy', async () => {
  const { contentAssets } = await import('../../../games/kit/app/content-assets.js')
  const { pageContent } = await import('../../../games/kit/app/page-content.js')
  const { contentSchemas } = await import('../../../games/kit/engine/content.js')
  const assets = contentAssets(content)
  const manifest = JSON.parse(assets.get('content.json'))
  assert.equal(manifest.game.objectKinds, undefined)
  assert.equal(manifest.contentObjects.kind['text/answer'].extends, 'task')
  const page = await pageContent(manifest, 'https://example.test/game/', async url => ({ ok: true, json: async () => JSON.parse(assets.get(url.pathname.slice('/game/'.length))) }), contentSchemas.get(content))
  assert.equal(page.objectKinds['text/answer'].extends, 'task')
  assert.deepEqual(page.levels[0].title, { en: 'Sample answer', zh: '示例作答', $key: 'text/sample.title' })
  assert.equal(page.registries.tag['kind:kernel/studio-left'].values[0], 'level')
})

test('the platform check requires an executable answer rule and accepts a task without examples', async () => {
  const { answerRule: _, ...withoutRule } = answer
  const check = async task => {
    writeLevel(task)
    const content = readPackage('text', root)
    return (await checkGame(content, { domain: runtimeFromPlugins(content, kernel), root })).lines
  }
  assert.deepEqual(await check(answer), [])
  assert.deepEqual(await check({ ...answer, answerRule: { type: 'regex', pattern: '^yes$', flags: 'g' } }), [])
  const [missing] = await check(withoutRule)
  assert.deepEqual(missing, { level: 'text/sample', fail: true, text: 'text/sample: an answer rule is required', plugin: 'text/answer-rules' })
  const [malformed] = await check({ ...answer, answerRule: { type: 'regex', pattern: '[' } })
  assert.equal(malformed.plugin, 'text/answer-rules')
  assert.match(malformed.text, /^text\/sample: Invalid regular expression:/)
})
