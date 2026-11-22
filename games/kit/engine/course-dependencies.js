// The authored, knowledge and reference edges used to open a course. Only authored links live in the course file.
import { dependencyCycle, eraLevels, layout } from '../course.js'
import { contentSchemas } from './content.js'
import { meaningsOf } from './kind-meanings.js'
import { standalonePlan } from './package-play.js'

const idOf = (game, level) => `${game}:${level}`
const refOf = (level) => `levels/${level}.json`
const reason = (source, detail) => `${source} (${detail})`
const list = (items) => Array.isArray(items) ? items : []

function ancestors(id, edges) {
  const seen = new Set()
  const visit = (node) => {
    for (const from of edges.get(node) ?? []) if (!seen.has(from)) {
      seen.add(from)
      visit(from)
    }
  }
  visit(id)
  return seen
}

/** Resolve this course's links without mutating its file-backed content. */
export function courseDependencies(content) {
  const { eras = [], levels = [] } = content
  const links = eras.flatMap((era) => (era.links ?? []).map((link) => ({ ...link, source: 'course', detail: String(era.id) })))
  if (content.packageTarget) return { links, problems: [] }
  const placed = new Set(eras.flatMap(eraLevels))
  const problems = []
  const bindings = new Map()
  for (const { fromGame, from, to } of links) if (fromGame) {
    if (!bindings.has(to)) bindings.set(to, new Map())
    bindings.get(to).set(from, fromGame)
  }
  for (const { id, requires } of levels) if (placed.has(id)) for (const from of list(requires)) {
    const fromGame = bindings.get(id)?.get(from)
    if (fromGame || placed.has(from)) links.push({ from, to: id, ...(fromGame && { fromGame }), required: true, source: 'knowledge', detail: refOf(id) })
    else problems.push({ at: `${refOf(id)}.requires`, says: `place the prerequisite ${from} or bind it to the game that teaches it` })
  }
  for (const meaning of meaningsOf(contentSchemas.get(content))) {
    const extra = meaning.dependencies?.({ content, links, placed, bindings, ancestors, layout })
    if (extra) { links.push(...extra.links); problems.push(...extra.problems) }
  }
  return { links, problems }
}

/** Build the same local plan the domains use, with cross-game gates kept outside the local course topology. */
export function courseLayout(content) {
  if (content.coursePlan) return content.coursePlan
  if (content.standalone) return standalonePlan(content)
  const { links, problems } = courseDependencies(content)
  const plan = layout(content.eras ?? [], { links })
  const external = new Map()
  const bind = (to, game, level) => {
    const gates = external.get(to) ?? []
    if (!gates.some((gate) => gate.game === game && gate.level === level)) external.set(to, [...gates, { game, level }])
  }
  const bypass = new Map()
  for (const { fromGame, from, to, required } of links) {
    if (fromGame) bind(to, fromGame, from)
    else if (!required && plan.place.get(from)?.skippable && !plan.required.get(to)?.includes(from)) {
      if (!bypass.has(to)) bypass.set(to, new Set())
      bypass.get(to).add(from)
    }
  }
  for (const id of plan.order) for (const skipped of bypass.get(id) ?? []) {
    for (const { game, level } of external.get(skipped) ?? []) bind(id, game, level)
  }
  const planExtensions = Object.assign({}, ...meaningsOf(contentSchemas.get(content)).map(meaning => meaning.plan?.({ content, plan, external, ancestors })))
  return { ...plan, dependencyLinks: links, problems, external, ...planExtensions }
}

/** Find local route links that another incoming route already guarantees. */
export function coursePrerequisiteWarnings(content) {
  const { dependencyLinks = [], place, requires, required } = courseLayout(content)
  const inherited = new Map()
  const before = (id) => {
    if (!inherited.has(id)) inherited.set(id, ancestors(id, required))
    return inherited.get(id)
  }
  const warnings = []
  const reported = new Set()
  for (const { from, to, fromGame, source } of dependencyLinks) {
    if (source !== 'course' || fromGame || !place.has(from) || !place.has(to)) continue
    const via = requires.get(to).find(other => other !== from && before(other).has(from))
    if (!via) continue
    const key = JSON.stringify([from, to])
    if (reported.has(key)) continue
    reported.add(key)
    warnings.push({
      warn: true, rule: 'redundant-prerequisite', level: to,
      text: `${to}: the direct prerequisite ${from} is redundant because ${via} already requires it`,
    })
  }
  return warnings
}

/** Validate a resolved collection containing the pending course in place of its saved version. */
export function projectDependencyProblems(contents, packages = new Map()) {
  const plans = new Map(contents.map((content) => [content.id, courseLayout(content)]))
  const graph = new Map()
  const provenance = new Map()
  const problems = []
  for (const [game, plan] of plans) {
    for (const id of plan.place.keys()) graph.set(idOf(game, id), [])
  }
  for (const [game, plan] of plans) {
    for (const [to, fromIds] of plan.required) graph.get(idOf(game, to)).push(...fromIds.map((from) => idOf(game, from)))
    for (const [to, gates] of plan.external) for (const gate of gates) {
      const from = idOf(gate.game, gate.level)
      const into = idOf(game, to)
      if (gate.game === game) problems.push({ at: into, says: 'a cross-game link must use a different game; use a local link here' })
      else if (!graph.has(from)) problems.push({ at: into, says: `the cross-game prerequisite ${from} is not on its game's course` })
      else if (packages.has(game) && packages.has(gate.game) && packages.get(game) !== packages.get(gate.game)
        && (plan.dependencyLinks.some(({ source, fromGame, from, to: target }) => source === 'knowledge' && target === to && fromGame === gate.game && from === gate.level)
          || meaningsOf(contentSchemas.get(contents.find(content => content.id === game))).some(meaning => meaning.supplies?.({ plan, level: gate.level })))) problems.push({
        at: into,
        says: `${from} is in another content package and cannot supply this level's package prerequisites or awards`,
      })
      else if (graph.has(into)) graph.get(into).push(from)
    }
    for (const { fromGame, from, to, source, detail } of plan.dependencyLinks) {
      provenance.set(`${idOf(game, to)}>${idOf(fromGame ?? game, from)}`, reason(source, detail))
    }
  }
  const cycle = dependencyCycle(graph)
  if (cycle) problems.push({
    at: 'courses',
    says: `circular prerequisites: ${cycle.map((at, i) => i + 1 < cycle.length
      ? `${at} [${provenance.get(`${at}>${cycle[i + 1]}`) ?? 'required prerequisite'}]` : at).join(' → ')}`,
  })
  return problems
}
