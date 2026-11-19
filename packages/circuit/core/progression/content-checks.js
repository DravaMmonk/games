import { holds } from '../course.js'
import { policyFor } from 'progress'
import { RULE_TEXT, againstOpen, audit } from './course.js'
import { referencePartCatalog } from '../part-catalog.js'

function unavailableParts(course, works, at, flags, checks) {
  const holding = holds(course, at, flags)
  const given = new Set(course.available ? course.gives(at).map(course.partOf) : [])
  return [...new Set(works.flatMap(work => (work?.nodes ?? []).map(node => node.type)))]
    .filter(type => course.stages.has(type) && checks(course.partOf(type), 'availability') && !holding(type) && !given.has(course.partOf(type)))
}
function referenceGrantChecks(spec, checks) {
  const lines = []
  const reported = new Set()
  for (const fragment of spec.specs ?? [spec]) {
    const course = fragment.course
    const works = fragment.logic ?? fragment.circuit ?? fragment.image ?? fragment.table
    for (const level of fragment.levels) {
      if (!level.tasks?.length) continue
      const flags = new Set(course.levels.filter(prior => course.before(prior.id, level.id)).flatMap(prior => prior.unlocks ?? []))
      const runtimeTasks = works?.LEVELS?.find(entry => entry.id === level.id)?.tasks
      for (const [index, task] of level.tasks.entries()) {
        const at = { id: level.id, task: task.task ?? index }
        for (const type of unavailableParts(course, [runtimeTasks?.[index] ?? task, ...course.boards(at)], at, flags, checks)) {
          const text = `${level.id}: circuit/part ${type} is unavailable to the reference work`
          if (reported.has(text)) continue
          reported.add(text)
          lines.push({ fail: true, level: level.id, text })
        }
      }
    }
  }
  return lines
}

export function courseChecks({ spec, content }) {
  const { checks } = policyFor(content, 'circuit/part')
  const eligible = (part, rule) => policyFor(content, 'circuit/part', part).checks.has(rule)
  const lines = checks.has('availability') ? referenceGrantChecks(spec, eligible) : []
  if (content.packageTarget || !checks.has('course')) return lines
  const fail = text => lines.push({ fail: true, text })
  // Trays are the package's: whether something on them is ever brought in is judged on a game placing the whole package.
  const whole = spec.levels.length >= content.levels.length
  const findings = [...audit(spec.course), ...(spec.audit?.() ?? [])].filter(f =>
    (whole || f.rule !== 'tray-unmet') && eligible(spec.course.partOf(f.part), 'course'))
  for (const { rule, fresh, left, gone } of againstOpen(findings, content.open ?? {})) {
    const text = RULE_TEXT[rule]
    if (!text) { fail(`game.json.open: ${rule} is no rule of the audit`); continue }
    if (fresh.length) fail(`course: ${text} (${fresh.length}): ${fresh.join('  ')}`)
    if (gone.length) fail(`course: left open in game.json, but met now (${rule}): drop ${gone.join('  ')}`)
    if (left.length) lines.push({ text: `OPEN course: ${text} (${left.length}, on the game's work list): ${left.join('  ')}` })
  }

  return lines
}

export function referenceChecks({ spec, content, levelLinks, opensBy }) {
  if (!policyFor(content, 'circuit/part').checks.has('references')) return []
  const lines = []
  const fail = text => lines.push({ fail: true, text })
  // A part likewise: linked in the level that earns it or one after (that level's own intro may name what it builds).
  const partsByKey = new Map(referencePartCatalog(spec).map((p) => [p.key, p]))
  const earnedAt = new Map()
  for (const [id, links] of levelLinks('part')) for (const key of links) {
    const part = partsByKey.get(key)
    if (!part || !policyFor(content, 'circuit/part', part.part ?? key).checks.has('references')) continue
    if (!earnedAt.has(key)) earnedAt.set(key, spec.levels.find(level => level.unlocks?.includes(key) || part.at?.includes(level.id))?.id)
    const earned = earnedAt.get(key)
    if (!opensBy(earned, id)) fail(`${id} links the part ${key}, earned later (at ${earned})`)
  }
  return lines
}
