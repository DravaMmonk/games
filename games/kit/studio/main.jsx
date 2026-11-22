// The studio's page (games/design/README.md 6.7): the editor, or with ?play the game played inside it (an iframe of the
// same page, so a game's own styles never reach the editor's).
import { StrictMode, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import '../tokens.css'
import '../ui.css'

import { tr } from '../shell/i18n.js'
import Loading from './Loading.jsx'

const query = new URLSearchParams(window.location.search)
const root = createRoot(document.getElementById('root'))
const editing = !query.has('play') && !query.has('source')
const initialCatalogs = editing ? import('./api.js').then(({ loadCatalogs }) => loadCatalogs()) : null
// The workspace reads the result after plugin registration, including a failed preload.
initialCatalogs?.catch(() => {})

async function workspace() {
  if (query.has('source') && !query.has('play')) return (await import('./PackageSource.jsx')).default
  const [{ PACKAGES }, { registerPlugins }, { installStudioPlugins }] = await Promise.all([
    import('virtual:studio-domains'), import('../engine/plugins.js'), import('./editors.js'),
  ])
  const entries = await Promise.all(Object.entries(PACKAGES).map(async ([id, load]) => ({ id, ...await load() })))
  installStudioPlugins(await registerPlugins(entries, { view: true }))
  return (await (query.has('play') ? import('./play.jsx') : import('./Studio.jsx'))).default
}

try {
  if (editing) root.render(<Loading />)
  root.render(<StrictMode>{createElement(await workspace(), { initialCatalogs })}</StrictMode>)
} catch (error) {
  const source = new URLSearchParams({ source: '', package: query.get('package') ?? '' })
  root.render(<main className="studio-loading">
    <p role="alert">{error.message}</p>
    <a href={`?${source}`}>{tr("打开包源码")}</a>
  </main>)
}
