import { sameJson } from 'kernel'
import { metasIn } from './schematic.js'

/** Presentation data for a single candidate, with indices in its current goal order. */
export function proofStateInfo(state) {
  const contexts = []
  const unknowns = new Set()
  for (const [goalIndex, { goal, hyps, fixes }] of state.goals.entries()) {
    for (const formula of [goal, ...hyps]) metasIn(formula, unknowns)
    let context = contexts.find(group => sameJson(group.fixes, fixes) && sameJson(group.hyps, hyps))
    if (!context) {
      context = { fixes, hyps, goalIndices: [] }
      contexts.push(context)
    }
    context.goalIndices.push(goalIndex)
  }
  return { defaultGoalIndex: state.goals.length ? 0 : null, unknowns: [...unknowns], contexts }
}

// Compare the rendered tree structure without reporting unchanged siblings as edits.
function formulaPaths(before, after, path = []) {
  if (sameJson(before, after)) return []
  if (!before || !after) return [path]
  const { a, b, body, args, ...head } = before
  const { a: nextA, b: nextB, body: nextBody, args: nextArgs, ...nextHead } = after
  if (!sameJson(head, nextHead) || args?.length !== nextArgs?.length) return [path]
  return [
    ...formulaPaths(a, nextA, [...path, 'a']),
    ...formulaPaths(b, nextB, [...path, 'b']),
    ...formulaPaths(body, nextBody, [...path, 'body']),
    ...(args ?? []).flatMap((arg, index) => formulaPaths(arg, nextArgs[index], [...path, 'args', index])),
  ]
}

/** Changed paths use output goal indices. Closed goals use input indices. */
export function proofStateDiff(before, after, { change, did } = {}) {
  const changed = []
  const added = []
  const closed = []
  const compare = (from, goalIndex) => {
    const old = before.goals[from]
    const current = after.goals[goalIndex]
    const matched = change?.goalIndex === goalIndex
    const paths = formulaPaths(old.goal, current.goal).map(path => ({ path }))
    const hyps = current.hyps.flatMap((hyp, index) => {
      if (sameJson(old.hyps[index], hyp) || !matched && old.hyps.some(formula => sameJson(formula, hyp))) return []
      return formulaPaths(old.hyps[index], hyp).map(path => ({ hyp: index, path }))
    })
    const locations = [...paths, ...hyps]
    if (matched) {
      const { hyp, path } = change
      const elsewhere = locations.filter(location => location.hyp !== hyp)
      locations.splice(0, locations.length, ...elsewhere, { ...(hyp !== undefined && { hyp }), path })
    }
    if (locations.length || !sameJson(old, current)) changed.push({ beforeGoalIndex: from, goalIndex, locations })
  }

  const count = after.goals.length - before.goals.length
  if (['rule', 'assumption', 'rw', 'rwHyps'].includes(did?.op)) {
    const target = did.goalIndex ?? 0
    for (const [index] of before.goals.entries()) {
      if (index === target && count < 0) closed.push(index)
      else compare(index, index > target ? index + count : index)
    }
    for (let i = 1; i <= count; i++) added.push(target + i)
  } else {
    let start = 0
    while (start < Math.min(before.goals.length, after.goals.length) && sameJson(before.goals[start], after.goals[start])) start++
    let end = before.goals.length
    while (end > start && end + count > start && sameJson(before.goals[end - 1], after.goals[end + count - 1])) end--
    const overlap = Math.min(end, end + count)
    for (let i = start; i < overlap; i++) compare(i, i)
    for (let i = overlap; i < end; i++) closed.push(i)
    for (let i = overlap; i < end + count; i++) added.push(i)
  }
  return { changed, added, closed }
}
