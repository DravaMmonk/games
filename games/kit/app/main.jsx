// Every game's page: the shared kit's styles and shell, around the game the page is for. The page is its domain's
// code (virtual:game, from ./vite.js); the content it plays is read when the page opens (content.json beside it) and
// checked against the domain's vocabulary first: content that does not fit is shown as what is wrong with it, never
// handed to the domain. A domain never writes into its content: on the dev server the page reads it frozen.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../tokens.css'
import '../ui.css'
import '../shell/shell.css'
import '../views/views.css'
import { GameShell } from '../shell/index.js'
import { createProgress } from '../shell/progress.js'
import { taskStamps } from '../engine/stamp.js'
import { checkContent } from '../engine/vocabulary.js'
import { contentSchemas, deepFreeze } from '../engine/content.js'
import { loadDomain } from 'virtual:game'
import { assetSignature, cleanRefreshURL, recoveryURL } from './release.js'
import { ReleaseWatch, Unreadable } from './ReleaseWatch.jsx'
import { pageContent } from './page-content.js'
import { registerOffline } from './offline.js'

async function open() {
  const [{ define, vocabulary: sourceVocabulary }, response] = await Promise.all([loadDomain(), fetch(new URL('content.json', window.location.href), { cache: 'no-store' })])
  if (!response.ok) return { page: <Unreadable problems={[`content.json: ${response.status} ${response.statusText}`]} />, content: null }
  // On the dev server the content is frozen, so a domain that writes into it fails at once (its checks read it so too).
  const contentText = await response.text()
  const parsed = await pageContent(JSON.parse(contentText), window.location.href, fetch, sourceVocabulary)
  const vocabulary = contentSchemas.get(parsed)
  const content = import.meta.env.DEV ? deepFreeze(parsed) : parsed
  const problems = checkContent({ vocabulary }, content).map((p) => `${p.at}: ${p.says}`)
  if (problems.length) return { page: <Unreadable problems={problems} />, content: contentText }
  const game = define(content)
  const options = { content, tasks: taskStamps(vocabulary, content) }
  const store = game.openProgress?.(options) ?? createProgress({ id: content.id, tasks: options.tasks })
  return { page: <GameShell game={game} store={store} />, content: contentText }
}

async function start() {
  const base = window.location.href
  const loadedAssets = assetSignature(document, base)
  let result
  try {
    result = await open()
  } catch (error) {
    const retry = !import.meta.env.DEV && await recoveryURL({ base, assets: loadedAssets })
    if (retry) {
      window.location.replace(retry)
      return
    }
    result = { page: <Unreadable problems={[String(error)]} />, content: null }
  }
  const clean = cleanRefreshURL(base)
  if (clean !== base) window.history.replaceState(window.history.state, '', clean)
  createRoot(document.getElementById('root')).render(
    <StrictMode><ReleaseWatch {...result} loadedAssets={loadedAssets} /></StrictMode>,
  )
}

void start()
registerOffline(new URL('../', window.location.href))
