import { L } from 'kernel/view'
import { goalKind, optimize } from '../core/index.js'

export function register(kernel) {
  kernel.game('optimization/results', (game, content) => {
    const objectives = optimize(content.registries?.[goalKind] ?? {})
    game.progress = {
      ...game.progress,
      recordResult(progress, task, result) {
        const best = progress.results?.[task] ?? {}
        const next = objectives.record(best, result)
        return next === best ? progress : { ...progress, results: { ...progress.results, [task]: next } }
      },
    }
    game.completionLabel = (progress, tasks) => {
      for (let at = tasks.length - 1; at >= 0; at -= 1) {
        const summary = objectives.summary(progress.results?.[tasks[at].key] ?? {})
        if (summary) return L(summary.label).replace(/\{([a-z][a-z0-9_]*)\}/g, (_, metric) => String(summary.values[metric]))
      }
    }
  })
}
