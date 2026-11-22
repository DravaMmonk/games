import { withCapabilityDeclarations } from '../engine/capabilities.js'
// The studio's one way to the games: a tool of the kernel (../engine/ops/tools.js) over the dev server's bridge
// (../app/studio.js). A tool that cannot run throws its error.
import { projectVocabulary } from '../engine/kind-meanings.js'
import { registeredMeanings } from './editors.js'
import { vocabularyFor } from '../engine/kernel.js'
import { schemaLayers, withKindDeclarations } from '../engine/plugin-kinds.js'

// Tools that only read. The same read asked again while the first is on its way (a view opened twice, an effect run
// twice in development) waits for the first instead of queueing behind it on the bridge.
const READS = new Set(['games', 'packages', 'vocabulary', 'preview', 'names', 'objects', 'overrides', 'deps', 'flow', 'history', 'log', 'search', 'audit', 'package_compatibility', 'source_packages', 'source_list', 'source_read'])
const inFlight = new Map()
const listeners = new Set()
let contentRevision = 0
export const subscribeContent = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export const getContentRevision = () => contentRevision

export function refreshContent() {
  // A read started before a disk update must not serve a refresh.
  inFlight.clear()
  contentRevision++
  for (const listener of listeners) listener()
}

import.meta.hot?.on('studio:content-changed', refreshContent)

export const loadCatalogs = () => Promise.all([call('games', {}), call('packages', {})])

export function call(tool, args) {
  if (!READS.has(tool)) return send(tool, args)
  const key = `${tool} ${JSON.stringify(args ?? {})}`
  if (!inFlight.has(key)) {
    const request = send(tool, args, 2).finally(() => {
      if (inFlight.get(key) === request) inFlight.delete(key)
    })
    inFlight.set(key, request)
  }
  return inFlight.get(key)
}

/** One call over the bridge; a read whose connection drops before an answer (the network, not the tool) is asked again. */
async function send(tool, args, retries = 0) {
  let res
  try {
    res = await fetch(`/studio/api/${tool}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })
  } catch (error) {
    if (retries > 0) return send(tool, args, retries - 1)
    throw error
  }
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? `${tool}: ${res.status}`)
  return tool === 'vocabulary' ? { ...body, vocabulary: browserVocabulary(body) } : body
}

/** The vocabulary the server checked against, rebuilt with its schemas: kernel modules plus declared object types. */
export function browserVocabulary({ packageCode, kindDeclarations, shapeDeclarations, capabilityDeclarations = {}, layerOrder }) {
  const layers = schemaLayers(layerOrder, { kind: kindDeclarations, shape: shapeDeclarations }, { resolved: true })
  for (const layer of layers) layer.capabilityDeclarations = capabilityDeclarations[layer.id]
  const projected = projectVocabulary({ ...vocabularyFor(), meanings: registeredMeanings(layerOrder) })
  return withKindDeclarations(withCapabilityDeclarations(projected, layers), layers, packageCode, { checked: true })
}
