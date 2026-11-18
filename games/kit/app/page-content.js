import { withCapabilityDeclarations } from '../engine/capabilities.js'
import { kindSchemas, schemaLayers, withKindDeclarations } from '../engine/plugin-kinds.js'
import { vocabularyFor } from '../engine/kernel.js'
import { ENTRY } from '../engine/vocabulary.js'
import { projectVocabulary } from '../engine/kind-meanings.js'
import { OBJECT_SCHEMAS } from '../engine/objects.js'
import { BLUEPRINT } from '../pipeline/blueprint.js'
import { catalogReader } from '../engine/catalogs.js'
import { assemble } from '../engine/content.js'

/** Resolve the separately published language files once at startup so switching languages needs no reload. */
export async function pageContent(manifest, base, fetcher = fetch, vocabulary) {
  const { id, locales, levels, glossary, blueprint, tags, relations, sections, game, contentObjects = {} } = manifest
  async function reader(scope) {
    const catalogs = await Promise.all(Object.entries(locales[scope]).map(async ([lang, path]) => {
      const response = await fetcher(new URL(path, base))
      if (!response.ok) throw new Error(`${path}: ${response.status} ${response.statusText}`)
      return [lang, await response.json()]
    }))
    return Object.fromEntries(catalogs)
  }
  const [courseCatalogs, packageCatalogs] = await Promise.all([reader('course'), reader('package')])
  const courseText = catalogReader(courseCatalogs, 'i18n/course')
  const packageText = catalogReader(packageCatalogs, 'i18n/package')
  if (vocabulary.packageCode !== undefined) {
    const order = [...new Set([...Object.keys(contentObjects.kind ?? {}), ...Object.keys(contentObjects.shape ?? {})].map(name => name.split('/')[0]))]
    const layers = schemaLayers(order, { kind: contentObjects.kind, shape: contentObjects.shape }, { catalogs: packageCatalogs })
    const declarations = manifest.capabilityDeclarations ?? {}
    const capabilityLayers = Object.entries(declarations).map(([id, capabilityDeclarations]) => ({ id, capabilityDeclarations }))
    vocabulary = withKindDeclarations(withCapabilityDeclarations(projectVocabulary({ ...vocabularyFor(), codeObjects: vocabulary.codeObjects, meanings: vocabulary.meanings }), capabilityLayers), layers, vocabulary.packageCode, { checked: true })
  }

  // The published content was checked when it was built, against every package's registrations, view ones (a
  // game's hero display) included; the page holds only what it plays, so it does not check existence again.
  return assemble({
    id, schemas: vocabulary, existenceChecked: true, provenance: manifest.capabilityDeclarations && { capabilityDeclarations: manifest.capabilityDeclarations },
    contentObjects: Object.fromEntries(Object.entries(contentObjects).map(([kind, values]) => [kind, Object.fromEntries(Object.entries(values).map(([name, value]) => [name, (kind === 'chapter' ? courseText : packageText)(value, `${kind}/${name}.json`, kindSchemas(vocabulary)[kind], vocabulary)]))])),
    game: courseText(game, 'game.json', vocabulary.game, vocabulary),
    levels: levels.map(([level, value]) => [level, packageText(value, `levels/${level}.json`, vocabulary.level, vocabulary)]),
    ...Object.fromEntries(Object.entries({ tags, relations, sections }).map(([kind, values]) => [kind, (values ?? []).map(([name, value, ns]) => [name, (kind === 'chapter' ? courseText : packageText)(value, `${kind}/${name}.json`, OBJECT_SCHEMAS[kind], vocabulary), ns])])),
    glossary: { groups: [], entries: glossary.entries.map(({ id, ...entry }) => ({ id, ...packageText(entry, `entries/${id}.json`, ENTRY, vocabulary) })) },
    blueprint: courseText(blueprint, 'blueprint.json', BLUEPRINT, vocabulary),
    fromDisk: true,
  })
}
