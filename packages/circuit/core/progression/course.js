import { defineCourse as defineCircuitCourse, trayMembers, trayParts } from '../index.js'
import { partStages } from './part-stages.js'

export const RULE_TEXT = {
  'not-built': 'offered, but no level builds it and it is not a primitive',
  'own-level': 'offered in the very level that builds it',
  'built-later': 'offered before the level that builds it',
  unplaced: 'in no era',
  'tray-unmet': 'on a tray, and no level brings it in or builds it',
  machine: 'played on a machine of a later era',
  mechanism: 'played on a machine that cannot do what its board uses',
  'carry-unseen': 'starts from the board of a level that is not among its prerequisites',
  'optional-built': 'a part built on an optional level used by a level that does not require that level',
  'upgrade-order': 'a level upgrading a part that does not require the level that built it before',
}

/** Install the progression policy on this content's circuit course. */
export function progressCourse(course, parts, authoredTrays = {}) {
  const { levels, primitives: starting, builds, awards, before: precedes } = course
  let { adds, opens } = course
  const primitives = [...starting]
  const stages = partStages(parts)
  const partOf = (id) => stages.get(id)?.part ?? id
  const isBase = (id) => partOf(id) === id
  const startStages = primitives
  const brought = adds, opened = opens
  const additions = new Map()
  adds = (level) => {
    const key = JSON.stringify([level.id, level.task])
    if (additions.has(key)) return additions.get(key)
    const earlier = new Set(levels.filter(entry => precedes(entry.id, level.id))
      .flatMap(entry => [...brought(entry), ...opened(entry), ...awards(entry), ...builds(entry)]).map(partOf))
    const stages = [...brought(level).filter(id => !isBase(id)), ...opened(level).filter(isBase)]
    const result = [...new Set([...brought(level).filter(isBase), ...stages.map(partOf).filter(part => !earlier.has(part))])]
    additions.set(key, result)
    return result
  }
  opens = (level) => [...opened(level), ...brought(level).filter(id => !isBase(id))]
  const register = course.registerParts
  Object.assign(course, {
    stages, partOf, startStages, adds, opens, primitives: new Set(primitives.map(partOf)),
    registerParts(definitions) {
      register(definitions)
      for (const [id, entry] of partStages(definitions)) if (!stages.has(id)) stages.set(id, entry)
    },
    availableParts(at, flags) {
      const held = usable(course, at, flags)
      const names = course.tray(at)
      if (course.available || names === null || names.some(name => authoredTrays[name]?.includeUnlisted)) return held
      const members = new Set(trayParts(course, at))
      return held.filter(part => members.has(part))
    },
    metParts: at => met(course, at),
    reachedParts: at => reach(course, at),
    selectedPart: (at, flags) => selectedPart(course, at, flags),
    fixedParts: () => [...new Set([...course.primitives, ...levels.flatMap(entry => course.builds(entry))])],
  })
  return course
}

export function defineCourse({ parts = {}, trays = {}, ...options }) {
  return progressCourse(defineCircuitCourse({ ...options, parts, trays }), parts, trays)
}

/**
 * Every part a level has met, by the rule every course follows: the parts it brings in, and every part brought in or
 * built at a level before it on the tree (every level this one comes after), unless a part met since replaces it (an
 * upgrade, or a merger) or it stays where it is brought (`local`). So a level's spec names only the parts it brings in
 * (`adds`); a part the player builds needs no naming at all. A task ({ id, task }) has also met what the tasks before
 * it in its level built. In order: the level's own parts, then the carried ones in the order they were met.
 */
export function met(course, level) {
  if (course.available) return course.available(level)
  const own = [...course.adds(level), ...builtBefore(course, level)]
  const external = [...(course.plan?.externalItems?.get(level.id) ?? [])].map(course.partOf)
  const earlier = [...external, ...course.levels.filter((l) => course.before(l.id, level.id)).flatMap((l) => [...course.adds(l), ...course.builds(l)].filter((p) => !course.local(p, l)))]
  const gone = new Set([...own, ...earlier].flatMap((p) => course.replaces(p)))
  const carried = earlier.filter((p) => !own.includes(p) && !gone.has(p))
  return [...new Set([...own, ...carried])]
}

/** All parts a level has met, ordered with members of its selected trays first. */
export function reach(course, level) {
  const all = met(course, level)
  const trays = trayParts(course, level)
  if (trays === null) return all
  const metSet = new Set(all)
  return [...new Set([...trays.filter((part) => metSet.has(part)), ...all])]
}

// The parts the tasks before a task have built in its level; and those its level builds that they have not: the task
// building a part does not hold it, even when an earlier level built it before (an upgrade works on the part's own
// board), unless the level brings the part in by name (a part of the engine's own, met and unlocked in one level).
const builtBefore = (course, level) => (level.task > 0 ? course.builds({ id: level.id, task: level.task - 1 }) : [])
const building = (course, level) => (level.task === undefined ? [] : course.builds({ id: level.id }).filter((p) => !builtBefore(course, level).includes(p) && !course.adds(level).includes(p)))

// Whether a player with `flags` has earned a part a level reaches: a primitive, and a built part once its builder
// level is solved (until the content is fixed, a part no level builds, or one the level builds itself: audit reports
// both). A part built on an optional level is held only by the levels that require that level.
function earned(course, level, flags, p) {
  if (course.primitives.has(p)) return true
  if (course.plan?.externalItems?.get(level.id)?.has(p)) return true
  const need = course.needs(p), by = course.builder(p)
  if (!need || !by || by === level.id) return true
  if (course.plan?.place.get(by)?.optional && !course.before(by, level.id)) return false
  return flags.has(need)
}

/**
 * The parts a level really holds for a player with `flags` (the unlocks of the levels solved): of everything it can
 * reach (or of `parts`, some it has met), those the player has earned, and those the level gives (`gives`: in their
 * place when it reaches them, after the rest when not), less those it withholds (`withholds`) and, of a task, those
 * its level builds that no task before it has built (and the level does not bring in itself).
 */
function usable(course, level, flags = new Set(), parts = reach(course, level)) {
  if (course.available) return parts
  const given = course.gives(level).map(course.partOf)
  const withheld = new Set([...course.withholds(level).filter(id => course.partOf(id) === id), ...building(course, level)])
  return [...new Set([...parts.filter((p) => given.includes(p) || earned(course, level, flags, p)), ...given])].filter((p) => !withheld.has(p))
}

function selectedPart(course, level, flags = new Set()) {
  const withheld = new Set(course.withholds(level))
  const prior = course.levels.filter(entry => course.before(entry.id, level.id))
  const progress = [...flags, ...course.startStages, ...course.opens(level), ...course.gives(level),
    ...prior.flatMap(entry => [...course.opens(entry), ...course.awards(entry)].filter(id => !course.local(id, entry))),
    ...course.awards(level), ...(course.plan?.externalItems?.get(level.id) ?? [])]
  return (part) => {
    const ids = course.availableItems ? course.availableItems(level) : progress
    const base = course.stages.get(part)
    let current = base
    for (const id of ids) {
      const stage = course.stages.get(id)
      if (stage?.part === part && !withheld.has(id) && (!current || stage.index > current.index)) current = stage
    }
    // Withholding an intermediate stage caps the linear progression before that stage.
    for (const id of withheld) {
      const cap = course.stages.get(id)
      if (cap?.part === part && current?.index >= cap.index) current = [...course.stages.values()].find(entry => entry.part === part && entry.index === cap.index - 1)
    }
    return current
  }
}

/** Every broken rule, as { rule, level, part, text }, in play order. */
export function audit(course) {
  const out = []
  const say = (rule, level, part, text) => out.push({ rule, level, part, text })
  const plan = course.plan
  const levels = course.levels
  const unbuilt = new Set()
  for (const level of levels) {
    for (const p of course.adds(level)) {
      const by = course.builder(p)
      if (course.primitives.has(p) || course.gives(level).includes(p)) continue
      if (!by) { if (!unbuilt.has(p)) say('not-built', level.id, p, 'no level builds it and it is not a primitive'); unbuilt.add(p) }
      else if (by === level.id) say('own-level', level.id, p, 'offered in the very level that builds it')
      // A part that stays where it is brought is brought again by name: that is no carry.
      else if (course.before(by, level.id)) continue
      else {
        const optional = plan?.place.get(by)?.optional
        say(optional ? 'optional-needed' : 'built-later', level.id, p, optional ? `needs ${by}, which sits on an optional branch it does not require` : `offered where ${by}, the level that builds it, need not be solved yet`)
      }
    }
    // A part built on an optional level is for the levels that require it alone: anyone else may not have it.
    for (const p of course.needed(level) ?? []) {
      const by = course.builder(p)
      if (by && by !== level.id && plan?.place.get(by)?.optional && !course.before(by, level.id)) say('optional-built', level.id, p, `built on the optional level ${by}, which this level does not require`)
    }
    // A level that builds a part built before (an upgrade) requires every level that built it before.
    for (const b of course.builds(level)) {
      const earlier = levels.filter((l) => l.id !== level.id && course.builds(l).includes(b) && !course.before(level.id, l.id))
      for (const l of earlier) if (!course.before(l.id, level.id)) say('upgrade-order', level.id, b, `builds ${b} as ${l.id} does, and does not require it`)
    }
  }
  trayRules(course, say)
  for (const level of levels) for (const from of course.carries(level)) if (!course.before(from, level.id)) say('carry-unseen', level.id, from)
  if (!plan) return out
  // The era rules.
  const placed = new Set(plan.order)
  for (const level of levels) if (!placed.has(level.id)) say('unplaced', level.id, '', 'in no era')
  const eraOf = new Map(course.eras.map((e, i) => [e.id, i]))
  const machines = course.eras.map((e) => e.machine ?? null)
  for (const level of levels) {
    const at = plan.place.get(level.id)
    if (!at) continue
    const m = course.machine(level), k = machines.indexOf(m)
    if (m && (k < 0 || k > eraOf.get(at.era))) say('machine', level.id, m, `played on ${m}, not a machine of era ${at.era} or before`)
    // The machine can do everything the level's board relies on.
    const can = m ? course.can(m) : null
    if (can) { const missing = course.uses(level).filter((x) => !can.includes(x)); if (missing.length) say('mechanism', level.id, missing.join(' '), `${m} cannot do what the board uses`) }
  }
  return out
}

/**
 * The audit's findings (audit, or a game's own) against the ones a game leaves open (game.json `open`, the work list in
 * its design doc: { rule: [{ part, level }] }): for every rule with any, { rule, fresh: found and not listed, left: found
 * and listed, gone: listed and met since }. npm run check fails on fresh and gone, and lists left.
 */
export function againstOpen(found, open = {}) {
  const rules = [...new Set([...found.map((f) => f.rule), ...Object.keys(open)])]
  const location = ({ part, level }) => `${part} (${level})`
  return rules.map((rule) => {
    const hits = [...new Set(found.filter((f) => f.rule === rule).map(location))]
    const listed = (open[rule] ?? []).map(location)
    return { rule, fresh: hits.filter((h) => !listed.includes(h)), left: hits.filter((h) => listed.includes(h)), gone: listed.filter((h) => !hits.includes(h)) }
  })
}

/** Tray entries describe real course parts, regardless of where players first meet those parts. */
function trayRules(course, say) {
  if (course.complete === false) return
  const met = new Set(course.levels.flatMap((level) => [...course.adds(level), ...course.builds(level)]))
  const stages = [...course.startStages, ...course.levels.flatMap(level => [...course.opens(level), ...course.awards(level)])]
    .map(id => course.stages.get(id)).filter(Boolean)
  for (const [name, entries] of Object.entries(course.trays)) for (const item of trayMembers(entries)) {
    const p = course.partOf(item)
    if (!met.has(p)) say('tray-unmet', '', p, `tray ${name} lists it, and no level brings it in or builds it`)
    const stage = course.stages.get(item)
    if (stage?.index > 0 && !stages.some(entry => entry.part === p && entry.index >= stage.index)) {
      say('tray-unmet', '', item, `tray ${name} lists this stage, and no level opens or awards it`)
    }
  }
}
