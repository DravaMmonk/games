// Exercise the installed platform against an isolated content workspace.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'
import { chromium } from 'playwright'
import { testArgs, testEnv, testFiles } from '../games/kit/engine/test-files.js'

const app = import.meta.dirname
const kit = resolve(app, '../games/kit')
const root = mkdtempSync(resolve(tmpdir(), 'kit-zero-'))
const env = testEnv({ GAMES_ROOT: root })
const run = promisify(execFile)
const command = async args => {
  const { stdout, stderr } = await run(process.execPath, args, { cwd: app, env, maxBuffer: 32 << 20 })
  process.stdout.write(stdout)
  process.stderr.write(stderr)
}
const put = (path, value) => {
  const file = resolve(root, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}
let server
let browser
try {
  mkdirSync(resolve(root, 'packages'))
  mkdirSync(resolve(root, 'games'))
  const tests = testFiles(kit)
  await command(testArgs(tests, ['--test-reporter=dot']))
  console.log(`Empty workspace: ${tests.length} kernel test files passed`)
  await command([resolve(kit, 'engine/check.js')])

  process.env.GAMES_ROOT = root
  const { createServer } = await import('vite')
  browser = await chromium.launch()
  const errors = []
  const expectedRecoveryError = 'Studio source recovery test'
  const recordError = message => { if (message !== expectedRecoveryError) errors.push(message) }
  let recoveringSource = false
  const recoveryReads = []
  const catalogRead = url => /\/studio\/api\/(games|packages)$/.test(url)
  const page = await browser.newPage()
  await page.addInitScript(() => {
    if (location.protocol === 'http:' && !localStorage.getItem('games.lang')) localStorage.setItem('games.lang', 'en')
  })
  page.on('pageerror', error => recordError(error.message))
  page.on('console', message => {
    if (recoveringSource && catalogRead(message.location().url) && message.text().includes('422')) return
    if (message.type() === 'error') recordError(message.text())
  })
  page.on('response', response => {
    if (recoveringSource && response.status() === 422 && catalogRead(response.url())) {
      recoveryReads.push(response.json())
    } else if (response.status() >= 400) {
      errors.push(`${response.status()} ${response.url()}`)
    }
  })
  const openServer = async () => {
    server = await createServer({ root: app, mode: 'studio', configFile: resolve(app, 'vite.config.js'),
      cacheDir: resolve(root, '.vite'), server: { host: '127.0.0.1', port: 0, strictPort: false, open: false }, logLevel: 'error',
    })
    await server.listen()
    return `http://127.0.0.1:${server.httpServer.address().port}`
  }
  let base = await openServer()
  const startup = Promise.withResolvers()
  const waitForPlugins = async route => { await startup.promise; await route.continue() }
  await page.route('**/*studio-domains*', waitForPlugins)
  try {
    const catalogsStarted = page.waitForRequest('**/studio/api/packages')
    await page.goto(`${base}/studio.html`, { waitUntil: 'commit' })
    await catalogsStarted
    await page.locator('.studio-loading[role="status"] .studio-spin').waitFor()
  } finally {
    startup.resolve()
    await page.unrouteAll({ behavior: 'wait' })
  }
  await page.getByText(/^(没有内容|No content)$/).waitFor().catch(async error => { console.error(await page.locator('body').innerText(), errors); throw error })
  assert.deepEqual(errors, [])
  await page.goto('about:blank')
  await server.close()
  server = null
  console.log('Empty Studio opened without browser errors')

  // Install only the text mechanism, with one freshly authored level and no circuit provider.
  const sourceFile = (path, text) => {
    const file = resolve(root, 'packages/text', path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text)
  }
  sourceFile('core/index.js', `
    const same = value => value
    export function register(kernel) {
      kernel.play('text/answer', {
        initial: () => '', read: same, write: same, normalize: same,
        run: (answer, { task }) => ({ pass: answer === task.answerRule.answer }),
        judge: report => ({ pass: report.pass, score: Number(report.pass) }),
      })
      kernel.check('text/course', Object.assign(({ spec }) =>
        spec.levels.length === 1 ? [{ fail: true, level: spec.levels[0].id, text: 'Course needs a second level' }] : [],
      { phase: 'course' }))
    }
  `)
  sourceFile('view/index.jsx', `
    function Answer({ work, onChange, onSubmit }) {
      return <form onSubmit={event => { event.preventDefault(); onSubmit() }}>
        <input aria-label="Answer" value={work} onChange={event => onChange(event.target.value)} />
      </form>
    }
    export function register(kernel) {
      kernel.play('text/answer', { component: Answer, preview: Answer })
    }
  `)
  put('packages/text/kinds/task.json', {
    extends: 'task', play: 'text/answer', declares: 'package', overrides: { package: ['*'], game: ['$text'] },
    fields: { answerRule: { type: 'any' }, referenceAnswer: { type: 'str' }, wrongAnswers: { type: 'list', of: { type: 'str' } } },
  })
  put('packages/text/package.json', { kind: 'feature', type: 'module', version: '0.0.0', kernel: '^0.0.0', uses: {}, title: '@package.title', desc: '@package.desc' })
  put('packages/text/i18n/zh.json', { 'package.title': '文字作答', 'package.desc': '提供文字作答玩法。' })
  put('packages/text/i18n/en.json', { 'package.title': 'Text answers', 'package.desc': 'Provides a play mode for text answers.' })
  put('packages/text/levels/hello.json', { title: 'Hello', after: 'Correct.', tasks: [{ id: 'hello', play: 'text/answer', brief: 'Type hello.', answerRule: { type: 'exact', answer: 'hello' }, referenceAnswer: 'hello', wrongAnswers: ['no'] }] })
  await command([resolve(kit, 'engine/deps.js'), 'lock', '--package', 'text'])
  await command([resolve(kit, 'engine/check.js'), '--package', 'text'])
  base = await openServer()
  await page.goto(`${base}/studio.html?package=text`)
  await page.locator('.studio-loading').waitFor({ state: 'detached' })
  await page.getByText('Hello', { exact: true }).first().waitFor()
  await page.getByRole('button', { name: /^(源码|Source)$/ }).click()
  const editor = page.getByRole('textbox', { name: /^(JavaScript 源码|JavaScript source)$/ })
  await editor.waitFor()
  assert.match(await editor.inputValue(), /export function register/)
  await page.getByRole('button', { name: /^(新建|New)$/ }).click()
  await page.getByRole('textbox', { name: /^(新文件路径|New file path)$/ }).fill('test/studio-source.test.js')
  await page.getByRole('button', { name: /^(创建草稿|Create draft)$/ }).click()
  const source = "import { test } from 'node:test'\ntest('saved by Studio', () => {})\n"
  await editor.fill(source)
  await page.getByRole('button', { name: /^(保存源码|Save source)$/ }).click()
  await page.getByText(/^(已保存到工作区|Saved to workspace)$/).waitFor()
  assert.equal(readFileSync(resolve(root, 'packages/text/test/studio-source.test.js'), 'utf8'), source)
  await page.getByRole('button', { name: /^(检查包|Check package)$/ }).click()
  await page.getByRole('heading', { name: /^(包检查通过|Package checks passed)$/ }).waitFor().catch(async error => {
    console.error(await page.locator('body').innerText())
    throw error
  })
  await page.locator('.package-source-report').filter({ hasText: 'saved by Studio' }).waitFor()

  await page.goto(`${base}/studio.html?package=text&capability=play%2Ftext%2Fanswer`)
  await page.getByRole('button', { name: /^(在源码中查找|Find in source)$/ }).click()
  await editor.waitFor()
  const original = await editor.inputValue()
  assert.match(original, /kernel.play\('text\/answer'/)
  await editor.fill(original + `\nthrow new Error(${JSON.stringify(expectedRecoveryError)})\n`)
  await page.getByRole('button', { name: /^(保存源码|Save source)$/ }).click()
  await page.getByText(/^(已保存到工作区|Saved to workspace)$/).waitFor()
  recoveringSource = true
  await page.getByRole('link', { name: /^(返回构建|Back to Build)$/ }).click()
  assert.match(readFileSync(resolve(root, 'packages/text/core/index.js'), 'utf8'), /Studio source recovery test/)
  await page.getByRole('alert').filter({ hasText: expectedRecoveryError }).waitFor().catch(async error => {
    console.error(await page.locator('body').innerText(), errors)
    throw error
  })
  await page.getByRole('link', { name: /^(打开包源码|Open package source)$/ }).click()
  await editor.waitFor()
  await editor.fill(original)
  await page.getByRole('button', { name: /^(保存源码|Save source)$/ }).click()
  await page.getByText(/^(已保存到工作区|Saved to workspace)$/).waitFor()
  recoveringSource = false
  for (const { error } of await Promise.all(recoveryReads)) assert.equal(error, expectedRecoveryError)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('link', { name: /^(返回构建|Back to Build)$/ }).click()
  await page.getByRole('tab', { name: /^(关卡|Levels)$/ }).click().catch(async error => {
    console.error(await page.locator('body').innerText(), errors)
    throw error
  })
  await page.getByText('Hello', { exact: true }).first().waitFor()
  await page.goto(`${base}/studio.html?package=text&source=test%2Fstudio-source.test.js`)
  await editor.waitFor()
  assert.equal(await editor.inputValue(), source)
  await editor.fill(source + '// Edited on the phone.\n')
  await page.getByRole('button', { name: /^(保存源码|Save source)$/ }).click()
  await page.getByText(/^(已保存到工作区|Saved to workspace)$/).waitFor()
  assert.match(readFileSync(resolve(root, 'packages/text/test/studio-source.test.js'), 'utf8'), /Edited on the phone/)
  console.log('Studio created, edited, checked and reloaded package source on desktop and phone')
  assert.deepEqual(errors, [])
  await page.goto('about:blank')
  await server.close()
  server = null
  console.log('Package-only Studio opened without a game')

  put('games/minimal/game.json', { kernel: '^0.0.0', packages: { text: '^0.0.0' }, title: 'Minimal', topic: 'Text', lede: 'One answer.', chapters: ['@minimal/main'] })
  put('games/minimal/chapters/main.json', { chapter: { title: 'Main' }, levels: ['text/hello'] })
  await command([resolve(kit, 'engine/deps.js'), 'lock', '--game', 'minimal'])
  await command([resolve(kit, 'engine/check.js'), '--game', 'minimal'])
  base = await openServer()
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${base}/studio.html?space=arrange&game=minimal`)
  const chapterTitle = page.locator('#arrange-main h1 input')
  const courseFinding = page.locator('.audit-row.is-fail').filter({ hasText: 'Course needs a second level' })
  const audit = page.getByRole('tab', { name: /^(审计|Audit)$/ })
  await chapterTitle.waitFor()
  if (await audit.getAttribute('aria-selected') === 'false') await audit.click()
  await courseFinding.waitFor()
  const draftedAudit = page.waitForResponse(response => {
    if (!response.url().endsWith('/studio/api/preview')) return false
    const { courseAudit, changeset } = response.request().postDataJSON()
    return courseAudit && changeset.ops.length > 0
  })
  await chapterTitle.fill('Studio draft')
  await chapterTitle.press('Enter')
  const draftReport = await (await draftedAudit).json()
  assert.equal(draftReport.ok, true)
  assert.deepEqual(draftReport.auditLines.flatMap(line => line.levels), ['text/hello'])
  const addedLevel = 'packages/text/levels/added.json'
  const finalLevel = 'packages/text/levels/final.json'
  const route = 'packages/text/relations/route.json'
  const originalLevel = JSON.parse(readFileSync(resolve(root, 'packages/text/levels/hello.json'), 'utf8'))
  const fixtureLevel = (id, title) => ({ ...originalLevel, title, tasks: [{ ...originalLevel.tasks[0], id }] })
  // Simulate an external atomic save and a game config edit without a Studio API write.
  put(`${addedLevel}.tmp`, fixtureLevel('added', 'Added on disk'))
  renameSync(resolve(root, `${addedLevel}.tmp`), resolve(root, addedLevel))
  put(finalLevel, fixtureLevel('final', 'Route end'))
  put(route, { kind: 'requires', edges: [
    { from: 'text/hello', to: 'text/added' },
    { from: 'text/added', to: 'text/final' },
    { from: 'text/hello', to: 'text/final' },
  ] })
  put('games/minimal/chapters/main.json', { chapter: { title: 'Main' }, levels: ['text/hello', 'text/added', 'text/final'] })
  const added = page.locator('#arrange-main').getByText('Added on disk', { exact: true }).first()
  const redundant = page.locator('.audit-row.is-warn').filter({ hasText: 'the direct prerequisite text/hello is redundant because text/added already requires it' })
  await added.waitFor()
  assert.equal(await chapterTitle.inputValue(), 'Studio draft')
  await redundant.getByText('Warning', { exact: false }).first().waitFor().catch(async error => {
    console.error(await page.locator('.studio-audit').innerText(), errors)
    throw error
  })
  await page.locator('.drawer-bar.is-warn .audit-sum').waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => localStorage.setItem('games.lang', 'zh'))
  await page.reload()
  await added.waitFor()
  await redundant.getByText('警告', { exact: false }).first().waitFor()
  await chapterTitle.fill('Studio draft')
  await chapterTitle.press('Enter')
  put('games/minimal/chapters/main.json', { chapter: { title: 'Main' }, levels: ['text/hello'] })
  rmSync(resolve(root, route))
  rmSync(resolve(root, finalLevel))
  rmSync(resolve(root, addedLevel))
  await added.waitFor({ state: 'detached' })
  assert.equal(await chapterTitle.inputValue(), 'Studio draft')
  await courseFinding.waitFor()
  const reload = page.getByRole('button', { name: /^(重新加载 Studio|Reload Studio)$/ })
  await page.waitForFunction(() => document.querySelector('.studio-refresh')?.getAttribute('aria-busy') === 'false')
  const preview = Promise.withResolvers()
  const waitForPreview = async route => { await preview.promise; await route.continue() }
  await page.route('**/studio/api/preview', waitForPreview)
  try {
    const refreshed = page.waitForRequest('**/studio/api/preview')
    await reload.click()
    await refreshed
    await reload.locator('.studio-spin').waitFor()
    assert.equal(await reload.getAttribute('aria-busy'), 'true')
  } finally {
    preview.resolve()
    await page.unrouteAll({ behavior: 'wait' })
  }
  await page.waitForFunction(() => document.querySelector('.studio-refresh')?.getAttribute('aria-busy') === 'false')
  await page.locator('.studio-audit .audit[aria-busy="false"]').waitFor()
  await courseFinding.waitFor()
  assert.equal(await chapterTitle.inputValue(), 'Studio draft')
  assert.deepEqual(errors, [])
  console.log('Studio refreshed catalogs and automatically audited saved content and drafts on desktop and phone')

  const waitingAudit = Promise.withResolvers()
  const resumeAudit = Promise.withResolvers()
  await page.route('**/studio/api/preview', async route => {
    const { courseAudit, changeset } = route.request().postDataJSON()
    if (courseAudit && changeset.ops.length) {
      waitingAudit.resolve()
      await resumeAudit.promise
    }
    await route.continue()
  })
  try {
    await chapterTitle.fill('Save during audit')
    await chapterTitle.press('Enter')
    await waitingAudit.promise
    await page.getByRole('tab', { name: /^(修改日志|Change log)/ }).click()
    const applied = page.waitForResponse(response => response.url().endsWith('/studio/api/modify'))
    await page.getByRole('button', { name: /^(应用|Apply)$/ }).click()
    assert.equal((await (await applied).json()).ok, true)
    assert.match(readFileSync(resolve(root, 'games/minimal/chapters/main.json'), 'utf8'), /Save during audit/)
  } finally {
    resumeAudit.resolve()
    await page.unrouteAll({ behavior: 'wait' })
  }

  await page.evaluate(() => localStorage.setItem('games.lang', 'en'))
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.goto(`${base}/game/minimal/index.html?level=text/hello&lang=en`)
    const answer = page.getByRole('textbox', { name: 'Answer', exact: true })
    await answer.fill('hello').catch(async error => { console.error(await page.locator('body').innerText(), errors); throw error })
    await answer.press('Enter')
    await page.getByText('Passed', { exact: true }).first().waitFor()
    assert.deepEqual(errors, [])
  }
  console.log('Text-only game opened and passed on desktop and phone without browser errors')
} finally {
  await browser?.close()
  await server?.close()
  rmSync(root, { recursive: true, force: true })
}
