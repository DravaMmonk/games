// Browser assembly shared by Studio's preview and its single-level play page.
import { projectVocabulary } from '../engine/kind-meanings.js'
import { pluginMeanings, registerPlugins } from '../engine/plugins.js'
import { schemaLayers, withKindDeclarations } from '../engine/plugin-kinds.js'
import { vocabularyFor } from '../engine/kernel.js'
import { runtimeIds } from '../engine/runtime-model.js'
import { composeGame, configureGame } from './compose-game.js'
import { pluginGame } from './plugin-game.jsx'

export async function loadGame(content, packageLoaders) {
  const entries = []
  for (const id of content.layerOrder ?? []) if (packageLoaders[id]) entries.push({ id, ...await packageLoaders[id]() })
  const kernel = await registerPlugins(entries, { view: true, tasks: content.levels.flatMap(level => level.tasks) })
  const ids = runtimeIds(content)
  const pluginIds = new Set([...kernel.tables.play.keys()].map(name => name.split('/')[0]))
  const layers = schemaLayers(content.layerOrder ?? [], {
    kind: Object.fromEntries(Object.entries(content.registries?.kind ?? {}).filter(([name]) => content.objectKinds?.[name])),
    shape: content.registries?.shape,
  }, { resolved: true })
  const vocabulary = withKindDeclarations(projectVocabulary({ ...vocabularyFor([]), meanings: pluginMeanings(kernel) }), layers, pluginIds.size > 0, { checked: true })
  const modules = ids.map(id => pluginGame(id, kernel, vocabulary))
  const game = composeGame(content, modules)
  return configureGame(game, content, kernel)
}
