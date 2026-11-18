import { uiBase } from '../shell/ui-words.js'
import { contentSchemas } from '../engine/content.js'
import { kindSchemas } from '../engine/plugin-kinds.js'
import { objectTypes, listOfType } from './object-types.js'
// The copy table's rows (CopyTable.jsx): every text of a scope — an era (its own texts, then its levels'), a level group
// (its name, then its levels'), the whole game or package (the configuration's texts, then every level's), the
// encyclopedia or the parts — in play order, each with the file it is in, its path, and whose it is (`own`: the package's or the game's).
// The package workspace the package's texts; the game workspace the game's and the package's, which it puts its own wording over.
import { languagesOf } from '../engine/i18n.js'
import { find } from '../engine/schema.js'
import { projectionFile, studioProjections } from './editors.js'
import { showPath } from '../engine/ops/edit.js'
import { eraLevels } from '../course.js'
import { levelTags } from './groups.js'
import { textKey } from '../engine/i18n.js'

const NOT_GAME = ['id', 'levels', 'glossary', 'vocabulary', 'open', 'blueprint', 'partDefs', 'tags', 'relations', 'sections', 'sourceChapters', 'relationEdges', 'objectProblems', 'registries', 'eras', 'trays', 'replaces', 'overridden']
/**
 * The rows of `scope` (an era's index, 'group:<id>', 'all', 'glossary' or 'parts') as workspace `side` sees them,
 * `order` the levels in play order: [{ key, file: { level } | { group } | { game } | { glossary } | { parts }, name,
 * path, value, own }].
 */
export function copyRows(content, vocabulary, scope, order, side = 'package') {
  if (scope === 'ui') return uiCopyRows(content)
  const rows = []
  const add = (file, name) => ({ path, value }) => {
    const own = file.game ? 'game' : 'package'
    if (side === 'package' && own === 'game') return
    rows.push({ key: `${name}|${showPath(path)}`, file, name, path, value, own })
  }
  const declared = Object.entries(content.objectKinds ?? {}).find(([type, declaration]) => !declaration.extends && listOfType(type) === scope)
  if (declared) {
    const [kind, declaration] = declared
    for (const [name, value] of Object.entries(content.registries?.[kind] ?? {})) {
      find(declaration.schema, value, 'text', { vocabulary }).forEach(add({ object: { kind, name, folder: declaration.folder, declared: declaration } }, name))
    }
    return rows
  }
  const projected = projectionFile(content, contentSchemas.get(content) ?? vocabulary, { [scope]: true })
  if (projected?.projection.textTarget) {
    const { projection, schema, value } = projected
    if (!value) return rows
    for (const text of find(schema, value, 'text', { vocabulary })) {
      const row = projection.textTarget(value, text.path)
      if (!row) continue
      const { name, target } = row
      const source = projection.sourceFile(value, text.path)
      add({ projected: scope, target, source }, name)(text)
    }
    return rows
  }
  const byId = new Map(content.levels.map((l) => [l.id, l]))
  const era = typeof scope === 'number' ? content.eras?.[scope] : null
  const group = typeof scope === 'string' && scope.startsWith('group:') ? scope.slice('group:'.length) : null
  const ids = era ? new Set(eraLevels(era)) : group !== null ? new Set((levelTags(content)[group]?.levels ?? []).map(({ id }) => id)) : null
  if (era) find(kindSchemas(vocabulary).chapter, content.sourceChapters?.[scope] ?? era, 'text', { vocabulary }).forEach((t) => add({ game: true }, String(era.id))({ ...t, path: ['chapters', scope, ...t.path] }))
  if (scope === 'all') {
    const game = Object.fromEntries(Object.entries(content).filter(([k]) => !NOT_GAME.includes(k)))
    find(vocabulary.game, game, 'text', { vocabulary }).forEach(add({ game: true }, side === 'game' ? 'game.json' : 'package.json'))
  }
  for (const id of order) {
    if (ids && !ids.has(id)) continue
    const { id: _, ...level } = byId.get(id) ?? {}
    find(vocabulary.level, level, 'text', { vocabulary }).forEach(add({ level: id }, id))
  }
  return rows
}


function uiCopyRows({ uiCatalogs = {} }) {
  const keys = [...new Set(Object.values(uiCatalogs).flatMap(Object.keys))].sort()
  return keys.map(key => ({
    key: `ui:${key}`, file: { ui: key }, name: key, path: ['ui', key], field: 'ui', own: 'package',
    value: { zh: uiBase(key), ...Object.fromEntries(Object.entries(uiCatalogs).filter(([, entries]) => Object.hasOwn(entries, key)).map(([lang, entries]) => [lang, entries[key]])) },
  }))
}

export const allCopyRows = (content, vocabulary, order, side = 'package') => ['all', 'ui', ...Object.entries(studioProjections(contentSchemas.get(content) ?? vocabulary)).filter(([, projection]) => projection.textTarget).map(([name]) => name), ...objectTypes(content).filter(({ type }) => content.objectKinds?.[type]).map(({ type }) => listOfType(type))]
  .flatMap((scope) => copyRows(content, vocabulary, scope, order, side))

export const copyLanguages = (rows) => [...new Set(['en', 'zh', ...languagesOf(rows.map((row) => row.value))])].sort()

const fileOf = (row) => row.file.object ? { kind: row.file.object.kind, name: row.file.object.name } : row.file.target ?? (row.file.level !== undefined ? { level: row.file.level } : row.file.group !== undefined ? { group: row.file.group } : { in: 'game' })

/** The edit of a row's text in `lang`: in the game workspace, a package text gets the game's own wording (text.override). */
export function copyEdit(row, lang, value, side = 'package') {
  if (row.file.ui !== undefined) return { op: 'ui.set', key: row.file.ui, lang, value }
  if (side === 'game' && row.own === 'package') return { op: 'text.override', ...fileOf(row), path: row.file.target?.path ?? row.path, lang, value }
  return { op: 'text.set', ...fileOf(row), path: row.file.target?.path ?? row.path, ...(typeof row.value === 'string' ? {} : { lang }), value }
}

/** What the package writes where the game has its own wording in `lang` (undefined: the game has none there). */
export function packageWording(content, row, lang) {
  const key = textKey(row.value)
  const was = key && content.overridden?.[key]
  return was && Object.hasOwn(was, lang) ? was[lang] ?? '' : undefined
}

const shortName = (full) => String(full).slice(String(full).indexOf('/') + 1)

/** The file a row's text is written in, as the layer keeps it (the copy workspace lists texts by file). */
export function copyFileOf(row) {
  if (row.file.ui !== undefined) return 'i18n/* · ui'
  if (row.file.object) return `${row.file.object.folder}/${shortName(row.file.object.name)}.json`
  if (row.file.level !== undefined) return `levels/${shortName(row.file.level)}.json`
  if (row.file.projected) return row.file.source
  return 'game.json'
}

/** The files `rows` are in, each with how many texts: [[file, count]], in the order they first come. */
export function copyFiles(rows) {
  const counts = new Map()
  for (const row of rows) {
    const file = copyFileOf(row)
    counts.set(file, (counts.get(file) ?? 0) + 1)
  }
  return [...counts]
}

/** The field a row goes to in the side panel: { at: the file (as Inspector.jsx takes it), path }. */
export function copyFieldOf(row) {
  if (row.file.object) return { at: { object: { ...row.file.object, full: row.file.object.name, namespace: row.file.object.name.split('/')[0], own: true } }, path: row.path }
  if (row.file.level !== undefined) return { at: { level: row.file.level }, path: row.path }
  if (row.file.projected) return { at: { [row.file.projected]: true }, path: row.path }
  return { at: { game: true }, path: row.path }
}
