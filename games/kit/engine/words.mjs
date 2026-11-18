// Audit the production locales and the UI keys read by each package.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { packageIds, packageDirectory, gameDirectory, contentTargets, readCatalogs } from './resolver.js'
import { isDeveloperTextKey, isLanguageNeutral as neutral } from './i18n.js'
import { uiBase, uiKey } from '../shell/ui-words.js'
import { LANGS } from '../lang.js'

const KIT = resolve(import.meta.dirname, '..')
const ROOT = resolve(KIT, '../..')
const require = createRequire(resolve(ROOT, 'site/package.json'))
const { parse } = require('@babel/parser')
const traverse = require('@babel/traverse').default

function files(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = resolve(dir, entry.name)
    if (entry.isDirectory()) return ['test', 'tests', 'i18n', 'node_modules'].includes(entry.name) ? [] : files(file)
    return /\.(js|jsx|mjs)$/.test(file) && !/\.test\.js$|\/test-fixture\.js$/.test(file) ? [file] : []
  })
}

function literal(node) {
  if (node?.type === 'StringLiteral') return node.value
  if (node?.type === 'TemplateLiteral' && !node.expressions.length) return node.quasis[0].value.cooked
  return null
}

function wordsIn(file) {
  const words = []
  const ast = parse(readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] })
  traverse(ast, {
    CallExpression(path) {
      const { callee, arguments: args, loc } = path.node
      if (callee.type !== 'Identifier') return
      const binding = path.scope.getBinding(callee.name)
      if (binding?.kind !== 'module' || !['T', 'tr'].includes(binding.path.node.imported?.name)) return
      if (!/(?:^kernel(?:\/view|\/words)?$|^table$|\/(?:i18n|lang|words)\.js$)/.test(binding.path.parent.source.value)) return
      const base = literal(args[0])
      if (base === null) return
      words.push({ key: uiKey(base, literal(args[2])), at: `${relative(ROOT, file)}:${loc.start.line}`, inline: args.length > 1 && literal(args[1]) !== null })
    },
  })
  return words
}

const developerUI = file => /\/(?:studio|pipeline|ops)\/|\/shell\/EditMarks\.jsx$/.test(file)
const targets = [
  { dir: KIT, sources: [...files(KIT), resolve(ROOT, 'games/hub.js'), resolve(ROOT, 'games/hub-bar.jsx')] },
  ...packageIds().map(id => ({ dir: packageDirectory(id), sources: ['core', 'view'].flatMap(side => files(resolve(packageDirectory(id), side))) })),
  ...contentTargets([], undefined, { game: true }).map(({ id }) => ({ dir: gameDirectory(id), sources: [], game: true })),
]
const locales = targets.map(target => ({ ...target, catalogs: readCatalogs(resolve(target.dir, 'i18n')) }))
const languages = [...new Set([...LANGS.map(([lang]) => lang), ...locales.flatMap(({ catalogs }) => Object.keys(catalogs))])]
const counts = { player: 0, developer: 0, invalid: 0 }
const check = process.argv.includes('--check')

for (const { dir, sources, game, catalogs } of locales) {
  const prefix = relative(ROOT, dir)
  const missing = (level, lang, key, at) => {
    counts[level]++
    if (level === 'player' || !check) console.log(`${at ?? prefix}: ${lang}: missing ${JSON.stringify(key)} (${level})`)
  }
  const invalid = (key, message) => {
    counts.invalid++
    console.log(`${prefix}: ${JSON.stringify(key)}: ${message}`)
  }
  const ui = Object.fromEntries(Object.entries(catalogs).map(([lang, entries]) => [lang, entries.ui ?? {}]))
  const contentKeys = new Set(Object.values(catalogs).flatMap(entries => Object.keys(entries).filter(key => key !== 'ui')))
  for (const key of contentKeys) {
    const values = Object.values(catalogs).flatMap(entries => Object.hasOwn(entries, key) ? [entries[key]] : [])
    if (typeof values[0] === 'string' && values.every(value => value === values[0]) && neutral(values[0])) invalid(key, 'language-neutral content belongs in the source')
    for (const lang of languages) if (typeof catalogs[lang]?.[key] !== 'string' || !catalogs[lang][key].trim()) missing(isDeveloperTextKey(key) ? 'developer' : 'player', lang, key)
  }
  for (const [lang, entries] of Object.entries(ui)) {
    if (lang === 'zh' && Object.keys(entries).length) invalid('ui', 'Chinese UI keys are the source strings')
    for (const [key, value] of Object.entries(entries)) if (typeof value !== 'string') invalid(key, `${lang} translation must be a string`)
  }
  for (const key of new Set(Object.values(ui).flatMap(Object.keys))) {
    const base = uiBase(key)
    if (neutral(base) && Object.values(ui).every(entries => !Object.hasOwn(entries, key) || entries[key] === base)) invalid(key, 'language-neutral UI text belongs in the source')
  }
  const seen = new Map()
  for (const file of sources) for (const word of wordsIn(file)) {
    if (word.inline) invalid(word.key, `${word.at}: use a locale entry for inline translations`)
    const current = seen.get(word.key)
    if (!current || developerUI(current.file)) seen.set(word.key, { ...word, file })
  }
  for (const { key, at, file } of seen.values()) {
    for (const lang of languages) if (lang !== 'zh' && !Object.hasOwn(ui[lang] ?? {}, key)) missing(developerUI(file) || key.endsWith(' ⟦studio-editor⟧') ? 'developer' : 'player', lang, key, at)
  }
  if (!game && Object.hasOwn(catalogs, 'zh') && !Object.keys(catalogs.zh).length) invalid('zh', 'Chinese UI text lives in source')
}

console.log(`Missing translations: ${counts.player} player, ${counts.developer} developer. Invalid entries: ${counts.invalid}.`)
if (check && (counts.player || counts.invalid)) process.exitCode = 1
