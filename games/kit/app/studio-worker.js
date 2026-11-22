// Each Studio lane has its own package module cache. Closing through the message port lets ESM initialization finish.
import { parentPort } from 'node:worker_threads'
import { closeGames } from '../engine/games.mjs'

const { TOOLS } = await import('../engine/ops/tools.js')
const { advisoryTools } = await import('./studio-advisories.js')
const tools = { ...TOOLS, ...advisoryTools }
parentPort.on('message', async ({ id, name, args, close }) => {
  if (close) {
    await closeGames()
    parentPort.close()
    return
  }
  try {
    // Match the HTTP bridge's JSON boundary before crossing the worker's structured-clone boundary.
    const result = JSON.stringify(await tools[name].run(args))
    parentPort.postMessage({ id, result: result === undefined ? undefined : JSON.parse(result) })
  } catch (error) {
    parentPort.postMessage({ id, error: error.message })
  }
})
