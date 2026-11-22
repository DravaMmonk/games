import { fresh } from '../course.js'
// Course advisories (games/design/README.md 5.2), registered with phase 'advisory': shapes of a course a human may
// want to look at again. Nothing here is a check; the Studio's background lane alone asks for them.
//
//   many-new    a level brings in more than one new part
//   idle-idea   a part comes in at a level whose reference work does not use it
//   unused      a part is built and no later reference work uses it
//   after-part  a pass text links a part (it may be retelling the answer)

const atsOf = level => (level.tasks?.length ? level.tasks.map((task, index) => ({ id: level.id, task: task.task ?? index })) : [{ id: level.id }])
const texts = value => (typeof value === 'string' ? [value] : Object.values(value ?? {}).filter(text => typeof text === 'string'))

export function courseAdvisories({ spec, content }) {
  const out = []
  const say = (rule, level, says) => out.push({ rule, level, says })
  for (const { course } of spec.specs ?? [spec]) {
    const used = new Map() // part → the places whose reference work uses it
    for (const level of course.levels) for (const at of atsOf(level)) for (const type of course.needed(at) ?? []) {
      const part = course.partOf(type)
      if (!used.has(part)) used.set(part, [])
      used.get(part).push(at)
    }
    for (const level of course.levels) {
      const ats = atsOf(level)
      const brought = [...new Set(ats.flatMap(at => [...fresh(course, at)]).map(course.partOf))].filter(part => !course.local(part))
      if (brought.length > 1) say('many-new', level.id, brought.join(', '))
      const needed = ats.map(at => course.needed(at)).filter(Boolean)
      const own = new Set(needed.flat().map(course.partOf))
      if (needed.length) for (const part of brought) if (!own.has(part)) say('idle-idea', level.id, part)
      for (const at of ats) for (const built of course.builds(at)) {
        const later = (used.get(course.partOf(built)) ?? []).some(place => (place.id === level.id ? (place.task ?? 0) > (at.task ?? 0) : course.before(level.id, place.id)))
        if (!later) say('unused', level.id, built)
      }
    }
  }
  for (const level of content.levels) {
    for (const [index, holder] of [level, ...level.tasks].entries()) {
      if (texts(holder.after).some(text => /<part-ref /.test(text))) say('after-part', level.id, index ? `tasks[${index - 1}].after` : 'after')
    }
  }
  return out
}
