import { completedTask } from 'kernel'
import { grantScope, objectsOf, policyFor } from './policies.js'
import { stageChain } from './stages.js'

const keyOf = (kind, id) => JSON.stringify([kind, id])

/** Read stage and grant state from the existing level and task save. */
export function objectProgress(content, isOpen = (id, solved) => solved.has(id)) {
  const scope = grantScope(Object.entries(content.registries?.['progress/policy'] ?? {}))
  const possibleGrants = new Map()
  const grant = (items, ids, source) => {
    if (!ids?.length) return
    for (const kind of scope(source)) {
      const known = items.get(kind) ?? new Set()
      for (const id of ids) known.add(id)
      items.set(kind, known)
    }
  }
  for (const level of content.levels) for (const object of [level, ...(level.tasks ?? [])]) {
    for (const field of ['adds', 'opens', 'awards', 'gives']) grant(possibleGrants, object[field], level.id)
  }
  const tracked = new Map()
  for (const [kind, values] of Object.entries(objectsOf(content))) {
    for (const [target, value] of Object.entries(values)) {
      const policy = policyFor(content, kind, target)
      if (!policy.stages && !policy.grants) continue
      const chain = stageChain(target, policy.stages ? value : { ...value, stages: [] })
      const awarded = policy.grants && chain.some(stage => possibleGrants.get(kind)?.has(stage.id))
      if (awarded || chain.length > 1) tracked.set(keyOf(kind, target), {
        kind, target, title: value.title ?? value.name ?? target, policy, chain, awarded,
      })
    }
  }
  const tasks = new Map(content.levels.flatMap(level => (level.tasks ?? []).map(task => [task.id, { level: level.id, optional: task.optional }])))
  return (progress, at) => {
    const solved = new Set(progress.solved)
    const offered = new Map(), withheld = new Map(), awards = new Map(), introduced = new Map()
    const award = (ids, level) => {
      grant(offered, ids, level)
      grant(awards, ids, level)
    }
    const introduce = (ids, local, active, level) => {
      const visible = ids?.filter(id => !local.has(id))
      grant(offered, active ? ids : visible, level)
      grant(introduced, visible, level)
    }
    const completed = (level, task) => completedTask(progress, level.id, task.id, task.optional)
    for (const level of content.levels) {
      if (solved.has(level.id)) award(level.awards, level.id)
      const local = new Set(level.local ?? [])
      const reachable = at?.level === level.id || isOpen(level.id, solved)
      if (reachable) for (const field of ['adds', 'opens']) introduce(level[field], local, at?.level === level.id, level.id)
      if (at?.level === level.id) {
        grant(offered, level.gives, level.id)
        grant(withheld, level.withholds, level.id)
      }
      let next = reachable
      for (const task of level.tasks ?? []) {
        const passed = completed(level, task)
        if (passed) award(task.awards, level.id)
        if (next || passed || at?.task === task.id) {
          const taskLocal = new Set([...local, ...(task.local ?? [])])
          for (const field of ['adds', 'opens']) introduce(task[field], taskLocal, at?.task === task.id, level.id)
        }
        if (at?.task === task.id) {
          grant(offered, task.gives, level.id)
          grant(withheld, task.withholds, level.id)
        }
        next &&= passed || task.optional
      }
    }
    const reached = ({ afterLevel, afterTask }) => {
      if (afterLevel) return solved.has(afterLevel)
      const task = tasks.get(afterTask)
      return Boolean(task && completedTask(progress, task.level, afterTask, task.optional))
    }
    const stage = ({ kind, chain, awarded }) => {
      if (progress.all) return chain.at(-1)
      let current = awarded && offered.get(kind)?.has(chain[0].id) ? chain[0] : undefined
      for (const entry of chain.slice(1)) {
        if (entry.afterLevel || entry.afterTask) {
          if (!reached(entry)) break
          current = entry
        } else if (awarded ? offered.get(kind)?.has(entry.id) : !current && entry.index === 1) current = entry
      }
      const cap = chain.find(entry => withheld.get(kind)?.has(entry.id))
      return cap && current?.index >= cap.index ? chain[cap.index - 1] : current
    }
    const reachedObjects = () => [...tracked.values()].flatMap(track => {
      const current = stage(track)
      return current && track.policy.unlocks ? [{ kind: track.kind, target: track.target, title: track.title, stage: current }] : []
    })
    return {
      grants(kind) {
        return { awards: [...awards.get(kind) ?? []], introduced: [...introduced.get(kind) ?? []] }
      },
      stage(kind, target) {
        const track = tracked.get(keyOf(kind, target))
        return track && (stage(track) ?? null)
      },
      reached: reachedObjects,
    }
  }
}
