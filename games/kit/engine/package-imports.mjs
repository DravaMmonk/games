// Resolve the public kernel API before Node links package dependencies.
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import { uiCatalogDirectory, uiCatalogModule } from './ui-catalog-source.js'
const entries = { kernel: new URL('./index.js', import.meta.url).href, 'kernel/view': new URL('../app/view.jsx', import.meta.url).href }
const uiModules = new Map()
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'kernel/words' && context.parentURL?.startsWith('file:')) {
    const dir = uiCatalogDirectory(fileURLToPath(context.parentURL))
    if (!uiModules.has(dir)) {
      const source = uiCatalogModule(dir, new URL('../shell/ui-words.js', import.meta.url).href)
      uiModules.set(dir, 'data:text/javascript,' + encodeURIComponent(source))
    }
    return next(uiModules.get(dir), context)
  }
  return next(entries[specifier] ?? specifier, context)
} })
// Child check and contract processes inherit the same public import environment.
const preload = `--import=${new URL(import.meta.url).pathname}`
if (!(process.env.NODE_OPTIONS ?? '').includes(preload)) process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} ${preload}`.trim()
const { installPackageImports } = await import('./plugin-boundaries.js')
installPackageImports()
