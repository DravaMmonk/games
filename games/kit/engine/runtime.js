import { pluginRuntime } from './plugin-runtime.js'
import { contentRoots, contentSchemas } from './content.js'
// Server-side capability implementations are loaded only for checks and textual play.
import { vocabularyFor } from './kernel.js'
import { runtimeIds, taskModule, runtimeSpec } from './runtime-model.js'
export { runtimeIds, taskModule, runtimeWorks, runtimeSpec } from './runtime-model.js'

/** Resolve module runtimes using capability ownership. The vocabulary tables remain shared. */
export async function runtimeOf(content, root) {
  const { loadPlugins } = await import('./plugin-node.js')
  const { contentRoot } = await import('./resolver.js')
  root ??= contentRoots.get(content) ?? contentRoot()
  const plugins = await loadPlugins(content, root)
  return runtimeFromPlugins(content, plugins)
}

/** Use the game projection's kernel when its prepared tasks will enter the runtime. */
export function runtimeFromPlugins(content, plugins, excludedChecks) {
  const pluginIds = new Set([...plugins.tables.play.keys()].map(name => name.split('/')[0]))
  const vocabulary = contentSchemas.get(content) ?? vocabularyFor()
  const runtimes = runtimeIds(content).filter(id => pluginIds.has(id)).map(id => ({ id, runtime: pluginRuntime(id, plugins, vocabulary) }))
  const provided = id => [...plugins.tables.play].find(([name, play]) => name.startsWith(`${id}/`) && play.runtime)?.[1].runtime
  for (const entry of runtimes) if (provided(entry.id)) entry.runtime = provided(entry.id)
  if (!runtimes.length) runtimes.push({ id: 'kernel', runtime: pluginRuntime('kernel', plugins, vocabulary) })
  // A standalone level skips readers for other plays in its package. Those plays also keep their check ownership.
  const excludePackages = excludedChecks ?? runtimes.map(({ id }) => id)
  const complete = runtime => ({
    ...runtime,
    forContent: source => runtimeFromPlugins(source, plugins, excludePackages),
    checkPhase: context => plugins.checks(context),
    validate: async spec => [...await runtime.validate(spec), ...await plugins.checks({ content, levels: spec.levels, excludePackages })],
  })
  if (runtimes.length === 1) return complete({ ...runtimes[0].runtime, vocabulary })
  const byId = new Map(runtimes.map(({ id, runtime }) => [id, runtime]))
  const choose = (ctx) => byId.get(taskModule(ctx.level.source ?? ctx.level))
  const context = (ctx) => ({ ...ctx, game: ctx.game?.moduleGames?.[taskModule(ctx.level.source ?? ctx.level)] ?? ctx.game })
  return complete({
    vocabulary,
    names: (source) => {
      const names = {}
      for (const { runtime } of runtimes) for (const [kind, values] of Object.entries(runtime.names?.(source) ?? {})) {
        names[kind] = new Set([...(names[kind] ?? []), ...values])
      }
      return names
    },
    languages: Object.assign({}, ...runtimes.map(({ runtime }) => runtime.languages)),
    spec: (source) => runtimeSpec(source, runtimes),
    validate: async (spec) => (await Promise.all(runtimes.map(({ runtime }, index) => runtime.validate({ ...spec.specs[index], memo: spec.memo })))).flat(),
    play: {
      open: (ctx, options) => choose(ctx).play.open(context(ctx), options),
      attempt: (ctx, text) => choose(ctx).play.attempt(context(ctx), text),
    },
  })
}
