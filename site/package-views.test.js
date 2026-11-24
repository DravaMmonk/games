// View contracts over the public entries share one Vite server and circuit's transformed modules.
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createPluginKernel, registerPlugins } from '../games/kit/engine/plugins.js'
import { evaluatePlay } from '../games/kit/engine/plugin-runtime.js'
import { loadModule as loadWorkspaceModule, closeGames } from '../games/kit/engine/games.mjs'
import { testProject } from '../games/kit/engine/test-fixture.js'
import { register as registerTable } from '../packages/table/core/index.js'
import { register as registerText } from '../packages/text/core/index.js'
import { content, task } from '../packages/tick/test/contract-fixture.js'

const { root } = testProject('platform-views-')
const loadModule = file => loadWorkspaceModule(file, root)
after(async () => {
  try {
    await closeGames()
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('notation labels keep accessible text and use vectors for signs and circled numbers', async () => {
  const entry = new URL('../packages/notation/view/index.jsx', import.meta.url).pathname
  const { NotationLabel } = await loadModule(entry)
  const label = String.raw`\mark{circle-2} \mark{backward} 照抄 \mark{rewrite}`
  const html = renderToString(createElement(NotationLabel, { label }))
  assert.match(html, /notation-label-text">2 (?:逆用|backward) 照抄 (?:改写|rewrite)<\/span>/)
  assert.match(html, /notation-label-art" aria-hidden="true"/)
  assert.deepEqual([...html.matchAll(/<svg [^>]*data-mark="([^"]+)"/g)].map((match) => match[1]), ['circle-2', 'backward', 'rewrite'])
  assert.equal(renderToString(createElement(NotationLabel, { label: 'Given' })), 'Given')
  assert.equal(renderToString(createElement(NotationLabel, { label: '⟵ Given' })), '⟵ Given')
})

test('opt-in prose draws notation inline and keeps literal code intact', async () => {
  const load = path => loadModule(new URL(path, import.meta.url).pathname)
  const { NotationText } = await load('../packages/notation/view/index.jsx')
  const { Markup } = await load('../games/kit/shell/Markup.jsx')
  const { SettingsContext } = await load('../games/kit/shell/useSetting.js')
  const text = String.raw`Use <strong>\mark{backward} Given</strong> or \mark{rewrite}. Type <code>\mark{rewrite}</code>.`
  const markup = createElement(Markup, { text })
  const regular = renderToString(markup)
  assert.doesNotMatch(regular, /<svg/)
  const html = renderToString(createElement(SettingsContext.Provider, { value: { renderProse: NotationText } }, markup))
  assert.match(html, /<strong><span class="notation-inline">/)
  assert.match(html, /<code>\\mark\{rewrite\}<\/code>/)
  assert.deepEqual([...html.matchAll(/<svg [^>]*data-mark="([^"]+)"/g)].map(match => match[1]), ['backward', 'rewrite'])
})

test('a single-level preview retains titles for references outside the played level', async () => {
  const load = path => loadModule(new URL(path, import.meta.url).pathname)
  const { configureGame } = await load('../games/kit/app/compose-game.js')
  const { packageLevel } = await load('../games/kit/engine/package-play.js')
  const title = { zh: '另一关', en: 'Another level' }
  const levels = [{ id: 'sample/played', title: 'Played' }, { id: 'sample/other', title }]
  const content = structuredClone(packageLevel({ id: 'sample', packageTarget: true, levels }, levels[0].id))
  const byId = { [levels[0].id]: levels[0] }
  const game = configureGame({ byId }, content, createPluginKernel())
  assert.deepEqual(game.libraryLevelTitles.get(levels[1].id), title)
  assert.deepEqual(Object.keys(game.byId), [levels[0].id])
})

test('standalone part references use authored names outside the earned parts catalog', async () => {
  const entry = new URL('../packages/circuit/view/shell.jsx', import.meta.url).pathname
  const { useCircuitShell } = await loadModule(entry)
  function Probe({ all }) {
    const game = { id: 'sample', levels: [], partDefs: { parts: { 'sample/apply': { name: 'Apply' } } } }
    const shell = useCircuitShell({ game, progress: { all } })
    assert.equal(shell.reference('part', 'part:sample/apply').title, 'Apply')
    assert.equal(shell.reference('part', 'part:sample/apply').open, all)
    assert.equal(shell.reference('part', 'part:sample/missing'), undefined)
    const fromDetail = shell.reference('part-detail', 'sample/apply', { name: 'Board label' })
    assert.equal(fromDetail.open, true)
    assert.equal(fromDetail.start.entry.name, 'Apply')
    const generated = shell.reference('part-detail', 'sample/generated', { name: 'Generated card' })
    assert.equal(generated.start.entry.part, 'sample/generated')
    assert.equal(generated.start.entry.name, 'Generated card')
    return null
  }
  for (const all of [true, false]) renderToString(createElement(Probe, { all }))
})

async function registeredBoardPreview(packages, level, data = {}) {
  const [task] = level.tasks
  const entries = await Promise.all(packages.map(async id => ({
    id,
    core: await loadModule(new URL(`../packages/${id}/core/index.js`, import.meta.url).pathname),
    view: await loadModule(new URL(`../packages/${id}/view/index.jsx`, import.meta.url).pathname),
  })))
  const kernel = await registerPlugins(entries, { tasks: [task], view: true })
  const content = {
    id: 'sample', title: 'Sample', standalone: { level: level.id }, eras: [], trays: {},
    partDefs: { parts: {} }, glossary: { groups: [], entries: [] },
    levels: [{ title: 'Sample board', intro: [], ...level }], ...data,
  }
  const context = { content, task, kernel }
  const { preview } = kernel.tables.playView.get(task.play)
  const work = kernel.tables.play.get(task.play).initial(context)
  return { html: renderToString(createElement(preview, { context, work, onChange() {} })), context, kernel }
}

test('the circuit view registers the stage editor and renders the selected stage', async () => {
  const entry = new URL('../packages/circuit/view/index.jsx', import.meta.url).pathname
  const views = await Promise.all(Array.from({ length: 4 }, () => loadModule(entry)))
  const [view] = views
  for (const loaded of views.slice(1)) assert.equal(loaded.register, view.register)
  const core = await loadModule(new URL('../packages/circuit/core/index.js', import.meta.url).pathname)
  const kernel = createPluginKernel()
  core.register(kernel.forPackage('circuit', 'core'))
  view.register(kernel.forPackage('circuit', 'view'))
  kernel.pair([{ play: 'circuit/board' }], true)
  const { installStudioPlugins, editorSlot } = await loadModule(new URL('../games/kit/studio/editors.js', import.meta.url).pathname)
  installStudioPlugins(kernel)
  try {
    assert.equal(editorSlot({ layerOrder: ['progress', 'sample'], objectKinds: { 'circuit/part': {} } }, 'circuit/part', 'stageChain'), undefined, 'without the circuit layer there is no stage chain')
    const content = { layerOrder: ['progress', 'circuit', 'sample'], objectKinds: { 'circuit/part': {} } }
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

test('a stage edited on the part page writes into that stage, starting from what it inherits', async () => {
  const { onPartPage, previewPartFace } = await loadModule(new URL('../packages/circuit/view/studio/part-page.js', import.meta.url).pathname)
  const raw = { name: 'Apply', rules: [{ set: { a: '1' } }], views: { card: [{ show: 'value' }] }, stages: [{ id: 'mp-bot', desc: 'Later' }, { id: 'mp-more' }] }
  const content = { partDefs: { parts: { 'qed/mp': raw } } }
  const page = (m) => {
    const edits = [], picks = []
    onPartPage({ part: 'qed/mp', ...m }, { content, ops: [], shown: { ops: [] }, edit: (op) => edits.push(op), pickField: (...args) => picks.push(args), vocabulary: null, playOrder: [] })
    return { edits, picks }
  }
  assert.deepEqual(page({ type: 'pick', stage: 'qed/mp-bot', path: ['desc'] }).picks, [[['parts', 'qed/mp', 'stages', 0, 'desc'], true]])
  assert.deepEqual(page({ type: 'pick', path: ['desc'] }).picks, [[['parts', 'qed/mp', 'desc'], true]], 'the part itself as before')
  const face = page({ type: 'add', stage: 'qed/mp-more', path: ['views', 'card'] })
  assert.deepEqual(face.edits, [{ op: 'parts.set', path: ['parts', 'qed/mp', 'stages', 1, 'views'], value: { card: [{ show: 'value' }] } }],
    'a stage with no views gets them, its first face the one it inherits')
  assert.deepEqual(face.picks[0][0], ['parts', 'qed/mp', 'stages', 1, 'views', 'card'])
  assert.deepEqual(page({ type: 'pick', stage: 'qed/missing', path: ['desc'] }), { edits: [], picks: [] }, 'a stage the part lacks edits nothing')
  const drafted = previewPartFace(content, ['parts', 'qed/mp', 'stages', 0, 'views', 'card'], [{ show: 'value' }])
  assert.deepEqual(drafted.partDefs.parts['qed/mp'].stages[0].views, { card: [{ show: 'value' }] })
  assert.deepEqual(drafted.partDefs.parts['qed/mp'].views, raw.views, 'the part keeps its own faces')
})

test('a build list shows the stages progress records under their object, and none without a stage policy', async () => {
  const progress = await loadModule(new URL('../packages/progress/core/index.js', import.meta.url).pathname)
  const kernel = createPluginKernel()
  progress.register(kernel.forPackage('progress', 'core'))
  const { installStudioPlugins } = await loadModule(new URL('../games/kit/studio/editors.js', import.meta.url).pathname)
  const { default: GroupedList } = await loadModule(new URL('../games/kit/studio/GroupedList.jsx', import.meta.url).pathname)
  installStudioPlugins(kernel)
  try {
    const entries = {
      'story/clue': { title: 'Clue', stages: [{ id: 'learned', title: 'Clue unlocked' }, { id: 'practised' }] },
      'story/note': { title: 'Note', stages: [{ id: 'kept' }] },
    }
    const policy = { 'story/entries': { kind: 'entry', targets: ['story/clue'], stages: true } }
    const list = (registries, props = {}) => renderToString(createElement(GroupedList, {
      kind: 'entry', name: 'Entries', content: { levels: [], registries: { entry: entries, ...registries } }, namespace: 'story', game: 'story',
      items: Object.keys(entries), label: id => entries[id].title, row: id => createElement('button', { key: id }, entries[id].title),
      groupings: [], by: 'tag', onBy() {}, onStage() {}, ...props,
    }))
    const html = list({ 'progress/policy': policy }, { stage: { of: 'story/clue', id: 'story/practised' } })
    assert.match(html, /aria-label="[^"]*Clue[^"]*"/)
    assert.match(html, /<small>1<\/small><span>Clue unlocked<\/span>/)
    assert.match(html, /class="tree-task tree-stage is-on"[^>]*aria-current="true"[^>]*><small>2<\/small><span>practised<\/span>/)
    assert.doesNotMatch(html, /kept/, 'an object outside the policy lists no stages')
    assert.doesNotMatch(list({}), /tree-stage/, 'without a progress policy no stages are listed')
    assert.doesNotMatch(list({ 'progress/policy': policy }, { onStage: null }), /tree-stage/, 'a list that cannot open stages lists none')
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

test('a registered image graph renders through the shared circuit view', async () => {
  const imageTask = {
    id: 'sample/copy', play: 'image/graph', brief: 'Connect the image.', scene: 'image/filter', setup: { target: 'image/same' },
    tests: [{ label: 'Square', in: 'image/square' }], solution: ['out <- in'],
  }
  const image = await registeredBoardPreview(['circuit', 'image'], { id: imageTask.id, tasks: [imageTask] }, { registries: { 'image/power': {} } })
  assert.match(image.html, /class="cl-board"/)
})

test('a registered proof board renders and evaluates prepared work', async () => {
  const proofTask = {
    id: 'sample/proof', play: 'logic/proof', kind: 'logic/proof', brief: 'Use the premise.', tests: [{ premises: { p: 'P' }, goal: 'P' }],
    solution: ['goal <- p'],
  }
  const proof = await registeredBoardPreview(['circuit', 'logic'], { id: proofTask.id, tasks: [proofTask] })
  assert.match(proof.html, /class="cl-board"/)
  assert.equal(evaluatePlay(proof.kernel, proofTask, proofTask.solution, proof.context).verdict.pass, true)
})

test('a robot board renders and checks work against the same prepared world', async () => {
  const { WORLDS } = await loadModule(new URL('../packages/state-graph/core/model/worlds.js', import.meta.url).pathname)
  const task = {
    id: 'sample/robot', play: 'state-graph/circuit', world: 'state-graph/grid',
    tests: [{ R: 1, C: 2, given: { '0,0': 7 } }], expected: [7], solution: ['cell <- view.left'],
  }
  const level = {
    id: task.id, robot: 'state-graph/scout', mission: { goal: 'Copy the previous cell.', how: 'Connect the sensor.' },
    debrief: { title: 'Done', body: [] }, tasks: [task],
  }
  const { html, context, kernel } = await registeredBoardPreview(['circuit', 'table', 'state-graph'], level, { tableWorlds: WORLDS })
  assert.match(html, /class="cl-board"/)
  assert.equal(evaluatePlay(kernel, task, task.solution, context).verdict.pass, true)
  assert.equal(evaluatePlay(kernel, task, ['cell <- view.up'], context).verdict.pass, false)
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

test('the robot window shows intrinsic sweep values and recorded table values', async () => {
  const { robotWindow } = await loadModule(new URL('../packages/table/view/ui/robotDrawing.js', import.meta.url).pathname)
  const { robotOf } = await loadModule(new URL('../packages/table/core/model/robots.js', import.meta.url).pathname)
  const { WORLDS } = await loadModule(new URL('../packages/state-graph/core/model/worlds.js', import.meta.url).pathname)
  const picture = robotWindow({
    world: WORLDS['state-graph/parts'], test: { s: 'cats', dict: { cats: 0, ats: 2 } }, robot: robotOf('state-graph/broom'),
    task: { facts: [], given: { offers: { view: ['seg', 'cost'], facts: [] } } },
    cell: { i: 4, id: '4' }, shown: new Map([['0', 5], ['1', null]]), reads: new Set(['0', '2']),
    empty: new Set(['2']), lit: ['cost'],
  })
  const [prior, cost] = picture.win.arm.sweeps
  assert.deepEqual(cost.cells.map(({ value }) => value), ['0', '2', '—', '—'])
  assert.deepEqual(prior.cells.map(({ value, state }) => [value, state]), [['5', 'read'], ['—', ''], ['', 'empty'], ['', '']])
})

test('a registered channel display and decision control render synthetic bench state', async () => {
  const kernel = createPluginKernel()
  const view = await loadModule(new URL('../packages/vision-complete/view/index.jsx', import.meta.url).pathname)
  view.register(kernel.forPackage('vision-complete', 'view'))
  const channels = kernel.tables.display.get('vision-complete/appleChannels')
  const decision = kernel.tables.display.get('vision-complete/appleDecision')
  const display = renderToString(createElement(channels, { ctx: { view: { channels: [[0, 0.5, 1]] } } }))
  assert.deepEqual([...display.matchAll(/aria-label="([^"]+)"/g)].map(([, label]) => label), ['A R 0.00', 'A G 0.50', 'A B 1.00'])
  const disabled = renderToString(createElement(decision, { ctx: { values: { pick: null } } }))
  const enabled = renderToString(createElement(decision, { ctx: { values: { pick: 'a' } } }))
  assert.match(disabled, /<button[^>]*disabled/)
  assert.doesNotMatch(enabled, /<button[^>]*disabled/)
})

test('text answers pair with the shell and render the registered preview', async () => {
  const kernel = createPluginKernel()
  registerText(kernel.forPackage('text', 'core'))
  const view = await loadModule(new URL('../packages/text/view/index.jsx', import.meta.url).pathname)
  view.register(kernel.forPackage('text', 'view'))
  const task = { play: 'text/answer' }
  kernel.pair([task], true)
  const { preview } = kernel.tables.playView.get(task.play)
  const input = renderToString(createElement(preview, { task, work: 'sample answer' }))
  assert.match(input, /<input[^>]*value="sample answer"/)
  const choices = renderToString(createElement(preview, { task: { ...task, choices: ['First', 'Second'] }, work: 'Second' }))
  assert.match(choices, /role="radio" aria-checked="false"[^>]*>First<\/button>/)
  assert.match(choices, /role="radio" aria-checked="true"[^>]*>Second<\/button>/)
})

test('the installed optimization view settles a task pass and supplies its map label', async () => {
  const { contentRoot, resolveLayers } = await import('../games/kit/engine/resolver.js')
  const { packageEntries } = await import('../games/kit/engine/plugin-node.js')
  const { completionResult } = await import('../games/kit/engine/completion-result.js')
  const { fresh, passed } = await import('../games/kit/shell/progress.js')
  const contentDir = contentRoot()
  const { layers } = resolveLayers({ package: 'optimization', root: contentDir })
  const entries = await Promise.all(packageEntries(layers, contentDir).map(async ({ id, core, view }) => ({
    id, core: await loadModule(core), view: view && await loadModule(view),
  })))
  const kernel = await registerPlugins(entries, { view: true })
  const { configureGame } = await loadModule(new URL('../games/kit/app/compose-game.js', import.meta.url).pathname)
  const level = { id: 'sample/level', tasks: [{ key: 'sample/first' }, { key: 'sample/second' }] }
  const content = { registries: { 'optimization/goal': {
    'sample/time': { rank: [{ metric: 'time', direction: 'min' }], label: '{time} s' },
  } } }
  const game = configureGame({ byId: { [level.id]: level } }, content, kernel)
  const first = passed(game, fresh(), level, 0, completionResult({ time: 4 }))
  const second = passed(game, first, level, 1)
  assert.deepEqual(second.solved, [level.id])
  assert.deepEqual(second.results, { 'sample/first': { 'sample/time': { values: { time: 4 } } } })
  assert.equal(game.completionLabel(second, level.tasks), '4 s')
})
