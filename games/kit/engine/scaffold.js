import { createInterface } from 'node:readline/promises'
import { PACKAGE_KINDS, validatePackageKind } from './package-kinds.js'
import { kernelIdentity } from './release-data.js'
import { packageDirectory } from './resolver.js'
/* global process */
// Copy installed packages and game arrangements.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { contentRoot, gameDirectory, hubOrder, isDataGame, resolveLayers } from './resolver.js'
import { lockTarget } from './releases.js'
import { writeJson } from './ops/json.js'

const fail = (text) => {
  throw new Error(text)
}

/** A folder copied with `__name__` and `__title__` filled in, in file names and in text. */
function fill(from, to, words) {
  const put = (s) => Object.entries(words).reduce((t, [k, v]) => t.replaceAll(k, () => v), s)
  if (statSync(from).isFile()) {
    writeFileSync(to, put(readFileSync(from, 'utf8')))
    return
  }
  mkdirSync(to, { recursive: true })
  for (const name of readdirSync(from)) fill(resolve(from, name), resolve(to, put(name)), words)
}

/** Copy an installed package or create an empty package. */
export function newPackage({ root = contentRoot(), id, kind, from, empty = false }) {
  if (!/^[a-z][a-z0-9-]*$/.test(id ?? '')) fail(`a package id is lowercase letters, digits and dashes: ${id}`)
  const target = packageDirectory(id, root)
  if (!empty && !from) fail('choose --from <package> or --empty')
  if (existsSync(target)) fail(`packages/${id} is there already`)
  validatePackageKind(kind)
  let config = { version: '0.0.0', kernel: `^${kernelIdentity().version}`, uses: {} }
  if (!empty) {
    if (!/^[a-z][a-z0-9-]*$/.test(from) || !existsSync(resolve(packageDirectory(from, root), 'package.json'))) fail(`no package ${from}`)
    mkdirSync(target, { recursive: true })
    for (const name of readdirSync(packageDirectory(from, root)).filter(name => !['changes.jsonl', 'changes.lock', 'lock.json', 'manifest.json', 'node_modules', '.DS_Store'].includes(name))) fill(resolve(packageDirectory(from, root), name), resolve(target, name), { [`${from}/`]: `${id}/` })
    config = JSON.parse(readFileSync(resolve(target, 'package.json'), 'utf8'))
  } else mkdirSync(target, { recursive: true })
  writeFileSync(resolve(target, 'package.json'), writeJson({ ...config, kind, type: 'module' }, null))
  lockTarget({ kind: 'package', id }, root)
  return target
}

const refs = (value, out = new Set()) => {
  if (typeof value === 'string' && value.startsWith('@')) out.add(value.slice(1))
  else if (value && typeof value === 'object') Object.values(value).forEach((child) => refs(child, out))
  return out
}

/**
 * A new game on an existing package (the studio's game workspace, games/design/README.md 6.7): games/<id>/ with its own course,
 * which keeps the course settings of `from` (a game on the same package) and starts with one empty chapter shaped
 * like its first; registered on the hub as hidden and in development. Returns the folder.
 */
export function gameOnPackage({ root = contentRoot(), id, from, title }) {
  if (!/^[a-z][a-z0-9-]*$/.test(id ?? '')) fail(`a game id is lowercase letters, digits and dashes: ${id}`)
  const dir = gameDirectory(id, root)
  if (existsSync(resolve(dir, 'game.json'))) fail(`games/${id} is there already`)
  const order = hubOrder(root)
  if (order.includes(id)) fail(`hub-order.json lists ${id} already`)
  if (!from || !isDataGame(from, root)) fail(`no game ${from} to take the course settings from`)
  const { packageRanges: packages, game, layers } = resolveLayers({ game: from, root })
  const { kernel, chapters, title: _title, author: _author, lede: _lede, kicker: _kicker, topic: _topic, description: _description,
    art: _art, icon: _icon, hidden: _hidden, dev: _dev, encyclopedia: _encyclopedia, hero: _hero, optional: _optional, skippable: _skippable, ...settings } = game
  const sourceChapter = layers.at(-1).objects.find(object => object.kind === 'chapter' && chapters?.[0]?.endsWith(`/${object.name}`))
  const { levels: _, rows: __, ...chapter } = sourceChapter?.value ?? {}
  const words = { zh: typeof title === 'string' ? title : title?.zh ?? id, en: typeof title === 'string' ? title : title?.en ?? id }
  mkdirSync(dir, { recursive: true })
  mkdirSync(resolve(dir, 'i18n'), { recursive: true })
  const keys = refs([settings, chapter])
  for (const [lang, theirs] of Object.entries(layers.at(-1).catalogs)) {
    const own = Object.fromEntries([...keys].filter((key) => Object.hasOwn(theirs, key)).map((key) => [key, theirs[key]]))
    for (const field of ['title', 'lede', 'topic']) own[`game.${field}`] = words[lang] ?? words.en
    own['game.kicker'] = lang === 'zh' ? '开发中' : 'In development'
    own['game.description'] = `${words.zh} ${words.en}`
    writeFileSync(resolve(dir, 'i18n', `${lang}.json`), writeJson(Object.fromEntries(Object.entries(own).sort(([a], [b]) => (a < b ? -1 : 1))), null))
  }
  writeFileSync(resolve(dir, 'game.json'), writeJson({
    kernel, packages, chapters: [`@${id}/main`], title: '@game.title', kicker: '@game.kicker', lede: '@game.lede',
    topic: '@game.topic', description: '@game.description', icon: 'M16 32h32M32 16v32', hidden: true, dev: true, ...settings,
  }, null))
  mkdirSync(resolve(dir, 'chapters'), { recursive: true })
  writeFileSync(resolve(dir, 'chapters/main.json'), writeJson({ ...chapter, levels: [] }, null))
  lockTarget({ kind: 'game', id }, root)
  const orderFile = resolve(gameDirectory('', root), 'hub-order.json')
  if (existsSync(orderFile)) writeFileSync(orderFile, JSON.stringify([...order, id], null, 2) + '\n')
  return dir
}

/** Create content from an installed package or game. */
async function cli([what, name, ...rest]) {
  const opt = (key) => {
    const k = rest.indexOf(`--${key}`)
    return k >= 0 ? rest[k + 1] : undefined
  }
  if (what === 'game') {
    console.log(`made ${gameOnPackage({ root: contentRoot(), id: name, from: opt('from'), title: opt('title') ?? name })}\nnext: npm run check -- ${name}`)
  } else if (what === 'package') {
    let kind = opt('kind')
    if (!kind && process.stdin.isTTY) {
      const reader = createInterface({ input: process.stdin, output: process.stdout })
      try { kind = (await reader.question(`Package kind (${PACKAGE_KINDS.join(', ')}): `)).trim() }
      finally { reader.close() }
    }
    if (!kind) fail(`choose --kind <${PACKAGE_KINDS.join('|')}>`)
    console.log(`made ${newPackage({ root: contentRoot(), id: name, kind, from: opt('from'), empty: rest.includes('--empty') })}\nnext: npm run check -- --package ${name}`)
  } else fail('usage: scaffold.js <game|package> <id> --from <id> (package requires --kind and also accepts --empty)')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await cli(process.argv.slice(2))
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
