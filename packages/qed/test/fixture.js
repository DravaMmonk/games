import { CHAPTER } from '../../../games/kit/engine/course-schema.js'
import { lockTarget } from '../../../games/kit/engine/releases.js'
import { folders } from '../../../games/kit/engine/layers.js'
import { progressMeaning } from '../../circuit/core/progression/index.js'
import { progressMeaning as genericProgress } from '../../progress/core/index.js'
import { register as registerLogic } from '../../logic/core/index.js'
import { meaning as logicMeaning } from '../../logic/core/catalog.js'
import { register as registerQED } from '../core/index.js'
import { createPluginKernel } from '../../../games/kit/engine/plugins.js'
import { projectVocabulary } from '../../../games/kit/engine/kind-meanings.js'
import { withKindDeclarations, kindSchemas } from '../../../games/kit/engine/plugin-kinds.js'
import { objectFiles, packageIds, contentTargets, resolveLayers, readContent } from '../../../games/kit/engine/resolver.js'
// Each end-to-end test gets a fresh games folder with a small logic game and three proof levels.
//
//   proofsRoot() → { root, id }   the games folder (in the system's temp folder) and the game's id
//
// The game: `given` (the given is the goal), `apply` (two Applies in a row), `suppose` (an assumption box around them);
// every brief and hint in everyday words, the English side naming “Saturday” and “Assume” for search and replace.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, cpSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { catalogsOf, normalizeText } from '../../../games/kit/engine/content-text.js'
import { catalogReader, sourceValue } from '../../../games/kit/engine/catalogs.js'
import { assemble as assembleContent, contentSchemas } from '../../../games/kit/engine/content.js'
import { GLOSSARY as GLOSSARY_SCHEMA } from '../../wiki/core/schema.js'
import { glossarySchemas } from '../../wiki/test/fixture.js'
import { installGlossaryFixture, packageWordsFixture } from '../../../games/kit/engine/test-fixture.js'
import { OBJECT_SCHEMAS } from '../../../games/kit/engine/objects.js'
import { PARTS_FILE } from '../../circuit/core/parts/schema.js'
import { partMeaning, trayMeaning } from '../../circuit/core/content-meaning.js'
const contentMeanings = [partMeaning, trayMeaning]
import { withParts } from '../../circuit/core/parts/define.js'
import { expandNames } from '../../../games/kit/engine/names.js'
import { readCatalogs, contentVocabulary } from '../../../games/kit/engine/resolver.js'

const kernelRange = `^${JSON.parse(readFileSync(new URL('../../../games/kit/platform.json', import.meta.url))).version}`
const T = (en) => ({ en })

const ID = 'proofs'

const GAME = {
  vocabulary: 1,
  title: T('Proofs · Test'),
  kicker: T('Test'),
  lede: T('Proofs built from Apply and the assumption box.'),
  words: 'everyday',
  contentObjects: { 'qed/wordset': {
    everyday: {
      Rain: T('it rains'),
      Wet: T('the ground is wet'),
      Slip: T('the road is slippery'),
      Sat: T('today is Saturday'),
      Rest: T('I rest'),
    },
  } },
  chapters: [{
    id: 'ground',
    machine: 'prover',
    levels: ['given', 'apply', 'suppose'],
    chapter: { title: T('The foundation'), question: T('What can be built from Apply and the assumption box alone?') },
  }],
}
const qedKernel = createPluginKernel()
registerQED(qedKernel.forPackage('qed', 'core'))
registerLogic(qedKernel.forPackage('logic', 'core'))
const fixtureKinds = Object.fromEntries(['logic/symbol', 'qed/wordset'].map(name => [name, JSON.parse(readFileSync(new URL(`../../${name.split('/')[0]}/kinds/${name.split('/')[1]}.json`, import.meta.url)))]))
export const logicVocabulary = withKindDeclarations(projectVocabulary({ ...contentVocabulary([]), meanings: [...contentMeanings, genericProgress, progressMeaning, logicMeaning, ...qedKernel.tables.kind.values()] }), Object.entries(fixtureKinds).map(([name, value]) => ({ id: name.split('/')[0], resolved: true, objects: [{ kind: 'kind', name: name.split('/')[1], value }] })))
const proofVocabulary = logicVocabulary

const GLOSSARY = {
  groups: [{ id: 'logic', title: T('Logic') }],
  entries: [{
    id: 'proof',
    group: 'logic',
    title: T('proof'),
    at: 'given',
    body: [T('A board that wires the givens, step by step, to the goal.')],
  }],
}

// Its parts: Apply, the assumption box and the implication key.
const PARTS = {

  parts: {
    mp: { name: T('套用', 'Apply'), desc: T('由 A → B 和 A 得到 B。', 'From A → B and A, B.'), icon: 'GitFork', family: 'logic/rule', outputType: 'logic/judgment', inputs: [{ name: 'imp', type: 'logic/judgment', label: T('A → B') }, { name: 'a', type: 'logic/judgment', label: T('A') }], op: 'logic/mp' },
    impI: { name: T('假设框', 'Assumption box'), desc: T('框里假设 A，证出 B，得到 A → B。', 'Assume A inside, prove B, get A → B.'), icon: 'Box', family: 'logic/box', outputType: 'logic/judgment', inputs: [], settings: { 'A': { control: 'tree', label: T('假设', 'Assume') } }, regions: [{ name: 'body', type: 'logic/judgment', label: T('框内', 'Inside'), opens: true, closes: true }], op: 'logic/impI' },
  },
}
const LEVELS = {
  given: {
    title: T('Copy'),
    intro: [{ t: T('The given is on the left, the goal on the right; one wire is a <wiki-ref to="proof"></wiki-ref>.') }],
    after: T('A given is already a proof of itself.'),
    tasks: [{
      id: 'given',
      kind: 'logic/proof',
      tests: [{ premises: { p: 'A' }, goal: 'A' }],
      cases: [{ A: 'Sat' }, { A: 'Rain' }],
      solution: ['goal <- p'],
      brief: T('Given that “today is Saturday”, prove that “today is Saturday”.'),
      hint: [T('Wire the given to the goal.')],
    }],
  },
  apply: {
    title: T('Apply'),
    adds: ['mp'],
    after: T('Apply looks only at shape.'),
    tasks: [{
      id: 'apply',
      kind: 'logic/proof',
      tests: [{ premises: { p: 'A → B', q: 'B → C', r: 'A' }, goal: 'C' }],
      cases: [{ A: 'Rain', B: 'Wet', C: 'Slip' }],
      brief: T('Given “it rains → the ground is wet”, “the ground is wet → the road is slippery” and “it rains”, prove “the road is slippery”.'),
      hint: [T('The first Apply gives “the ground is wet”.')],
      solution: ['m1 = mp(p, r)', 'm2 = mp(q, m1)', 'goal <- m2'],
    }],
  },
  suppose: {
    title: T('Suppose'),
    adds: ['impI'],
    after: T('To prove an “if … then …”, assume its first half.'),
    tasks: [{
      id: 'suppose',
      kind: 'logic/proof',
      tests: [{ premises: { p: 'A → B', q: 'B → C' }, goal: 'A → C' }],
      cases: [{ A: 'Sat', B: 'Rain', C: 'Rest' }],
      brief: T('Given “today is Saturday → it rains” and “it rains → I rest”, prove “today is Saturday → I rest”.'),
      hint: [T('On the box, set “Assume” to “today is Saturday”.')],
      solution: ['f = impI[A=A](body: m2) {', '  body {', '    m1 = mp(p, f.body)', '    m2 = mp(q, m1)', '  }', '}', 'goal <- f'],
    }],
  },
}

/** Write a temporary game (its course) and package in the same format as checked-in content. */
export function writeContentFixture(root, id, { game: sourceGame, glossary, partDefs, levels, tags = {}, relations = {}, sections = {}, trays = {}, tagOverrides = {}, uses = {}, packages = uses }, domainVocabulary) {
  const { contentObjects = {}, ...game } = sourceGame
  const course = join(root, 'games', id)
  const pkg = join(root, 'packages', id)
  mkdirSync(course, { recursive: true })
  mkdirSync(join(pkg, 'levels'), { recursive: true })
  const put = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
  const putCatalogs = (dir, ...values) => {
    mkdirSync(join(dir, 'i18n'), { recursive: true })
    for (const [lang, entries] of Object.entries(catalogsOf(dir, ...values))) put(join(dir, 'i18n', `${lang}.json`), entries)
  }
  if (id !== 'circuit') installCircuitFixture(root)
  installProgressFixture(root)
  if (Object.values(partDefs?.parts ?? {}).some(part => part.stages?.length)
    || Object.values(trays).some(tray => Object.hasOwn(tray, 'includeUnlisted'))
    || Object.values(levels).some(level => [level, ...(level.tasks ?? [])].some(usesGrants))) installPartPolicy(pkg)
  installGlossaryFixture(root)
  const logic = Object.values(levels).some(level => level.tasks?.some(task => (task.play ?? task.kind)?.startsWith('logic/')))
  if (logic) installLogicFixture(root)
  const vocabulary = withParts(glossarySchemas(circuitFixtureSchema(domainVocabulary)), partDefs)
  const normalize = (value, schema, prefix) => normalizeText(value, schema, prefix, { vocabulary })
  const chapterValues = game.chapters ?? []
  const chapterText = chapterValues.map(({ id, ...value }) => [String(id), normalize(value, CHAPTER, `course.eras.${id}`)])
  const gameText = normalize({ ...game, chapters: chapterText.map(([name]) => `@${id}/${name}`) }, vocabulary.game, 'game')
  const glossaryText = normalize(glossary, GLOSSARY_SCHEMA, 'glossary')
  const partsText = partDefs === undefined ? undefined : normalize(partDefs, PARTS_FILE, 'parts')
  const levelText = Object.entries(levels).map(([level, value]) => [level, normalize(value, vocabulary.level, `level.${level}`)])
  const objectText = Object.entries({ tags, relations, sections, trays }).flatMap(([kind, values]) => Object.entries(values).map(([name, value]) => [kind, name, normalize(value, kind === 'trays' ? JSON.parse(readFileSync(new URL('../../circuit/kinds/tray.json', import.meta.url))).schema : kind === 'sections' ? kindSchemas(vocabulary).section : OBJECT_SCHEMAS[kind], `${kind.split('/').at(-1)}.${name}`)]))
  put(join(course, 'game.json'), { kernel: kernelRange, packages: { [id]: '^0.0.0', circuit: '^0.0.0', progress: '^0.0.0', wiki: '^0.0.0', ...(logic && { logic: '^0.0.0', qed: '^0.0.0', numlib: '^0.0.0', sentence: '^0.0.0', workshop: '^0.0.0' }), ...packages }, ...sourceValue(expandNames(gameText, id, { parts: new Set(Object.keys(partDefs?.parts ?? {})), schema: vocabulary.game, vocabulary, context: 'configuration', textKeys: false })) })
  for (const [path, values] of Object.entries(tagOverrides)) {
    const file = join(course, 'overrides', path + '.json')
    mkdirSync(join(file, '..'), { recursive: true })
    put(file, { values: { add: values } })
  }
  mkdirSync(join(course, 'chapters'), { recursive: true })
  for (const [name, value] of chapterText) put(join(course, 'chapters', `${name}.json`), sourceValue(expandNames(value, id, { schema: CHAPTER, vocabulary, textKeys: false })))
  const packageConfig = { kind: 'lib', version: '0.0.0', kernel: kernelRange, uses: { circuit: '^0.0.0', progress: '^0.0.0', wiki: '^0.0.0', ...(logic && { logic: '^0.0.0', qed: '^0.0.0' }), ...uses } }
  if (glossaryText.entries.length) mkdirSync(join(pkg, 'entries'), { recursive: true })
  for (const { id, group: _group, ...entry } of glossaryText.entries) put(join(pkg, 'entries', `${id}.json`), sourceValue(entry))
  if (glossaryText.groups.length) mkdirSync(join(pkg, 'tags/entry'), { recursive: true })
  for (const { id, ...group } of glossaryText.groups) put(join(pkg, 'tags/entry', `${id}.json`), { ...sourceValue(group), values: glossaryText.entries.filter((e) => e.group === id).map((e) => e.id) })
  mkdirSync(join(pkg, 'parts'), { recursive: true })
  for (const [name, part] of Object.entries(partsText?.parts ?? {})) put(join(pkg, 'parts', `${name}.json`), sourceValue(part))
  for (const [level, value] of levelText) put(join(pkg, 'levels', `${level}.json`), sourceValue(value))
  for (const [kind, name, value] of objectText) {
    const folder = kind === 'tags' ? `${kind}/${value.kind}` : kind
    mkdirSync(join(pkg, folder), { recursive: true })
    const { kind: _kind, ...tag } = value
    put(join(pkg, folder, `${name}.json`), sourceValue(kind === 'tags' ? tag : value))
  }
  putCatalogs(course, gameText, ...chapterText.map(([, value]) => value))
  const extra = Object.entries(contentObjects).flatMap(([kind, values]) => Object.entries(values).map(([name, value]) => [kind, name, normalize(value, kindSchemas(vocabulary)[kind], `${kind.split('/').at(-1)}.${name}`)]))
  for (const [kind, name, value] of extra) { mkdirSync(join(pkg, vocabulary.objectKinds?.[kind]?.folder ?? folders[kind]), { recursive: true }); put(join(pkg, vocabulary.objectKinds?.[kind]?.folder ?? folders[kind], `${name}.json`), sourceValue(value)) }
  putCatalogs(pkg, ...extra.map(([, , value]) => value), glossaryText, partsText, ...levelText.map(([, value]) => value), ...objectText.map(([, , value]) => value))
  const words = packageWordsFixture((path, entries) => {
    const file = join(root, path)
    mkdirSync(join(file, '..'), { recursive: true })
    const catalog = { ...(existsSync(file) && JSON.parse(readFileSync(file, 'utf8'))), ...entries }
    put(file, Object.fromEntries(Object.keys(catalog).sort().map(key => [key, catalog[key]])))
  }, id)
  put(join(pkg, 'package.json'), { ...packageConfig, ...words })
  lockTarget({ kind: 'package', id }, root)
  lockTarget({ kind: 'game', id }, root)
}

export function proofsRoot() {
  const root = mkdtempSync(join(tmpdir(), 'games-'))
  writeContentFixture(root, ID, { game: { ...GAME, contentObjects: { ...GAME.contentObjects, 'logic/symbol': { formulaImplies: { mark: 'logic/formulaImplies', icon: 'Rows3', name: '→', desc: T('Implication'), at: 'apply' } } } }, glossary: GLOSSARY, partDefs: PARTS, levels: LEVELS, tagOverrides: { 'circuit/tags/circuit/part/primitives': ['proofs/mp', 'proofs/impI'] }, relations: { path: { kind: 'requires', edges: [{ from: 'given', to: 'apply' }, { from: 'apply', to: 'suppose' }] } } }, proofVocabulary)
  return { root, id: ID }
}

/** Source definitions for unit tests that compose their own small content over the starter's resources. */
export function starterParts(domainDir) {
  const dir = join(domainDir, 'starter')
  return { parts: Object.fromEntries(objectFiles(dir, 'parts').map(([name, file]) => [name, catalogReader(readCatalogs(join(dir, 'i18n/package')))(JSON.parse(readFileSync(file, 'utf8')))])) }
}

/** Seal the dependencies of a completed synthetic project before invoking production readers. */
export function lockFixture(root, targets) {
  installCircuitFixture(root)
  for (const id of packageIds(root).filter(id => id !== 'circuit')) {
    const file = join(root, 'packages', id, 'package.json')
    const config = JSON.parse(readFileSync(file))
    const dir = join(root, 'packages', id)
    const legacy = ['parts', 'trays'].some(folder => existsSync(join(dir, folder))) || objectFiles(dir, 'levels').some(([, file]) => JSON.parse(readFileSync(file)).tasks?.some(task => !task.play))
    const logic = ['parts', 'levels', 'symbols'].some(folder => objectFiles(dir, folder).some(([, file]) => /logic\//.test(readFileSync(file, 'utf8'))))
    if (logic) { installLogicFixture(root); config.uses = { ...config.uses, logic: '^0.0.0', qed: '^0.0.0' }; writeFileSync(file, JSON.stringify(config, null, 2) + '\n') }
    const progressing = (config.uses?.progress && config.uses?.circuit) || ['parts', 'levels', 'trays'].some(folder => objectFiles(dir, folder).some(([, file]) => {
      const object = JSON.parse(readFileSync(file))
      if (folder === 'parts') return Object.hasOwn(object, 'stages')
      if (folder === 'trays') return Object.hasOwn(object, 'includeUnlisted')
      return [object, ...(object.tasks ?? [])].some(usesGrants)
    }))
    if (progressing) {
      installProgressFixture(root)
      installPartPolicy(dir)
      config.uses = { ...config.uses, progress: '^0.0.0' }
      writeFileSync(file, JSON.stringify(config, null, 2) + '\n')
    }
    if (legacy) { config.uses = { ...config.uses, circuit: '^0.0.0' }; writeFileSync(file, JSON.stringify(config, null, 2) + '\n') }
  }
  const games = join(root, 'games')
  for (const id of existsSync(games) ? readdirSync(games) : []) {
    const file = join(games, id, 'game.json')
    if (!existsSync(file)) continue
    const game = JSON.parse(readFileSync(file))
    game.packages = { ...game.packages, ...Object.fromEntries(packageIds(root).filter(id => ['logic', 'qed', 'progress', 'numlib', 'sentence', 'wiki', 'workshop'].includes(id)).map(id => [id, '^0.0.0'])), circuit: '^0.0.0' }; game.kernel = kernelRange
    writeFileSync(file, JSON.stringify(game, null, 2) + '\n')
  }
  for (const id of packageIds(root)) {
    const file = join(root, 'packages', id, 'package.json')
    const config = JSON.parse(readFileSync(file)); config.kernel = kernelRange
    writeFileSync(file, JSON.stringify(config, null, 2) + '\n')
  }
  targets ??= [
    ...resolveLayers({ packages: packageIds(root), closure: true, root, unlocked: true }).layers.map(({ id }) => ({ kind: 'package', id })),
    ...contentTargets([], root, { game: true }),
  ]
  for (const target of targets) lockTarget(target, root)
}

// Synthetic projects reuse mechanism declarations, without authored course content.
export function installCircuitFixture(root) {
  installProgressFixture(root)
  const dir = join(root, 'packages', 'circuit')
  if (existsSync(join(dir, 'package.json'))) return
  mkdirSync(dir, { recursive: true })
  for (const folder of ['kinds', 'shapes', 'i18n', 'core', 'view', 'capabilities']) cpSync(new URL(`../../circuit/${folder}`, import.meta.url), join(dir, folder), { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ kind: 'feature', type: 'module', version: '0.0.0', kernel: kernelRange, uses: { progress: '^0.0.0' }, title: '@package.title', desc: '@package.desc' }, null, 2) + '\n')
}

export const circuitFixtureKinds = {
  'circuit/part': { declares: 'package', overrides: { package: ['*'], game: ['$text'] }, folder: 'parts', relations: { replaces: { from: 'circuit/part', to: 'circuit/part' } }, schema: { type: 'any' } },
  'circuit/tray': { folder: 'trays', schema: { type: 'obj', fields: {
    title: { type: 'text', optional: true }, values: { type: 'list', of: { type: 'str', reference: 'circuit/part' } },
    menus: { type: 'list', optional: true, of: { type: 'obj', fields: {
      id: { type: 'str', reference: 'menu' }, title: { type: 'text', optional: true }, values: { type: 'list', of: { type: 'str', reference: 'circuit/part' } },
    } } },
  } }, declares: 'package', overrides: { package: ['*'], game: ['$text'] } },
}
export const circuitFixtureSchema = schemas => ({ ...schemas, meanings: [...contentMeanings, ...(schemas.meanings ?? []).filter(meaning => !contentMeanings.includes(meaning))], objectKinds: { ...circuitFixtureKinds, ...schemas.objectKinds } })

/** Synthetic circuit inputs enter the same typed registries as installed packages. */
export function assembleCircuitFixture({ partDefs, trays = [], glossary, sections = [], ...options }) {
  const chapterObjects = Object.fromEntries((options.game.chapters ?? []).filter(value => typeof value === 'object').map(({ id, ...value }) => [String(id), value]))
  const game = Object.keys(chapterObjects).length ? { ...options.game, chapters: Object.keys(chapterObjects).map(name => `@${options.id}/${name}`) } : options.game
  return assembleContent({ ...options, game, schemas: glossary ? glossarySchemas(circuitFixtureSchema(options.schemas)) : circuitFixtureSchema(options.schemas), contentObjects: {
    ...options.contentObjects,
    ...(glossary && { entry: Object.fromEntries(glossary.entries.map(({ id, group: _, ...value }) => [id, value])), section: Object.fromEntries(sections.map(([id, value, namespace]) => [namespace ? `${namespace}/${id}` : id, value])) }),
    chapter: { ...chapterObjects, ...options.contentObjects?.chapter },
    ...(partDefs && { 'circuit/part': partDefs.parts }),
    ...(trays.length && { 'circuit/tray': Object.fromEntries(trays.map(([name, value, namespace]) => [namespace && !name.includes('/') ? `${namespace}/${name}` : name, value])) }),
  } })
}

export function installImageFixture(root) {
  installGlossaryFixture(root)
  installCircuitFixture(root)
  for (const id of ['image', 'imglib', 'cvlib', 'mllib']) {
    const dir = join(root, 'packages', id)
    mkdirSync(dir, { recursive: true })
    for (const folder of ['core', 'view', 'kinds', 'shapes', 'capabilities', 'i18n'].filter(folder => existsSync(new URL(`../../${id}/${folder}`, import.meta.url)))) cpSync(new URL(`../../${id}/${folder}`, import.meta.url), join(dir, folder), { recursive: true })
    cpSync(new URL(`../../${id}/package.json`, import.meta.url), join(dir, 'package.json'))
  }
}

/** Install table and its course-specific consumer without real authored objects. */
export function installTableFixture(root) {
  installImageFixture(root)
  for (const id of ['table', 'state-graph']) {
    const dir = join(root, 'packages', id)
    mkdirSync(dir, { recursive: true })
    for (const folder of ['core', 'view', 'kinds', 'shapes', 'capabilities', 'i18n'].filter(folder => existsSync(new URL(`../../${id}/${folder}`, import.meta.url)))) cpSync(new URL(`../../${id}/${folder}`, import.meta.url), join(dir, folder), { recursive: true })
    cpSync(new URL(`../../${id}/package.json`, import.meta.url), join(dir, 'package.json'))
  }
}

/** Install logic and QED declarations without any authored course objects. */
export function installScalarFixture(root) {
  const dir = join(root, 'packages/numlib')
  if (existsSync(join(dir, 'package.json'))) return
  for (const file of ['core', 'i18n', 'package.json']) {
    cpSync(new URL(`../../numlib/${file}`, import.meta.url), join(dir, file), { recursive: true })
  }
}

export function installLogicFixture(root) {
  installGlossaryFixture(root)
  installScalarFixture(root)
  installCircuitFixture(root)
  for (const id of ['sentence', 'logic', 'workshop', 'qed']) {
    const dir = join(root, 'packages', id)
    if (existsSync(join(dir, 'package.json'))) continue
    mkdirSync(dir, { recursive: true })
    for (const folder of ['core', 'view', 'kinds', 'shapes', 'capabilities', 'i18n'].filter(folder => existsSync(new URL(`../../${id}/${folder}`, import.meta.url)))) cpSync(new URL(`../../${id}/${folder}`, import.meta.url), join(dir, folder), { recursive: true })
    cpSync(new URL(`../../${id}/package.json`, import.meta.url), join(dir, 'package.json'))
  }
}

const starterFixtures = new Map()
process.once('exit', () => { for (const root of starterFixtures.values()) rmSync(root, { recursive: true, force: true }) })
/** Install package-owned test data once for readers and dry-run workspaces. */
export function starterRoot(fixtureDir) {
  if (starterFixtures.has(fixtureDir)) return starterFixtures.get(fixtureDir)
  const source = join(fixtureDir, 'starter')
  const root = mkdtempSync(join(tmpdir(), 'package-example-'))
  starterFixtures.set(fixtureDir, root)
  const { uses } = JSON.parse(readFileSync(join(source, 'package.json')))
  if (uses.logic) installLogicFixture(root)
  else if (uses['state-graph']) installTableFixture(root)
  else {
    installCircuitFixture(root)
    installScalarFixture(root)
    installGlossaryFixture(root)
  }
  const pkg = join(root, 'packages/starter')
  const game = join(root, 'games/starter')
  mkdirSync(game, { recursive: true })
  const gameFiles = ['game.json', 'chapters', 'overrides']
  cpSync(source, pkg, { recursive: true, filter: file => ![...gameFiles, 'i18n'].some(name => file === join(source, name)) })
  for (const name of gameFiles) cpSync(join(source, name), join(game, name), { recursive: true })
  cpSync(join(source, 'i18n/course'), join(game, 'i18n'), { recursive: true })
  cpSync(join(source, 'i18n/package'), join(pkg, 'i18n'), { recursive: true })
  const config = JSON.parse(readFileSync(join(game, 'game.json')))
  config.packages = Object.fromEntries(['starter', ...packageIds(root).filter(id => id !== 'starter')].map(id => [id, '^0.0.0']))
  writeFileSync(join(game, 'game.json'), JSON.stringify(config))
  lockFixture(root, [{ kind: 'package', id: 'starter' }, { kind: 'game', id: 'starter' }])
  return root
}

export const readStarter = fixtureDir => readContent('starter', starterRoot(fixtureDir))

const partPolicy = { kind: 'circuit/part', stages: true, grants: true, unlocks: true, checks: ['stages', 'availability', 'course', 'references'] }
const usesGrants = object => ['adds', 'gives', 'withholds', 'opens', 'awards', 'local'].some(field => Object.hasOwn(object, field))
function installPartPolicy(dir) {
  const folder = join(dir, 'progress-policies')
  mkdirSync(folder, { recursive: true })
  if (!existsSync(join(folder, 'parts.json'))) writeFileSync(join(folder, 'parts.json'), JSON.stringify(partPolicy) + '\n')
}

function installProgressFixture(root) {
  const dir = join(root, 'packages/progress')
  if (existsSync(join(dir, 'package.json'))) return
  mkdirSync(dir, { recursive: true })
  for (const path of ['core', 'view', 'kinds', 'i18n', 'package.json']) {
    cpSync(new URL(`../../progress/${path}`, import.meta.url), join(dir, path), { recursive: true })
  }
}

// Runtime fixtures that author progress fields opt into the same policy used by real content.
export function withProgressFixture(content) {
  const vocabulary = contentSchemas.get(content)
  const data = { ...content, registries: { ...content.registries, 'progress/policy': { parts: partPolicy } } }
  contentSchemas.set(data, { ...vocabulary, meanings: [...(vocabulary?.meanings ?? []), genericProgress, progressMeaning] })
  return data
}
