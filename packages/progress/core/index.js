import { completedTask } from 'kernel'

export { grantingFields } from './content-course.js'

export const levelMarks = { optional: 'progress/optional', skippable: 'progress/skippable' }
const type = 'progress/track'
const keyOf = (kind, target) => JSON.stringify([kind, target])

export const trackMeaning = {
  type,
  read: value => value,
  vocabulary: vocabulary => ({ ...vocabulary, levelMarks }),
  contentChecks({ content }) {
    const seen = new Set()
    const problems = []
    for (const [id, track] of Object.entries(content.registries?.[type] ?? {})) {
      const key = keyOf(track.kind, track.target)
      const at = `progress-tracks/${id}.json`
      if (seen.has(key)) problems.push({ at: `${at}.target`, says: `more than one track for ${track.kind} ${track.target}` })
      seen.add(key)
      const stages = new Set()
      for (const [index, stage] of (track.stages ?? []).entries()) {
        const path = `${at}.stages[${index}]`
        if (stages.has(stage.id)) problems.push({ at: `${path}.id`, says: `duplicate stage ${stage.id}` })
        stages.add(stage.id)
        if (stage.afterLevel && stage.afterTask) problems.push({ at: path, says: 'choose a level or a task for this stage' })
        if (index > 0 && !stage.afterLevel && !stage.afterTask) problems.push({ at: path, says: 'a later stage needs a level or task to pass' })
      }
    }
    return problems.map(({ at, says }) => ({ fail: true, text: `${at}: ${says}` }))
  },
}

/** Read the highest consecutively reached stage of any tracked object from the existing task save. */
export function objectProgress(content) {
  const tracks = new Map(Object.values(content.registries?.[type] ?? {}).map(track => [keyOf(track.kind, track.target), track]))
  const tasks = new Map(content.levels.flatMap(level => (level.tasks ?? []).map(task => [task.id, { level: level.id, optional: task.optional }])))
  return progress => {
    const solved = new Set(progress.solved)
    const reached = ({ afterLevel, afterTask }) => {
      if (progress.all) return true
      if (afterLevel) return solved.has(afterLevel)
      if (!afterTask) return true
      const task = tasks.get(afterTask)
      return Boolean(task && completedTask(progress, task.level, afterTask, task.optional))
    }
    const stage = (track) => {
      const stages = track.stages ?? []
      const locked = stages.findIndex(entry => !reached(entry))
      return locked < 0 ? stages.at(-1) : stages[locked - 1]
    }
    return {
      // Undefined is untracked; null is tracked but still locked.
      stage(kind, target) {
        const track = tracks.get(keyOf(kind, target))
        return track && (stage(track) ?? null)
      },
      reached: () => [...tracks.values()].flatMap(track => {
        const current = stage(track)
        return current ? [{ ...track, stage: current }] : []
      }),
    }
  }
}

export function register(kernel) {
  for (const name of Object.values(levelMarks)) kernel.tag(name, 'level')
  kernel.kind('progress/track', trackMeaning)
}
