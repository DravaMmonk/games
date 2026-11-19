import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { readContent, contentLayers } from '../../../games/kit/engine/resolver.js'
import { packageEntries } from '../../../games/kit/engine/plugin-node.js'
import { closeGames, loadModule } from '../../../games/kit/engine/games.mjs'
import { proofsRoot } from './fixture.js'

test('Studio restores the course progression policy after transferring content', async () => {
  const { root, id } = proofsRoot()
  try {
    const content = readContent(id, root)
    const entries = packageEntries(contentLayers(content), root)
    const loaders = Object.fromEntries(entries.map(({ id, core, view }) => [id, async () => ({
      core: core && await loadModule(core),
      view: view && await loadModule(view),
    })]))
    const { loadGame } = await loadModule(new URL('../../../games/kit/app/load-game.js', import.meta.url).pathname)
    const game = await loadGame(structuredClone(content), loaders)
    const level = game.byId[`${id}/apply`]
    const at = { id: level.id, task: 0 }

    assert.deepEqual(game.course.availableParts(at), [`${id}/mp`])
    const apply = game.parts.all.find(({ part }) => part === `${id}/mp`)
    const badges = game.mapBadges(level, { solved: new Set(), all: true })
    assert.deepEqual(badges.map(({ label, fresh }) => ({ label, fresh })), [{ label: apply.name, fresh: true }])
  } finally {
    await closeGames()
    rmSync(root, { recursive: true, force: true })
  }
})
