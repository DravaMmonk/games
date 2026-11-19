import test from 'node:test'
import assert from 'node:assert/strict'
import { readPackage, runtimeOf } from '../../../games/kit/engine/resolver.js'
import { checkGame } from '../../../games/kit/engine/checks.js'
import { loadPlugins } from '../../../games/kit/engine/plugin-node.js'
import { evaluatePlay } from '../../../games/kit/engine/plugin-runtime.js'

const packageId = new URL('..', import.meta.url).pathname.split('/').filter(Boolean).at(-1)

// Package contracts validate their own authored levels, independently of any game.
test('text core registers in Node, checks and blind-plays every example without a view', async () => {
  const content = readPackage(packageId)
  const runtime = await runtimeOf(content)
  const lines = await checkGame(content, { domain: runtime })
  assert.equal(lines.filter(line => line.fail).length, 0, JSON.stringify(lines))
  for (const level of content.levels) {
    const task = { ...level, ...level.tasks[0] }
    const ctx = { level: { source: task } }
    const observation = runtime.play.open(ctx)
    assert.equal(observation.referenceAnswer, undefined)
    assert.equal(observation.wrongAnswers, undefined)
    assert.equal(runtime.play.attempt(ctx, task.referenceAnswer).verdict.pass, true)
    for (const answer of task.wrongAnswers) assert.equal(runtime.play.attempt(ctx, answer).verdict.pass, false)
  }
})

test('answer work round-trips and judging is deterministic at tolerance boundaries', async () => {
  const kernel = await loadPlugins(readPackage(packageId), new URL('../../../', import.meta.url).pathname)
  const play = kernel.tables.play.get('text/answer')
  assert.equal(play.write(play.read(' a ')), ' a ')
  const task = { play: 'text/answer', answerRule: { type: 'number', answer: 5, tolerance: 0.5 } }
  for (const [answer, pass] of [['5.5', true], ['5.50001', false], ['', false], ['Infinity', false]]) {
    assert.equal(evaluatePlay(kernel, task, answer).verdict.pass, pass)
    assert.deepEqual(evaluatePlay(kernel, task, answer), evaluatePlay(kernel, task, answer))
  }
})

test('published text content retains data declarations and resolves bilingual copy', async () => {
  const { contentAssets } = await import('../../../games/kit/app/content-assets.js')
  const { pageContent } = await import('../../../games/kit/app/page-content.js')
  const { contentSchemas } = await import('../../../games/kit/engine/content.js')
  const content = readPackage(packageId)
  const assets = contentAssets(content)
  const manifest = JSON.parse(assets.get('content.json'))
  assert.equal(manifest.game.objectKinds, undefined)
  assert.equal(manifest.contentObjects.kind['text/answer'].extends, 'task')
  const page = await pageContent(manifest, 'https://example.test/game/', async url => ({ ok: true, json: async () => JSON.parse(assets.get(url.pathname.slice('/game/'.length))) }), contentSchemas.get(content))
  assert.equal(page.objectKinds['text/answer'].extends, 'task')
  assert.equal(page.levels.find(level => level.id === 'text/exact').title.en, 'Copy the word')
  assert.equal(page.registries.tag['kind:kernel/studio-left'].values[0], 'level')
})
