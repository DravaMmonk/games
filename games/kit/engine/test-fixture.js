// Small self-contained workspaces for platform tests.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
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

export function storyRoot() {
  const { root, put } = testProject()
  const id = 'story'
  put('packages/story/package.json', { kind: 'play', type: 'module', version: '0.0.0', kernel: '^0.0.0', uses: {} })
  put('packages/story/capabilities/play.json', { extends: 'play', items: { answer: {} } })
  put('packages/story/core/index.js', `
    const identity = value => value
    export function register(kernel) {
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
  put('games/story/i18n/en.json', { opening: 'Opening' })
  put('packages/story/levels/given.json', { title: 'Question', tasks: [{ id: 'given', play: 'story/answer', brief: 'Answer yes.' }] })
  put('games/story/game.json', { kernel: '^0.0.0', packages: { story: '^0.0.0' }, title: 'Story', chapters: ['@story/ground'] })
  put('games/story/chapters/ground.json', { levels: ['story/given'], chapter: { title: '@opening' } })
  lockFixture(root)
  return { root, id }
}

export function installGlossaryFixture(root) {
  const dir = resolve(root, 'packages/encyclopedia')
  if (existsSync(dir)) return
  mkdirSync(dir, { recursive: true })
  for (const path of ['package.json', 'core', 'view', 'i18n', 'kinds']) {
    cpSync(new URL(`../../../packages/encyclopedia/${path}`, import.meta.url), resolve(dir, path), { recursive: true })
  }
}

export function addGlossaryFixture(root, pkg, game) {
  installGlossaryFixture(root)
  for (const [file, field] of [[`packages/${pkg}/package.json`, 'uses'], ...(game ? [[`games/${game}/game.json`, 'packages']] : [])]) {
    const path = resolve(root, file)
    const config = JSON.parse(readFileSync(path))
    config[field] = { ...config[field], encyclopedia: '^0.0.0' }
    writeFileSync(path, JSON.stringify(config, null, 2) + '\n')
  }
}
