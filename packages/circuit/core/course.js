import { layout } from 'kernel'
import { stagedDefinition } from './part-definition.js'
import { trayMembers } from './trays.js'

export function defineCourse({ levels, eras = null, plan: suppliedPlan = null, complete = true, trays = {}, tray: trayOf = () => null, primitives = [], adds = () => [], needs = () => null, builds = () => [], opens = () => [], gives = () => [], withholds = () => [], machine = () => null, uses = () => [], can = () => null, replaces = () => [], local = () => false, needed = () => null, featured = () => [], boards = () => [], carries = () => [], references = null, available = null, availableItems = null, parts = {}, awards = () => [] }) {
  const index = new Map(levels.map((l, i) => [l.id, i]))
  const setBy = new Map()
  for (const l of levels) for (const f of l.unlocks ?? []) if (!setBy.has(f)) setBy.set(f, l.id)
  /** The level that builds a part: the first to set the flag it needs. */
  const builder = (part) => (needs(part) ? setBy.get(needs(part)) ?? null : null)
  const plan = suppliedPlan ?? (eras ? layout(eras) : null)
  // Everything solved before a level can open: with eras, what it requires, all the way back; without, every level
  // before it in play order.
  const ancestors = new Map()
  const up = (id) => {
    if (ancestors.has(id)) return ancestors.get(id)
    const set = new Set()
    ancestors.set(id, set)
    if (plan) for (const r of plan.requires.get(id) ?? []) { set.add(r); up(r).forEach((x) => set.add(x)) }
    else levels.slice(0, index.get(id)).forEach((l) => set.add(l.id))
    return set
  }
  const tray = (level) => {
    const selection = trayOf(level)
    if (selection === null) return null
    const names = Array.isArray(selection) ? selection : [selection]
    for (const name of names) if (!Object.hasOwn(trays, name)) throw new Error(`level ${level.id} is played with the tray ${name}, which the game has not`)
    return names
  }
  const stages = new Map(Object.entries(parts).map(([part, definition]) => [part, { part, id: part, index: 0, definition }]))
  const course = { stages, partOf: id => id, startStages: primitives, awards, levels, eras, plan, complete, trays, tray,
    available, availableItems, primitives: new Set(primitives), adds, needs, builds, opens, gives, withholds, machine, uses, can,
    replaces, local, needed, featured, boards, carries, references, index, builder, before: (a, b) => up(b).has(a),
    registerParts(definitions) {
      for (const [part, definition] of Object.entries(definitions)) if (!parts[part]) {
        parts[part] = definition
        stages.set(part, { part, id: part, index: 0, definition })
      }
    },
  }
  course.availableParts = (level, _flags, includeUnlisted = false) => (includeUnlisted ? null : trayParts(course, level)) ?? Object.keys(parts)
  return course
}

/** The parts in the level's selected groups, without duplicates and in the requested order. */
export function trayParts(course, level) {
  const trays = course.tray(level)
  return trays === null ? null : [...new Set(trays.flatMap((name) => trayMembers(course.trays[name]).map(course.partOf)))]
}

export function fixedTray(course, level) {
  return trayParts(course, level) ?? course.fixedParts?.() ?? course.availableParts(level)
}

/** The parts the circuit can offer in this task, in tray order. */
export function usable(course, level, flags) {
  return course.availableParts(level, flags)
}

/** Resolve each usable part's definition and its available settings and inside boards. */
export function holds(course, level, flags) {
  const parts = new Set(usable(course, level, flags))
  const selected = course.selectedPart?.(level, flags) ?? (part => course.stages.get(part))
  const definition = (part, fallback) => stagedDefinition(selected(part), fallback)
  const has = (part, key, value) => {
    if (key === undefined) {
      const stage = course.stages.get(part)
      return stage && stage.part !== part ? parts.has(stage.part) && selected(stage.part)?.index >= stage.index : parts.has(part)
    }
    const setting = definition(part)?.setting[key]
    if (!setting || setting.fixed) return false
    return value === undefined || !setting.options || setting.options.some(option => String(option.value) === String(value))
  }
  has.definition = definition
  has.stage = (part) => selected(part)?.id ?? part
  has.inside = (part, form, options) => course.references?.resolve(part, form, course.available ? null : level, options) ?? null
  has.forms = (part) => definition(part)?.setting.form?.options?.map(option => option.value)
    ?? course.references?.forms(part, course.available ? null : level) ?? []
  return has
}

/** The reference and author-selected parts are shown first; other usable parts stay folded. */
export function offer(course, level, flags) {
  const all = usable(course, level, flags)
  const foreground = new Set([...(course.needed(level) ?? []), ...course.featured(level)])
  const shown = all.filter((part) => foreground.has(part))
  const folded = all.filter((part) => !foreground.has(part))
  return { shown, folded, types: [...shown, ...folded] }
}

/** Part and stage introductions on this route, without pedagogical grouping. */
export function fresh(course, level) {
  const items = at => [...course.adds(at), ...course.opens(at), ...course.awards(at)]
  const seen = new Set(course.levels.filter(at => course.before(at.id, level.id)).flatMap(items))
  if (level.task !== undefined) for (let task = 0; task < level.task; task++) {
    for (const item of items({ id: level.id, task })) seen.add(item)
  }
  return new Set(items(level).filter(item => !seen.has(item)))
}

/**
 * Where the primitives come in, for the components box and the map: for each key (keyOf(part), how the box lists
 * parts; one entry a part by default), the levels on the tree that bring in a part with that key while no level before
 * them has. A part that stays where it is brought (`local`) is no component to keep: it is left out. In play order.
 */
export function introductions(course, keyOf = (p) => p) {
  const out = new Map()
  const placed = (l) => !course.plan || course.plan.place.has(l.id)
  const keys = (l) => course.adds(l).filter((p) => course.primitives.has(p) && !course.local(p, l)).map(keyOf)
  for (const level of course.levels.filter(placed)) {
    const seen = new Set(course.levels.filter((l) => placed(l) && course.before(l.id, level.id)).flatMap(keys))
    for (const k of keys(level)) {
      if (seen.has(k)) continue
      if (!out.has(k)) out.set(k, [])
      if (!out.get(k).includes(level.id)) out.get(k).push(level.id)
    }
  }
  return out
}

/** Chapter starts and levels introducing parts or stages are drawn as milestones. */
// Whether a level is a milestone depends only on the course, so it is worked out once per course and level.
const cores = new WeakMap()
export function isCore(course, level) {
  let known = cores.get(course)
  if (!known) cores.set(course, known = new Map())
  if (!known.has(level.id)) known.set(level.id, milestone(course, level))
  return known.get(level.id)
}

function milestone(course, level) {
  const at = course.plan?.place.get(level.id)
  if (!at) return true
  const own = course.levels[course.index.get(level.id)]
  const era = course.eras.find((e) => e.id === at.era)
  return era.levels[0]?.id === level.id || (own.unlocks ?? []).length > 0 || fresh(course, own).size > 0
}


/** Parts encountered in this task's course, including parts outside the displayed tray. */
export const met = (course, at) => course.metParts?.(at) ?? usable(course, at)
export const reach = (course, at) => course.reachedParts?.(at) ?? usable(course, at)
