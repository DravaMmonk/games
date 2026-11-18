import { readFileSync } from 'node:fs'
import { createPluginKernel, pluginMeanings } from '../../../games/kit/engine/plugins.js'
import { withKindDeclarations } from '../../../games/kit/engine/plugin-kinds.js'
import { register } from '../core/index.js'

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url)))
const kernel = createPluginKernel()
register(kernel.forPackage('wiki', 'core'))
const layer = {
  id: 'wiki', config: { uses: {} }, meanings: pluginMeanings(kernel),
  catalogs: Object.fromEntries(['en', 'zh'].map(lang => [lang, read(`i18n/${lang}.json`)])),
  objects: ['entry', 'section', 'game'].map(name => ({ kind: 'kind', name, value: read(`kinds/${name}.json`) })),
}
export const glossarySchemas = base => withKindDeclarations({ ...base, meanings: [...base.meanings ?? [], ...layer.meanings] }, [layer])
