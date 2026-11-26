import { T } from 'kernel/words'
import { MISSING } from 'circuit'
import { instantiate } from './schematic.js'
import { resultsOf } from './tactics.js'
import { proofStateDiff, proofStateInfo } from './proof-state-info.js'

const route = Symbol('proof route')
const snapshot = ({ [route]: _route, more: _more, ...state }) => state
const keyOf = entry => JSON.stringify([entry.path, entry.id, entry.key])

/** The card publishes a value through normal evaluation without consuming a step. */
export function traceFlow(ctx, node, key = null) {
  ctx.trace?.push({ id: node.id, key, flow: true })
}

export function machineEvents(trace) {
  const flows = new Set()
  const events = []
  for (const entry of trace) {
    if (entry.flow) { flows.add(keyOf(entry)); continue }
    const flow = !entry.inner && !entry.proof && flows.delete(keyOf(entry))
    if (flow || entry.forwarding || entry.error === MISSING) entry.free = true
    events.push(entry)
  }
  return events
}

// Forwarded values participate in evaluation, but never advance or redraw the playback.
export const countMachineSteps = entries => entries.filter(entry => !entry.free)

/** Track candidate ancestry on the values that travel through the board. */
export function traceProof(input) {
  let next = 1
  return { input: { ...input, [route]: 0 }, nextId: () => next++ }
}

export function proofStep(ctx, node, from, state, did, extra) {
  const parent = from[route]
  if (parent === undefined || !ctx.trace || !ctx.proof) return state
  const id = ctx.proof.nextId()
  const rewriting = did?.op === 'rw' || did?.op === 'rwHyps'
  const book = rewriting ? ctx.rewrites : ctx.rules
  const direct = ctx.directCards?.get(node.type)
  const rules = (did?.rules ?? []).flatMap(key => {
    if (direct) return direct.entries.filter(entry => entry.key === key)
    return book?.[key] ? [{ key, book: rewriting ? 'rewrite' : 'rule', rule: book[key] }] : []
  })
  const value = { ...snapshot(state), did, didBy: did ? node.id : undefined }
  ctx.trace.push({ id: node.id, key: null, value, ...extra, proof: { id, parent }, proofRules: rules })
  return { ...state, [route]: id }
}

const SEARCH_STOP = {
  limit: T('搜索达到运行上限。'),
  depth: T('这条分支达到搜索深度上限。'),
  noProgress: T('这一步的目标没有比路径上已有的目标更容易证明。'),
  'unresolved-sentence-meta': { zh: '这条分支仍有未确定的整句，停止搜索。', en: 'This branch still has an unresolved sentence metavariable.' },
}

export function stopProof(ctx, value, reason) {
  if (ctx.proof && value[route] !== undefined) ctx.trace?.push({ proofStop: { id: value[route], reason } })
}

/** Use the same numbered entries for both views and keep the card's complete value for playback. */
export function finishProof(proof, trace, output, want, problem) {
  // Candidates can share immutable goals and contexts across many steps of one run.
  const serialized = new WeakMap()
  const json = value => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value)
    if (!serialized.has(value)) serialized.set(value, JSON.stringify(value))
    return serialized.get(value)
  }
  const equal = (left, right) => left === right || json(left) === json(right)
  const root = { id: 0, value: snapshot(proof.input), stateInfo: proofStateInfo(proof.input, equal) }
  const entries = []
  const nodes = new Map([[root.id, root]])
  const latest = new Map([[0, 0]])
  const pending = new Map()
  const add = (entry, step) => {
    const parent = nodes.get(step.parent)
    const { value } = entry
    entry.status ??= entry.error || value?.error ? 'error' : 'applied'
    if (value?.kind === 'state') {
      entry.stateInfo = proofStateInfo(value, equal)
      if (parent?.value?.kind === 'state') entry.diff = proofStateDiff(parent.value, value, { change: entry.change, did: value.did, equal })
      delete entry.change
    }
    if (value?.kind === 'state' && !value.goals.length && parent?.value?.goals.length) {
      const subst = formula => instantiate(formula, value.inst ?? {})
      step.closed = parent.value.goals.map(g => ({ ...g, goal: subst(g.goal), hyps: g.hyps.map(subst) }))
    } else if (value?.kind === 'state' && !value.goals.length && parent?.closed) {
      step.closed = parent.closed
    }
    nodes.set(step.id, { ...step, value })
    entry.proof = nodes.get(step.id)
    entries.push(entry)
  }
  for (const entry of trace) {
    if (entry.proofStop) {
      const { id, reason } = entry.proofStop
      const stopped = nodes.get(latest.get(id))
      if (stopped) {
        stopped.stopReasonKey = reason
        stopped.stopReason = SEARCH_STOP[reason]
      }
      continue
    }
    const key = keyOf(entry)
    if (entry.proof) {
      const { id, parent } = entry.proof
      add(entry, { id, parent: latest.get(parent) ?? 0 })
      latest.set(id, id)
      if (!entry.transient) pending.set(key, entry)
      continue
    }
    const last = pending.get(key)
    if (last && !entry.error) {
      last.playbackValue = entry.value
      pending.delete(key)
      continue
    }
    if (entry.free) continue
    const routeId = entry.value?.[route]
    const id = proof.nextId()
    add(entry, { id, parent: latest.get(routeId) ?? 0 })
    if (routeId !== undefined) latest.set(routeId, id)
  }
  const actual = output?.kind === 'state' ? resultsOf(output) : []
  const chosen = problem || want === 'logic/proved' ? actual.slice(0, 1) : actual
  if (problem) {
    const last = chosen.length ? nodes.get(latest.get(chosen[0][route])) : entries.at(-1)?.proof
    const unsuccessful = last ?? root
    unsuccessful.reason = problem
  } else {
    for (const value of chosen) {
      let step = nodes.get(latest.get(value[route])) ?? root
      while (step && !step.resultPath) {
        step.resultPath = true
        step = nodes.get(step.parent)
      }
    }
  }
  const nodeStatuses = new Map()
  const onPath = new Set()
  let step = actual.length ? nodes.get(latest.get(actual[0][route])) : entries.at(-1)?.proof
  while (step && step.id !== root.id) {
    onPath.add(step.id)
    step = nodes.get(step.parent)
  }
  for (const entry of entries) {
    if (!entry.path?.length && onPath.has(entry.proof.id)) nodeStatuses.set(entry.id, entry.status)
  }
  if (!actual.length) {
    for (const entry of trace) {
      if (entry.error && !entry.path?.length && entry.id !== 'out') nodeStatuses.set(entry.id, 'error')
    }
  }
  return { trace: entries, proofRoot: root, nodeStatuses }
}
