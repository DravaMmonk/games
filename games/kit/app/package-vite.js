import { uiCatalogDirectory, uiCatalogModule } from '../engine/ui-catalog-source.js'
import { catalogFiles } from '../engine/resolver.js'
// Both browser entry points use this public export map and topological registration source.
import { resolve } from 'node:path'
import { exportPath } from '../engine/plugin-boundaries.js'
import { packageEntries } from '../engine/plugin-node.js'
import { layerVocabulary, contentRoot, gameCatalog, packageIds, resolveLayers } from '../engine/resolver.js'

const KIT = resolve(import.meta.dirname, '..')
const q = JSON.stringify
const UI = '\0ui-catalog:'
export function pluginSource(layers, root = contentRoot()) {
  const entries = packageEntries(layers, root)
  const schemas = layerVocabulary(layers)
  return [
    ...entries.flatMap((entry, index) => ['core', 'view'].filter(side => entry[side]).map(side => `import * as ${side}${index} from ${q(entry[side])}`)),
    `import { registerPlugins, pluginMeanings, pluginObjects } from ${q(resolve(KIT, 'engine/plugins.js'))}`,
    `import { pluginGame } from ${q(resolve(KIT, 'app/plugin-game.jsx'))}`,
    `const kernel = await registerPlugins([${entries.map((entry, index) => `{ id: ${q(entry.id)}, ${['core', 'view'].filter(side => entry[side]).map(side => `${side}: ${side}${index}`).join(', ')} }`).join(', ')}], { view: true })`,
    `import { vocabularyFor } from ${q(resolve(KIT, 'engine/kernel.js'))}`,
    `const vocabulary = { ...vocabularyFor(), packageCode: ${q(schemas.packageCode)}, codeObjects: pluginObjects(kernel), meanings: pluginMeanings(kernel) }`,
  ].join('\n')
}
export function packageApp(root = contentRoot()) {
  return { name: 'package-code',
    resolveId(id, importer) {
      if (id === 'kernel/words') return UI + uiCatalogDirectory(importer)
      if (id === 'virtual:game-catalog') return '\0virtual:game-catalog'
      if (id === 'virtual:package-displays') return '\0virtual:package-displays'
      const index = importer?.lastIndexOf('/packages/') ?? -1
      return exportPath(id, index >= 0 ? importer.slice(0, index) : root)
    },
    async load(id) {
      if (id.startsWith(UI)) {
        const dir = id.slice(UI.length)
        for (const [, file] of catalogFiles(dir)) this.addWatchFile(file)
        return uiCatalogModule(dir, resolve(KIT, 'shell/ui-words.js'))
      }
      if (id === '\0virtual:game-catalog') return `export const GAMES = ${q(gameCatalog(root))}`
      if (id !== '\0virtual:package-displays') return null
      const layers = [...new Map(packageIds(root).flatMap(id => resolveLayers({ package: id, closure: true, root, unlocked: true }).layers).map(layer => [layer.id, layer])).values()]
      const entries = packageEntries(layers, root).filter(entry => entry.view)
      return `const bundles = { ${entries.map(entry => `${q(entry.id + '/view')}: () => import(${q(entry.view)})`).join(', ')} }; export async function loadPackageDisplays(name) { if (!bundles[name]) throw new Error('unknown display bundle ' + name); return (await bundles[name]()).displays }`
    },
  }
}
