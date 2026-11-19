// View contracts over the public entries share one Vite server and circuit's transformed modules.
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createPluginKernel } from '../games/kit/engine/plugins.js'
import { loadModule, closeGames } from '../games/kit/engine/games.mjs'
import { register as registerTable } from '../packages/table/core/index.js'
import { content, task } from '../packages/tick/test/contract-fixture.js'

after(closeGames)

test('the circuit view registers the stage editor and renders the selected stage', async () => {
  const core = await loadModule(new URL('../packages/circuit/core/index.js', import.meta.url).pathname)
  const view = await loadModule(new URL('../packages/circuit/view/index.jsx', import.meta.url).pathname)
  const kernel = createPluginKernel()
  core.register(kernel.forPackage('circuit', 'core'))
  view.register(kernel.forPackage('circuit', 'view'))
  kernel.pair([{ play: 'circuit/board' }], true)
  const { installStudioPlugins, editorSlot } = await loadModule(new URL('../games/kit/studio/editors.js', import.meta.url).pathname)
  installStudioPlugins(kernel)
  try {
    const content = { objectKinds: { 'circuit/stages': {} } }
    const StageChain = editorSlot(content, 'circuit/part', 'stageChain')
    const html = renderToString(createElement(StageChain, {
      part: 'sample/lift', namespace: 'sample', stage: 'sample/lift-free',
      raw: { stages: [{ id: 'lift-free', desc: 'Lift freely' }] },
    }))
    assert.match(html, /aria-selected="true"[^>]*><small>1<\/small><code>lift-free<\/code>/)
    assert.match(html, /Lift freely/)
  } finally {
    installStudioPlugins(null)
  }
})

test('tick core and view compose with circuit through public entries', async () => {
  const core = await loadModule(new URL('../packages/tick/core/index.js', import.meta.url).pathname)
  const view = await loadModule(new URL('../packages/tick/view/index.jsx', import.meta.url).pathname)
  const other = await loadModule(new URL('../packages/circuit/core/index.js', import.meta.url).pathname)
  const otherView = await loadModule(new URL('../packages/circuit/view/index.jsx', import.meta.url).pathname)
  const kernel = createPluginKernel()
  other.register(kernel.forPackage('circuit', 'core'))
  otherView.register(kernel.forPackage('circuit', 'view'))
  core.register(kernel.forPackage('tick', 'core'))
  view.register(kernel.forPackage('tick', 'view'))
  kernel.pair([task], true)
  const { preview } = kernel.tables.playView.get('tick/board')
  const game = view.default(content)
  const context = { content, task }
  globalThis.getComputedStyle ??= () => ({ getPropertyValue: () => '16' })
  const html = renderToString(createElement(preview, { context, task, work: core.busPlay.initial(context), onChange: () => {} }))
  assert.match(html, /class="cl-board"/)
  assert.match(html, />Bit</)
  assert.deepEqual(game.levels.map(level => level.id), [content.levels[0].id])
})

test('table view registers and renders escaped scenes independently of any robot catalog', async () => {
  const core = createPluginKernel()
  registerTable(core.forPackage('table', 'core'))
  const view = await loadModule(new URL('../packages/table/view/index.jsx', import.meta.url).pathname)
  view.register(core.forPackage('table', 'view'))
  const renderer = core.tables.display.get('table/scene')({ W: { start: 'S', end: 'E' }, robots: {}, icons: {} })
  const svg = renderer.sceneSVG({ cells: [{ id: 'a', x: 0, y: 0, w: 64, h: 64, value: '<unsafe>' }], edges: [] })
  assert.match(svg, /&lt;unsafe&gt;/)
  assert.doesNotMatch(svg, /<unsafe>/)
})
