import { declaresIn, kindPolicy } from '../kind-policy.js'
import { meaningsOf } from '../kind-meanings.js'
import { satisfies } from '../semver.js'
import { lockTarget } from '../releases.js'
import { tagKey, tagName } from '../tag-identity.js'
import { objectFoldersFor, kindSchemas } from '../plugin-kinds.js'
// A workspace opens one writable layer for changesets and their logs. Dependencies are read-only inputs.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { assemble, contentRoots, deepFreeze } from '../content.js'
import { contentRoot, resolveLayers, publicLayerFiles, packageDirectory, readPackageLayers, assembleLayers, layerVocabulary, catalogFiles, gameDirectory, objectFiles, gameDeclarationProblems, levelFiles, splitGameConfig } from '../resolver.js'
import { catalogReader, declarationReader, resolveReferences, sourceValue } from '../catalogs.js'
import { textKey } from '../i18n.js'
import { catalogsOf, normalizeText } from '../content-text.js'
import { folders, orderPackages, schemaForKind } from '../layers.js'
import { OBJECT_SCHEMAS } from '../objects.js'
import { BLUEPRINT } from '../../pipeline/blueprint.js'
import { kitDirectory } from '../release-data.js'
import { vocabularyFor } from '../kernel.js'
import { writeJson } from './json.js'
import { unified } from './diff.js'

const read = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null)
const parse = (text, file) => {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`${file}: ${error.message}`)
  }
}

const COURSE_I18N = 'i18n'
const PACKAGE_I18N = 'package/i18n'
const OVERRIDES = 'overrides'
const overridePaths = (dir, prefix = '') => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? overridePaths(resolve(dir, entry.name), `${prefix}${entry.name}/`) : entry.name.endsWith('.json') ? [`${prefix}${entry.name}`] : []) : []
const overrideScope = file => file.startsWith('package/') ? 'package' : 'course'
const overridePath = file => file.replace(/^package\//, '').slice(0, -5).split('/')
const overridePrefix = file => ['override', ...overridePath(file).slice(1)].join('.')
const readOverride = (file, value, read) => resolveReferences(value, key => {
  const ref = `@${key}`
  return key.startsWith(`${overridePrefix(file)}.`) ? read(ref) : ref
})
const objectOverrideFiles = ws => [...ws.overrideFiles].filter(([file]) => overridePath(file)[2] !== 'i18n')
const overrideValues = (ws, scope) => objectOverrideFiles(ws).filter(([file]) => overrideScope(file) === scope)
function overrideCopy(ws, scope) {
  const collect = (value, prefix) => {
    if (!value || typeof value !== 'object') return []
    const key = textKey(value)
    return key ? (key.startsWith(prefix) ? [value] : []) : Object.values(value).flatMap(child => collect(child, prefix))
  }
  return overrideValues(ws, scope).flatMap(([file, value]) => collect(value, `${overridePrefix(file)}.`))
}
const CONFIG = ['game.json', 'package.json']
const inGame = (file) => file === 'game.json' || file === 'blueprint.json'

/** Open exactly one game layer. Package selectors open an independent package workspace. */
export function openGame(id, root = contentRoot(), options = {}) {
  if (options.scope === 'package' || options.layer && !options.layer.startsWith('@')) {
    const { packageIds } = resolveLayers({ game: id, root })
    return openPackage(options.layer ?? packageIds[0], root, options)
  }
  return openWorkspace(id, root, options, false)
}

/** Open one package and read its dependencies without making them writable. */
export function openPackage(id, root = contentRoot(), options = {}) {
  return id === 'kernel' ? openKernelCopy(root) : openWorkspace(id, root, options, true)
}

function openKernelCopy(root) {
  const dir = kitDirectory, locale = resolve(dir, 'i18n')
  if (relative(root, locale).startsWith('..')) throw new Error('the installed kernel catalog is outside this workspace')
  const pathFor = lang => relative(root, resolve(locale, `${lang}.json`))
  const onDisk = () => new Map(catalogFiles(locale).map(([lang, file]) => [pathFor(lang), read(file)]))
  let original = onDisk()
  const catalogs = Object.fromEntries(catalogFiles(locale).map(([lang, file]) => [lang, parse(read(file), file)]))
  const schemas = vocabularyFor()
  const ws = {
    dir, root, packageDir: dir, id: 'kernel', packageId: 'kernel', scope: 'package', layer: 'kernel', packaged: true, copyOnly: true,
    schemas, levels: new Map(), contentObjects: {},
    uiCatalogs: uiCatalogsOf(catalogs),
    owns: file => file.startsWith(relative(root, locale) + '/'),
    onDisk,
    content: () => {
      const content = assemble({ id: 'kernel', schemas, game: {}, levels: [], packageTarget: { id: 'kernel' }, provenance: { layerOrder: [] } })
      return Object.assign(content, { uiCatalogs: ws.uiCatalogs })
    },
    snapshot: () => ({ uiCatalogs: ws.uiCatalogs, packageLayers: undefined }),
    restore: snapshot => { ws.uiCatalogs = snapshot.uiCatalogs },
    normalize() {},
    changes() {
      return [...new Set([...Object.keys(catalogs), ...Object.keys(ws.uiCatalogs)])].flatMap(lang => {
        const file = pathFor(lang), before = original.get(file) ?? null
        const { ui: _ui, ...entries } = catalogs[lang] ?? {}
        if (Object.keys(ws.uiCatalogs[lang] ?? {}).length) entries.ui = sortedKeys(ws.uiCatalogs[lang])
        const after = Object.keys(entries).length ? writeJson(entries, before) : null
        return before === after ? [] : [{ file, before, after }]
      })
    },
    diff: (changes = ws.changes()) => changes.map(change => unified(change.file, change.before, change.after)).join('\n'),
    write() {
      const current = onDisk()
      if (current.size !== original.size || [...original].some(([file, text]) => current.get(file) !== text)) throw new Error('kernel catalog changed on disk; open it again')
      const done = ws.changes()
      writeFiles(root, done)
      original = onDisk()
      return done.map(change => change.file)
    },
  }
  return ws
}

const uiCatalogsOf = catalogs => Object.fromEntries(Object.entries(catalogs).filter(([, entries]) => entries.ui).map(([lang, entries]) => [lang, entries.ui]))

function openWorkspace(id, root, { vocabulary = null, layer = null } = {}, packaged) {
  const dir = packaged ? packageDirectory(id, root) : gameDirectory(id, root)
  const resolved = resolveLayers({ ...(packaged ? { package: id, closure: true } : { game: id }), root })
  const packageLayers = resolved.layers.filter(layer => !layer.id.startsWith('@'))
  const original = new Map(packaged ? [] : [['game.json', read(resolve(dir, 'game.json'))]])
  const { kernel, ...game } = resolved.game ?? {}
  const packageIds = packaged ? packageLayers.map(layer => layer.id) : resolved.packageIds
  const packageId = packaged ? id : resolved.packageIds[0]
  if (layer && layer !== (packaged ? id : `@${id}`)) throw new Error(`unknown layer ${layer}`)
  const scope = packaged ? 'package' : 'game'
  layer = packaged ? id : `@${id}`
  const packageDir = packageDirectory(packageId, root)
  const packageDirs = packageIds.map(id => packageDirectory(id, root))
  const dependencyFiles = new Map(packageLayers.filter(layer => !packaged || layer.id !== packageId).map(layer => [layer.id, JSON.stringify(layer)]))
  const schemas = layerVocabulary(packageLayers, vocabulary)
  const kindFolders = { ...folders, kind: 'kinds', ...Object.fromEntries(Object.entries(schemas.objectKinds ?? {}).filter(([, d]) => !d.extends).map(([k, d]) => [d.objectKind ?? k, d.folder])) }
  const archived = packageLayers.find(layer => layer.id === packageId).source === 'archive'
  const packageFiles = publicLayerFiles(packageLayers.find(layer => layer.id === packageId), schemas)
  let layerSchemas = schemas
  const visibleFolders = schemas => ({
    ...folders, kind: 'kinds', ...objectFoldersFor(packageId, schemas.objectKinds ?? {}),
    ...(!packaged && objectFoldersFor(layer, schemas.objectKinds ?? {})),
  })
  const gameFolder = folder => Object.entries(visibleFolders(layerSchemas)).some(([kind, path]) => path === folder && objectScope(kind, layerSchemas, scope) === 'game')
  const packageObjects = (dir, folder) => gameFolder(folder) ? (packaged ? [] : objectFiles(dir === packageDir ? gameDirectory(id, root) : dir, folder)) : (!packaged || archived) && dir === packageDir ? [...packageFiles.keys()].filter(file => file.startsWith(`${folder}/`) && file.endsWith('.json')).map(file => [file.slice(folder.length + 1, -5)]) : objectFiles(dir, folder)
  const pathFor = (file) => {
    if (file.startsWith('game/capabilities/')) return relative(root, resolve(dir, file.slice('game/'.length)))
    if (file.startsWith('capabilities/')) return relative(root, resolve(packageDir, file))
    if (file.startsWith('package/overrides/')) return relative(root, resolve(packageDir, file.slice('package/'.length)))
    if (file.startsWith(`${PACKAGE_I18N}/`)) return relative(root, resolve(packageDir, file.slice('package/'.length)))
    if (file === 'package.json') return relative(root, resolve(packageDir, file))
    const inPackage = Object.values(kindFolders).includes(file.split('/')[0]) && !gameFolder(file.split('/')[0])
    return relative(root, resolve(inPackage ? packageDir : dir, file))
  }
  const onDisk = (file) => {
    const local = file.replace(/^package\//, '')
    if (!gameFolder(local.split('/')[0]) && Object.values(kindFolders).includes(local.split('/')[0]) || file.startsWith('package/') || file === 'package.json' || local.startsWith('capabilities/')) return packaged && !archived ? read(resolve(packageDir, local)) : packageFiles.get(local) ?? null
    return packaged && inGame(file) ? null : read(resolve(root, pathFor(file)))
  }
  const load = (file, optional = false) => {
    const text = onDisk(file)
    if (text === null && optional) return undefined
    original.set(file, text)
    return parse(text, pathFor(file))
  }
  const levels = () => packageObjects(packageDir, 'levels').map(([levelId]) => levelId).sort()
  const objectPaths = () => ['tags', 'relations', ...Object.keys(kindSchemas(schemas)).filter(kind => Object.hasOwn(visibleFolders(schemas), kind))].flatMap((kind) => [
    ...packageObjects(packageDir, kindFolders[kind] ?? kind).map(([name]) => `${kindFolders[kind] ?? kind}/${name}.json`),
  ])
  const localeFiles = () => [
    ...(packaged ? [] : catalogFiles(resolve(dir, COURSE_I18N))).map(([lang]) => `${COURSE_I18N}/${lang}.json`),
    ...(packaged && !archived ? catalogFiles(resolve(packageDir, 'i18n')).map(([lang]) => `package/i18n/${lang}.json`) : [...packageFiles.keys()].filter(file => file.startsWith('i18n/')).map(file => `package/${file}`)),
  ]
  const extraOverridePaths = () => [...(packaged && !archived ? overridePaths(resolve(packageDir, OVERRIDES)).map(file => `package/overrides/${file}`) : [...packageFiles.keys()].filter(file => file.startsWith('overrides/')).map(file => `package/${file}`)), ...(packaged ? [] : overridePaths(resolve(dir, OVERRIDES)).map((file) => `overrides/${file}`))]
  const catalog = (prefix) => Object.fromEntries(localeFiles().filter((file) => file.startsWith(`${prefix}/`))
    .map((file) => [file.slice(prefix.length + 1, -'.json'.length), load(file)]))
  const courseCatalog = catalog(COURSE_I18N)
  const packageCatalog = catalog(PACKAGE_I18N)
  const allCatalogs = (own) => {
    const catalogs = {}
    for (const layer of packageLayers) for (const [lang, entries] of Object.entries(layer.catalogs)) Object.assign(catalogs[lang] ??= {}, Object.fromEntries(Object.entries(entries).filter(([key]) => key !== 'ui').map(([key, value]) => [key.includes('/') ? key : `${layer.id}/${key}`, value])))
    for (const [lang, entries] of Object.entries(own)) Object.assign(catalogs[lang] ??= {}, entries)
    return catalogs
  }
  const readers = {
    course: catalogReader(allCatalogs(courseCatalog), resolve(dir, COURSE_I18N)),
    package: catalogReader(allCatalogs(packageCatalog), resolve(packageDir, 'i18n')),
  }
  const keyed = (catalogs) => new Set(Object.values(catalogs).flatMap(Object.keys))
  load('package.json')
  const ws = {
    id,
    root,
    dir,
    scope, layer,
    packaged, archived,
    kernelRange: kernel,
    packageConfig: packageLayers.find(layer => layer.id === packageId).config,
    owns: (file) => packaged ? file.startsWith(`packages/${id}/`) : file.startsWith(`games/${id}/`),
    packageId, packageIds, packageRanges: resolved.packageRanges ?? {}, packageLayers,
    schemas, kindFolders,
    packageDir, packageDirs, dependencyFiles, courseCatalog,
    pathFor,
    objectPaths,
    game: readers.course(game, pathFor('game.json'), schemas.game, schemas),
    blueprint: readers.course(packaged ? undefined : load('blueprint.json', true), pathFor('blueprint.json'), BLUEPRINT, schemas),
    levels: new Map(levels().map((levelId) => {
      const file = `levels/${levelId}.json`
      return [levelId, readers.package(load(file), pathFor(file), schemas.level, schemas)]
    })),
    ...Object.fromEntries(Object.keys(OBJECT_SCHEMAS).map((kind) => [kind, new Map(objectPaths().filter((p) => p.startsWith(`${kind}/`)).map((file) => [kind === 'tags' ? tagKey(file.split('/').slice(1, -1).join('/'), file.split('/').at(-1).slice(0, -5)) : file.split('/').at(-1).slice(0, -5), { ...readers.package(load(file), pathFor(file), OBJECT_SCHEMAS[kind], schemas), ...(kind === 'tags' && { kind: file.split('/').slice(1, -1).join('/') }) }]))])),
    contentObjects: Object.fromEntries(Object.entries(kindSchemas(schemas)).map(([kind, schema]) => [kind, new Map((Object.hasOwn(visibleFolders(schemas), kind) ? packageObjects(packageDir, kindFolders[kind] ?? kind) : []).map(([name]) => [name, (['kind', 'shape'].includes(kind) ? declarationReader(packageCatalog)(load(`${kindFolders[kind] ?? kind}/${name}.json`)) : readers[objectScope(kind, schemas, scope) === 'game' ? 'course' : 'package'](load(`${kindFolders[kind] ?? kind}/${name}.json`), pathFor(`${kindFolders[kind] ?? kind}/${name}.json`), schema, schemas))]))])),
    capabilities: new Map(packageObjects(packageDir, 'capabilities').map(([name]) => [name, declarationReader(packageCatalog)(load(`capabilities/${name}.json`))])),
    declarationProblems: [...resolved.lockStatus.problems, ...(packaged ? [] : gameDeclarationProblems(dir, schemas))],
    overrideFiles: new Map(extraOverridePaths().map((file) => {
      const value = load(file)
      if (overridePath(file)[2] === 'i18n') return [file, value]
      return [file, readOverride(file, value, ref => readers[overrideScope(file)](ref, pathFor(file)))]
    })),
    reservations: { course: keyed(courseCatalog), package: keyed(packageCatalog) },
    original,
  }
  for (const meaning of meaningsOf(schemas)) meaning.workspace?.(ws)
  // Several games may share a package: keep the translations of texts this game does not read.
  ws.packageCatalog = packageCatalog
  ws.uiCatalogs = uiCatalogsOf(packageCatalog)
  ws.activePackageKeys = keyed(catalogsOf(PACKAGE_I18N, ...packageValues(ws)))
  return Object.assign(ws, {
    /** The game as one content (../content.js), frozen: the operations put new values in, nothing writes into one. */
    content: () => { const content = contentOf(ws); if (ws.packaged) content.uiCatalogs = ws.uiCatalogs; deepFreeze(content); contentRoots.set(content, ws.root); return content },
    /** What the files hold now, by name; a removed level file is null. */
    snapshot: () => ({ schemas: ws.schemas, kindFolders: { ...ws.kindFolders }, packageIds: ws.packageIds, packageRanges: { ...ws.packageRanges }, packageLayers: ws.packageLayers, packageDirs: ws.packageDirs, dependencyFiles: ws.dependencyFiles, game: ws.game, blueprint: ws.blueprint, uiCatalogs: ws.uiCatalogs, capabilities: new Map(ws.capabilities), contentObjects: Object.fromEntries(Object.entries(ws.contentObjects).map(([kind, values]) => [kind, new Map(values)])), levels: new Map(ws.levels), ...objectSnapshot(ws), overrideFiles: new Map(ws.overrideFiles), reservations: ws.reservations }),
    restore: (s) => {
      layerSchemas = s.schemas
      for (const key of Object.keys(ws.kindFolders)) delete ws.kindFolders[key]
      Object.assign(ws.kindFolders, s.kindFolders)
      return Object.assign(ws, { schemas: s.schemas, packageIds: s.packageIds, packageRanges: s.packageRanges, packageLayers: s.packageLayers, packageDirs: s.packageDirs, dependencyFiles: s.dependencyFiles, game: s.game, blueprint: s.blueprint, uiCatalogs: s.uiCatalogs, capabilities: new Map(s.capabilities), contentObjects: Object.fromEntries(Object.entries(s.contentObjects).map(([kind, values]) => [kind, new Map(values)])), levels: new Map(s.levels), ...objectSnapshot(s), overrideFiles: new Map(s.overrideFiles), reservations: s.reservations })
    },
    normalize: (vocabulary, previous) => { layerSchemas = ws.schemas; return normalize(ws, vocabulary, previous) },
    /** Select exactly the game's explicit package list; dependencies remain explicit selections. */
    selectPackages: (ranges) => {
      const ids = Object.keys(ranges)
      if (packaged) throw new Error('only a game can select packages')
      splitGameConfig({ kernel: ws.kernelRange, packages: ranges }, root)
      const resolution = resolveLayers({ packages: ids, root })
      if (!resolution.lockStatus.valid) throw new Error(JSON.stringify(resolution.lockStatus.problems))
      const layers = resolution.layers
      for (const layer of layers) if (!layer.missing && !satisfies(layer.config.version, ranges[layer.id])) throw new Error(`${layer.id}: version ${layer.config.version} outside ${ranges[layer.id]}`)
      const dirs = ids.map(id => packageDirectory(id, root))
      const dependencies = new Map(ws.dependencyFiles)
      for (const layer of layers) dependencies.set(layer.id, JSON.stringify(layer))
      const selectedSchemas = layerVocabulary(layers, vocabulary)
      layerSchemas = selectedSchemas
      for (const [kind, schema] of Object.entries(kindSchemas(selectedSchemas))) {
        const folder = selectedSchemas.kindPolicies?.[kind]?.folder ?? folders[kind] ?? kind
        kindFolders[kind] = folder
        if (!ws.contentObjects[kind]) ws.contentObjects[kind] = new Map(Object.hasOwn(visibleFolders(selectedSchemas), kind) && gameFolder(folder) ? objectFiles(dir, folder).map(([name]) => [name, readers.course(load(`${folder}/${name}.json`), `${folder}/${name}.json`, schema, selectedSchemas)]) : [])
      }
      Object.assign(ws, { packageIds: [...ids], packageRanges: { ...ranges }, packageLayers: layers, packageDirs: dirs, dependencyFiles: dependencies, schemas: selectedSchemas })
    },
    /** Every file whose text changes: [{ file, before, after }] (before null: a new file; after null: removed). */
    changes: () => changes(ws),
    /** The changes as a unified diff. */
    diff: (changes = ws.changes()) => changes.map((c) => unified(c.file, c.before, c.after)).join('\n'),
    write: () => write(ws, localeFiles),
    /** The course and package files, keyed by their project-relative paths. */
    onDisk: () => new Map([...new Set([...fileNames(levels(), objectPaths(), ws.packaged), ...localeFiles(), ...extraOverridePaths(), ...(!packaged ? objectFiles(dir, 'capabilities').map(([name]) => `game/capabilities/${name}.json`) : []), ...[...packageFiles.keys()].filter(file => file.startsWith('capabilities/')), ...ws.original.keys()])]
      .map((file) => [pathFor(file), onDisk(file)]).filter(([file]) => ws.owns(file))),
  })
}

const objectSnapshot = (ws) => ({ ...Object.fromEntries(Object.keys(OBJECT_SCHEMAS).map((kind) => [kind, new Map(ws[kind])])) })
const objectFile = (kind, name, value) => `${kind}/${kind === 'tags' ? `${value.kind}/` : ''}${kind === 'tags' ? tagName(name) : name}.json`
const objectEntries = (ws) => [
  ...[...ws.capabilities].map(([name, value]) => [`capabilities/${name}.json`, value]),
  ...Object.keys(OBJECT_SCHEMAS).flatMap((kind) => [...ws[kind]].map(([name, value]) => [objectFile(kind, name, value), value])),
  ...Object.entries(ws.contentObjects).flatMap(([kind, values]) => [...values].map(([name, value]) => [`${ws.kindFolders[kind] ?? kind}/${name}.json`, value])),
]
const objectPathsOf = (ws) => objectEntries(ws).map(([file]) => file)
const objectScope = (kind, schemas, scope) => {
  const policy = kindPolicy(kind, schemas)
  return declaresIn(policy, 'game') && (scope === 'game' || !declaresIn(policy, 'package')) ? 'game' : 'package'
}
const layerObjects = (ws, layer) => Object.entries(ws.contentObjects).filter(([kind]) => objectScope(kind, ws.schemas, ws.scope) === layer).flatMap(([kind, values]) => [...values].map(([name, value]) => ({ kind, name, value })))


/** The package's texts with what the game puts over them, unless the package is what is being edited. */
function contentOf(ws) {
  const packaged = ownCatalogs(ws, catalogsOf(PACKAGE_I18N, ...packageValues(ws)))
  const own = {
    id: ws.packageId, capabilityDeclarations: Object.fromEntries([...ws.capabilities].map(([name, value]) => [name, declarationReader({}, ws.packageId)(value)])), codeObjects: ws.packageLayers.find(layer => layer.id === ws.packageId)?.codeObjects ?? [], tagReaders: ws.packageLayers.find(layer => layer.id === ws.packageId)?.tagReaders ?? [], config: ws.packageConfig, catalogs: Object.fromEntries([...new Set([...Object.keys(ws.packageCatalog), ...Object.keys(packaged)])].map(lang => [lang, { ...ws.packageCatalog[lang], ...packaged[lang] }])),
    objects: [
      ...layerObjects(ws, 'package'),
      ...[...ws.levels].map(([name, value]) => ({ kind: 'level', name, value })),
      ...Object.entries({ tag: 'tags', relation: 'relations' }).flatMap(([kind, plural]) => [...(ws[plural] ?? [])].map(([name, value]) => ({ kind, name: kind === 'tag' ? tagName(name) : name, value }))),
    ], overrides: [], textOverrides: [],
  }
  const game = { id: `@${ws.id}`, config: { kernel: ws.kernelRange, ...ws.game, packages: ws.packageRanges }, objects: layerObjects(ws, 'game'), catalogs: courseCatalogs(ws), overrides: [], textOverrides: [] }
  for (const [file, value] of activeOverrides(ws)) {
    const target = file.startsWith('package/') ? own : game
    const path = file.replace(/^package\//, '').split('/')
    const [, namespace, folder] = path
    const filename = path.at(-1)
    if (folder === 'i18n') target.textOverrides.push({ namespace, lang: filename.slice(0, -5), entries: value })
    else target.overrides.push({ kind: Object.keys(ws.kindFolders).find(k => ws.kindFolders[k] === folder), name: `${namespace}/${filename.slice(0, -5)}`, value: { ...value, ...(folder === 'tags' && { kind: path.slice(3, -1).join('/') }) } })
  }
  const layers = orderPackages(ws.packaged ? ws.packageLayers.map((layer) => layer.id === ws.packageId ? own : layer) : ws.packageLayers)
  return assembleLayers(ws.id, ws.packaged ? layers : [...layers, game], ws.schemas, { blueprint: ws.blueprint, declarationProblems: ws.declarationProblems, ...(ws.packaged && { packageId: ws.packageId }) })
}

/** Retire game wording keys whose declaration was deleted in the edited package. */
function activeOverrides(ws) {
  const prefix = `overrides/${ws.packageId}/i18n/`
  const keys = new Set(Object.values(catalogsOf(PACKAGE_I18N, ...packageValues(ws))).flatMap(Object.keys))
  return [...ws.overrideFiles].flatMap(([file, value]) => {
    if (!file.startsWith(prefix)) return [[file, value]]
    const entries = Object.fromEntries(Object.entries(value).filter(([key]) => keys.has(key) || !ws.activePackageKeys.has(key)))
    return Object.keys(entries).length ? [[file, entries]] : []
  })
}

const fileNames = (levels, objects, packaged = false) => [...CONFIG, 'blueprint.json', ...[...levels].map((id) => `levels/${id}.json`), ...objects].filter((file) => !packaged || !inGame(file))

const ownCatalogs = (ws, catalogs) => Object.fromEntries(Object.entries(catalogs).map(([lang, entries]) => [lang, Object.fromEntries(Object.entries(entries).filter(([key]) => !key.includes('/') || key.startsWith(`${ws.packageId}/`)))]))

function courseCatalogs(ws) {
  const authored = catalogsOf(COURSE_I18N, ws.game, ws.blueprint, ...layerObjects(ws, 'game').map(({ value }) => value), ...overrideCopy(ws, 'course'))
  // Structural overrides can contribute paragraphs with keys declared by the game.
  const keys = new Set()
  const visit = value => {
    if (typeof value === 'string' && value.startsWith('@')) keys.add(value.slice(1).replace(`${ws.layer}/`, ''))
    else if (value && typeof value === 'object') Object.values(value).forEach(visit)
  }
  for (const [, value] of overrideValues(ws, 'course')) visit(sourceValue(value))
  for (const [lang, entries] of Object.entries(ws.courseCatalog)) {
    const overrides = Object.fromEntries(Object.entries(entries).filter(([key]) => keys.has(key)))
    if (Object.keys(overrides).length) authored[lang] = { ...overrides, ...authored[lang] }
  }
  return authored
}

function packageValues(ws) {
  return [...ws.levels.values(), ...ws.capabilities.values(), ...Object.keys(OBJECT_SCHEMAS).flatMap(kind => [...ws[kind].values()]), ...layerObjects(ws, 'package').map(({ value }) => value), ...overrideCopy(ws, 'package')]
}

function normalize(ws, vocabulary, previous) {
  const reservations = { ...ws.reservations }
  const keyOf = (scope) => reservations[scope] === ws.reservations[scope] ? (reservations[scope] = new Set(reservations[scope])) : reservations[scope]
  function assign(value, was, schema, prefix, scope, annotations = false) {
    return value === was ? value : normalizeText(value, schema, prefix, { previous: was, vocabulary, reserved: keyOf(scope), annotations })
  }
  ws.game = assign(ws.game, previous.game, vocabulary.game, 'game', 'course')
  ws.blueprint = assign(ws.blueprint, previous.blueprint, BLUEPRINT, 'blueprint', 'course')
  for (const [level, value] of ws.levels) ws.levels.set(level, assign(value, previous.levels.get(level), vocabulary.level, `level.${level}`, 'package'))
  for (const [kind, schema] of Object.entries(OBJECT_SCHEMAS)) for (const [name, value] of ws[kind]) ws[kind].set(name, assign(value, previous[kind].get(name), schema, `${kind === 'tags' ? 'tag' : kind}.${kind === 'tags' ? tagName(name) : name.split('/').at(-1)}`, 'package'))
  for (const [kind, schema] of Object.entries(kindSchemas(vocabulary))) for (const [name, value] of ws.contentObjects[kind] ?? []) ws.contentObjects[kind].set(name, assign(value, previous.contentObjects[kind]?.get(name), schema, `${meaningsOf(vocabulary).find(meaning => meaning.type === kind)?.textPrefix ?? (objectScope(kind, vocabulary, ws.scope) === 'game' ? kind.split('/').at(-1) : kind)}.${name}`, objectScope(kind, vocabulary, ws.scope) === 'game' ? 'course' : 'package', ['kind', 'shape'].includes(kind)))
  for (const [name, value] of ws.capabilities) ws.capabilities.set(name, assign(value, previous.capabilities.get(name), null, `capability.${name}`, 'package', true))
  for (const [file, value] of objectOverrideFiles(ws)) {
    const was = previous.overrideFiles.get(file)
    if (value === was) continue
    const [, namespace, folder, ...rest] = overridePath(file)
    const kind = Object.keys(ws.kindFolders).find(kind => ws.kindFolders[kind] === folder)
    const declaration = ws.packageLayers.find(layer => layer.id === namespace)?.objects.find(object =>
      object.kind === kind && object.name === rest.at(-1) && (kind !== 'tag' || object.value.kind === rest.slice(0, -1).join('/')))
    const schema = schemaForKind(kind, vocabulary, { ...declaration?.value, ...value })
    const scope = overrideScope(file)
    const catalogs = scope === 'course' ? ws.courseCatalog : ws.packageCatalog
    const current = catalogsOf(file, value)
    const previousCopy = catalogsOf(file, was)
    const locales = Object.fromEntries([...new Set([...Object.keys(catalogs), ...Object.keys(previousCopy), ...Object.keys(current)])]
      .map(lang => [lang, { ...catalogs[lang], ...previousCopy[lang], ...current[lang] }]))
    const read = catalogReader(locales, file)
    const draft = readOverride(file, sourceValue(value), read)
    ws.overrideFiles.set(file, assign(draft, was, schema, overridePrefix(file), scope, kind === 'kind'))
  }
  ws.reservations = reservations
}

const localizationFiles = (prefix, catalogs) => Object.entries(catalogs).map(([lang, entries]) => [`${prefix}/${lang}.json`, entries])
const sortedKeys = (entries) => Object.fromEntries(Object.entries(entries).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))

function changes(ws) {
  const out = []
  const configuration = new Map([
    ['package.json', ws.packageConfig],
    ['game.json', { kernel: ws.kernelRange, packages: ws.packageRanges, ...ws.game }],
    ...(ws.blueprint === undefined ? [] : [['blueprint.json', ws.blueprint]]), ...[...ws.levels].map(([id, level]) => [`levels/${id}.json`, level]),
    ...objectEntries(ws), ...activeOverrides(ws),
  ])
  const active = ownCatalogs(ws, catalogsOf(PACKAGE_I18N, ...packageValues(ws)))
  const packageCatalog = Object.fromEntries([...new Set([...Object.keys(ws.packageCatalog), ...Object.keys(active), ...Object.keys(ws.uiCatalogs)])].sort()
    .flatMap((lang) => {
      const entries = { ...Object.fromEntries(Object.entries(ws.packageCatalog[lang] ?? {}).filter(([key]) => key !== 'ui' && !ws.activePackageKeys.has(key))), ...active[lang], ...(Object.keys(ws.uiCatalogs[lang] ?? {}).length ? { ui: sortedKeys(ws.uiCatalogs[lang]) } : {}) }
      return Object.keys(entries).length ? [[lang, sortedKeys(entries)]] : []
    }))
  const now = new Map([
    ...[...configuration].map(([file, value]) => [file, sourceValue(file.startsWith('tags/') ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'kind')) : value)]),
    ...localizationFiles(COURSE_I18N, courseCatalogs(ws)),
    ...localizationFiles(PACKAGE_I18N, packageCatalog),
  ].filter(([file]) => !ws.packaged || !inGame(file)))
  for (const [file, value] of now) {
    const before = ws.original.get(file) ?? null
    const after = writeJson(value, before)
    if (after !== before) out.push({ file: ws.pathFor(file), before, after })
  }
  for (const [file, before] of ws.original) if (!now.has(file) && before !== null) out.push({ file: ws.pathFor(file), before, after: null })
  return out.filter(({ file }) => ws.owns(file))
}

function write(ws, localeFiles) {
  const done = ws.changes()
  if (ws.packaged && ws.archived && done.length) throw new Error('published packages are read-only; create a source directory to edit')
  if (ws.packaged && ws.archived) return []
  // Catalog edits depend on every reference in the course and package, including files this edit did not touch.
  const currentNames = fileNames(ws.packaged ? levelFiles(ws.packageDir).map(([id]) => id) : ws.levels.keys(), ws.objectPaths(), ws.packaged)
  const expected = new Map([...new Set([...ws.original.keys(), ...currentNames, ...localeFiles()])]
    .map((file) => [ws.pathFor(file), ws.original.get(file) ?? null]).filter(([file]) => ws.owns(file)))
  for (const { file, before } of done) expected.set(file, before)
  const resolved = new Map(readPackageLayers([...new Set([...ws.packageIds, ...ws.dependencyFiles.keys()])], ws.root).map(layer => [layer.id, JSON.stringify(layer)]))
  for (const [id, before] of ws.dependencyFiles) if (resolved.get(id) !== before) throw new Error(`dependency changed on disk since the game was opened: ${id}; open it again`)
  const moved = [...expected].filter(([file, before]) => read(resolve(ws.root, file)) !== before).map(([file]) => file)
  if (moved.length) throw new Error(`changed on disk since the game was opened: ${moved.join(', ')}; open it again`)
  writeFiles(ws.root, done)
  if (!ws.packaged && done.some(change => change.file.endsWith('/game.json'))) lockTarget({ kind: 'game', id: ws.id }, ws.root)
  // What was written is what the files hold now.
  ws.original = new Map([...fileNames(ws.levels.keys(), objectPathsOf(ws), ws.packaged), ...ws.overrideFiles.keys(), ...localeFiles()]
    .map((file) => [file, ws.owns(ws.pathFor(file)) ? read(resolve(ws.root, ws.pathFor(file))) : ws.original.get(file) ?? null]))
  ws.packageCatalog = Object.fromEntries(localeFiles().filter((file) => file.startsWith(`${PACKAGE_I18N}/`))
    .map((file) => [file.slice(PACKAGE_I18N.length + 1, -'.json'.length), parse(ws.original.get(file), ws.pathFor(file))]))
  ws.activePackageKeys = new Set(Object.values(catalogsOf(PACKAGE_I18N, ...packageValues(ws))).flatMap(Object.keys))
  ws.overrideFiles = new Map(activeOverrides(ws))
  return done.map((c) => c.file)
}

function writeFiles(root, done) {
  for (const { file, after } of done) {
    const path = resolve(root, file)
    if (after === null) rmSync(path)
    else {
      mkdirSync(dirname(path), { recursive: true })
      // Written next to the file and moved over it, so a file is never left half written.
      writeFileSync(`${path}.tmp`, after)
      renameSync(`${path}.tmp`, path)
    }
  }
}
