// Small self-contained workspaces for platform tests.
import { constants, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { lockTarget } from './releases.js'
import { contentTargets, packageIds } from './resolver.js'

export function lockFixture(root) {
  for (const id of packageIds(root)) lockTarget({ kind: 'package', id }, root)
  for (const target of contentTargets([], root, { game: true })) lockTarget(target, root)
}

export function testProject(prefix = 'games-test-') {
  const root = mkdtempSync(resolve(tmpdir(), prefix))
  const put = (path, value) => {
    const file = resolve(root, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
  }
  return { root, put }
}

/** Copy a fixture so each test can edit the workspace independently. */
export function copyTestProject(seed, prefix) {
  const project = testProject(prefix)
  try {
    cpSync(seed, project.root, { recursive: true, mode: constants.COPYFILE_FICLONE })
    return project
  } catch (error) {
    rmSync(project.root, { recursive: true, force: true })
    throw error
  }
}

export function packageWordsFixture(put, id) {
  put(`packages/${id}/i18n/zh.json`, { 'package.desc': '测试包。', 'package.title': id })
  put(`packages/${id}/i18n/en.json`, { 'package.desc': 'A package for tests.', 'package.title': id })
  return { title: '@package.title', desc: '@package.desc' }
}

export function storyRoot({ runtimeProbe = false } = {}) {
  const { root, put } = testProject()
  const id = 'story'
  put('packages/story/package.json', { kind: 'feature', type: 'module', version: '0.0.0', kernel: '^0.0.0', uses: {}, ...packageWordsFixture(put, id) })
  put('packages/story/capabilities/play.json', { extends: 'play', items: { answer: {} } })
  put('packages/story/core/index.js', `
    ${runtimeProbe ? 'let calls = 0' : ''}
    const identity = value => value
    export function register(kernel) {
      ${runtimeProbe ? "kernel.check('story/count', Object.assign(() => [{ text: 'check count ' + ++calls }], { phase: 'runtime' }))" : ''}
      kernel.play('story/answer', {
        initial: () => '', read: identity, write: identity, normalize: identity,
        run: identity, judge: answer => ({ pass: answer === 'yes' }),
      })
    }
  `)
  put('packages/story/view/index.jsx', `
    function Answer() { return null }
    export function register(kernel) { kernel.play('story/answer', { component: Answer, preview: Answer }) }
  `)
  put('games/story/i18n/en.json', { opening: 'Opening', 'opening.desc': 'An introduction' })
  put('packages/story/levels/given.json', { title: 'Question', tasks: [{ id: 'given', play: 'story/answer', brief: 'Answer yes.' }] })
  put('games/story/game.json', { kernel: '^0.0.0', packages: { story: '^0.0.0' }, title: 'Story', chapters: ['@story/ground'] })
  put('games/story/chapters/ground.json', { levels: ['story/given'], chapter: { title: '@opening', desc: '@opening.desc' } })
  lockFixture(root)
  return { root, id }
}

export function installGlossaryFixture(root) {
  const dir = resolve(root, 'packages/wiki')
  if (existsSync(dir)) return
  mkdirSync(dir, { recursive: true })
  for (const path of ['package.json', 'core', 'view', 'i18n', 'kinds']) {
    cpSync(new URL(`../../../packages/wiki/${path}`, import.meta.url), resolve(dir, path), { recursive: true })
  }
}

export function addGlossaryFixture(root, pkg, game) {
  installGlossaryFixture(root)
  for (const [file, field] of [[`packages/${pkg}/package.json`, 'uses'], ...(game ? [[`games/${game}/game.json`, 'packages']] : [])]) {
    const path = resolve(root, file)
    const config = JSON.parse(readFileSync(path))
    config[field] = { ...config[field], wiki: '^0.0.0' }
    writeFileSync(path, JSON.stringify(config, null, 2) + '\n')
  }
}
