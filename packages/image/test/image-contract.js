import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { evaluatePlay } from '../../../games/kit/engine/plugin-runtime.js'
import { loadPlugins } from '../../../games/kit/engine/plugin-node.js'
import { runtimeOf } from '../../../games/kit/engine/resolver.js'
import { gameOf, closeGames } from '../../../games/kit/engine/games.mjs'
import { imageFixture } from './fixture.js'

// core: false where the image owner's core test already covers the same core (vision-complete); its view test still
// loads that core through the package's own layers.
export function imageContract(owner, { core = true } = {}) {
  let fixture
  before(() => { fixture = imageFixture(owner) })
  after(async () => {
    try {
      await closeGames()
    } finally {
      fixture?.cleanup()
    }
  })

  if (core) test(`${owner} core checks and blind-plays independently in Node`, async () => {
    const { shell: content } = fixture
    const runtime = await runtimeOf(content, fixture.root)
    const spec = runtime.spec(content)
    assert.deepEqual((await runtime.validate(spec)).filter(line => line.fail), [])
    const kernel = await loadPlugins(content, fixture.root)
    const task = content.levels[0].tasks[0]
    const context = { content, task }
    const good = evaluatePlay(kernel, task, task.solution, context)
    assert.equal(good.verdict.pass, true)
    assert.equal(evaluatePlay(kernel, task, task.naive, context).verdict.pass, false)
    const graph = kernel.tables.play.get(task.play)
    assert.deepEqual(graph.read(graph.write(good.work), context), good.work)
    const agent = kernel.tables.agent.get(task.play)
    assert.ok(agent.observe(context))
    assert.equal(agent.act(context, 'out <- in').pass, true)
    assert.equal(agent.act(context, 'a = image/shift[dir=right](in)\nout <- a').pass, false)
  })


  test(`${owner} composes and renders the registered image play`, async () => {
    const content = fixture.shell
    const game = await gameOf(content, { view: true })
    assert.deepEqual(game.levels.map(level => level.id), [content.standalone.level])
    const { pluginKernel: kernel } = game
    const task = content.levels[0].tasks[0]
    const context = { content, task, kernel }
    const require = createRequire(new URL('../../../site/package.json', import.meta.url))
    const { renderToString } = require('react-dom/server')
    const { createElement } = require('react')
    const { preview } = kernel.tables.playView.get(task.play)
    const html = renderToString(createElement(preview, { context, work: kernel.tables.play.get(task.play).initial(context), onChange: () => {} }))
    assert.match(html, /class="cl-board"/)
  })
}
