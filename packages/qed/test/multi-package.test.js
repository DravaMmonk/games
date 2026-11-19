// Small authored packages exercise mixed modules without reading installed games.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { proofsRoot, copyProofsRoot, installImageFixture } from './fixture.js'
import { lockTarget } from '../../../games/kit/engine/releases.js'
import { checkGame } from '../../../games/kit/engine/checks.js'
import { readContent, readPackage, runtimeOf } from '../../../games/kit/engine/resolver.js'
import { packageLevel } from '../../../games/kit/engine/package-play.js'
import { closeGames } from '../../../games/kit/engine/games.mjs'
import { loadPlay } from '../../../games/kit/engine/play/node.mjs'
import { createPlay } from '../../../games/kit/engine/play/play.js'
import { checkPlaytest, newSession } from '../../../games/kit/engine/play/session.js'
import { fresh } from '../../../games/kit/shell/progress.js'

const proofSeed = proofsRoot()
const roots = [proofSeed.root]
after(async () => { await closeGames(); roots.forEach(root => rmSync(root, { recursive: true, force: true })) })

test('logic and image compose in one game and retain layered text in standalone play', async () => {
  const { root, id } = copyProofsRoot(proofSeed)
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
  // Package-selection operations are covered by the engine's layer tests.
  const gameFile = `games/${id}/game.json`
  const config = JSON.parse(readFileSync(join(root, gameFile), 'utf8'))
  for (const dependency of ['imglib', 'cvlib', 'mllib', 'image']) config.packages[dependency] = '^0.0.0'
  put(gameFile, { ...config, packages: { ...config.packages, 'z-pictures': '^1.0.0', 'z-copy': '^1.0.0' } })
  const chapterFile = `games/${id}/chapters/ground.json`
  const chapter = JSON.parse(readFileSync(join(root, chapterFile), 'utf8'))
  put(chapterFile, { ...chapter, levels: [...chapter.levels, 'z-pictures/same'] })
  lockTarget({ kind: 'game', id }, root)
  lockTarget({ kind: 'package', id: 'z-copy' }, root)

  const content = readContent(id, root)
  assert.equal(content.registries.level['z-pictures/same'].tasks[0].brief.en, 'Keep every pixel.')
  const domain = await runtimeOf(content, root)
  const lines = await checkGame(content, { domain, root })
  assert.deepEqual(lines.filter(line => line.fail), [])
  assert.deepEqual(domain.spec(content).levels.map(level => level.id), content.sourceChapters[0].levels)
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

test('installed package references solve a textual session without exposing hidden work', async () => {
  const { root, id } = proofSeed
  const content = readContent(id, root)
  const { shell, hook, course } = await loadPlay(content)
  const record = newSession({ game: id, session: 'test', player: { kind: 'script' }, attempts: 50, progress: fresh() })
  const play = createPlay({ game: shell, course, hook, record })
  let solved = 0
  for (let guard = 0; guard < 20; guard++) {
    const view = play.view()
    if (!view.level) break
    const level = content.levels.find(level => level.id === view.level)
    const task = level.tasks[view.task]
    if (task.id === 'apply') assert.equal(play.attempt('goal <- r').pass, false)
    const answer = task.solution.join('\n')
    assert.ok(!view.text.includes(answer))
    const result = play.attempt(answer)
    assert.equal(result.pass, true, result.text)
    play.explain('The reference establishes the goal from the premises.')
    solved++
  }
  assert.equal(solved, content.levels.length)
  assert.equal(play.view().level, null)
  assert.deepEqual(checkPlaytest(record), [])
})
