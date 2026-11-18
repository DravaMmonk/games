// Small authored packages exercise mixed modules without reading installed games.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { proofsRoot, installImageFixture } from './fixture.js'
import { openGame } from '../../../games/kit/engine/ops/workspace.js'
import { runChangeset } from '../../../games/kit/engine/ops/changeset.js'
import { readContent, readPackage, runtimeOf } from '../../../games/kit/engine/resolver.js'
import { loadPlugins } from '../../../games/kit/engine/plugin-node.js'
import { evaluatePlay } from '../../../games/kit/engine/plugin-runtime.js'
import { checkGame } from '../../../games/kit/engine/checks.js'
import { packageLevel } from '../../../games/kit/engine/package-play.js'
import { closeGames } from '../../../games/kit/engine/games.mjs'
import { loadPlay } from '../../../games/kit/engine/play/node.mjs'
import { createPlay } from '../../../games/kit/engine/play/play.js'
import { newSession } from '../../../games/kit/engine/play/session.js'
import { fresh } from '../../../games/kit/shell/progress.js'

const roots = []
after(async () => { await closeGames(); roots.forEach(root => rmSync(root, { recursive: true, force: true })) })

test('logic and image compose in one game and retain layered text in standalone play', async () => {
  const { root, id } = proofsRoot()
  roots.push(root)
  installImageFixture(root)
  const put = (file, value) => {
    const path = join(root, file)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(value))
  }
  put('packages/z-pictures/package.json', { kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: { image: '^0.0.0' } })
  put('packages/z-pictures/i18n/en.json', { title: 'Same picture', brief: 'Pass the image through.', caption: 'The original image.' })
  put('packages/z-pictures/levels/same.json', {
    title: '@title', after: 'The output equals the input.', intro: [{ t: 'Compare the image.', fig: { part: 'image/mystery', input: 'image/square', caption: '@caption' } }],
    tasks: [{ id: 'same', play: 'image/graph', brief: '@brief', scene: 'image/filter', setup: { target: 'image/same' },
      tests: [{ label: 'Square', in: 'image/square' }], hidden: [{ label: 'Disk', in: 'image/disk' }], solution: ['out <- in'] }],
  })
  put('packages/z-copy/package.json', { kind: 'lib', version: '1.0.0', kernel: '^0.0.0', uses: { 'z-pictures': '^1.0.0' } })
  put('packages/z-copy/overrides/z-pictures/i18n/en.json', { brief: 'Keep every pixel.' })
  // Select packages through the public operation boundary; no image-only game fields are needed.
  const selected = await runChangeset(openGame(id, root), { ops: [
    ...['imglib', 'cvlib', 'mllib'].map(id => ({ op: 'game.package.add', package: id, range: '^0.0.0' })),
    { op: 'game.package.add', package: 'image', range: '^0.0.0' }, { op: 'game.package.add', package: 'z-pictures', range: '^1.0.0' }, { op: 'game.package.add', package: 'z-copy', range: '^1.0.0' },
    { op: 'chapter.set', chapter: 'ground', path: 'levels', value: [`${id}/given`, `${id}/apply`, `${id}/suppose`, 'z-pictures/same'] },
  ] }, { write: true })
  assert.equal(selected.ok, true, selected.problems.join('\n'))
  const content = readContent(id, root)
  assert.equal(content.views, undefined)
  assert.equal(content.registries.level['z-pictures/same'].tasks[0].brief.en, 'Keep every pixel.')
  assert.equal(content.registries.level[`${id}/apply`].tasks[0].brief.en.length > 0, true)
  const kernel = await loadPlugins(content, root)
  const imageTask = content.registries.level['z-pictures/same'].tasks[0]
  assert.equal(evaluatePlay(kernel, imageTask, ['out <- in'], { content, task: imageTask }).verdict.pass, true)
  const runtime = await runtimeOf(content)
  const spec = runtime.spec(content)
  assert.deepEqual(spec.levels.map(level => level.id), content.sourceChapters[0].levels)
  assert.deepEqual((await checkGame(content, { domain: runtime, root })).filter(line => line.fail), [])
  // The overlay package can open the image task without a chapter or unlock state.
  const support = readPackage('z-copy', root)
  const shell = packageLevel(support, 'z-pictures/same')
  const standalone = await loadPlay(shell)
  const solo = createPlay({ game: standalone.shell, hook: standalone.hook, course: standalone.course, record: newSession({ game: shell.id, session: 'mixed', progress: fresh() }) })
  assert.equal(solo.attempt('out <- in').pass, true)
  const { shell: game, hook, course } = await loadPlay(content)
  const play = createPlay({ game, hook, course, record: newSession({ game: id, session: 'mixed-game', progress: fresh() }) })
  assert.equal(play.attempt('goal <- p').pass, true)
  play.giveUp()
  play.giveUp()
  assert.equal(play.attempt('out <- in').pass, true)
})
