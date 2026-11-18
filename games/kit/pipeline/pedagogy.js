// The pedagogy lint (games/design/README.md 4.1, 8): what a game's content shows of levels that teach nothing new. The
// checks see form, not meaning; they catch the shapes padding takes, and the review step reads for the rest.
//
//   pd-repeat-board   two levels' reference boards are the same board: the same puzzle twice
//
//   pd-serial-chapter (report) a chapter has multiple main-path levels but no required parallel routes; review
//                     must justify the serial dependencies or identify independent required routes
//
// lintPedagogy(content, spec) → [{ rule, at, says, report? }]; spec is the domain's (its `blueprints`: every board the
// content writes, by level and task).

export const PEDAGOGY_RULES = {
  'pd-serial-chapter': 'a chapter has a wholly serial main path: review whether each serial dependency is necessary (report)',
  'pd-repeat-board': 'two levels have the same reference board: one of them repeats the other',
}

export function lintPedagogy(content, spec) {
  const out = []
  const say = (rule, at, says, report = false) => out.push({ rule, at, says, ...(report ? { report: true } : {}) })

  // A chapter whose required levels each wait for the prior required level has no choice of order.
  for (const era of content.eras ?? []) {
    const main = era.levels.filter(({ optional }) => !optional).map(({ id }) => id)
    const ordered = main.length > 1 && main.slice(1).every((id, i) => spec.course.before(main[i], id))
    if (ordered) say('pd-serial-chapter', `era ${era.id}`, 'the main path is wholly serial; justify its concept/part dependencies or identify independent required routes', true)
  }

  // The same reference board in two levels.
  const boards = new Map()
  for (const b of spec.blueprints ?? []) {
    if (b.naive) continue
    const key = b.fingerprint()
    if (!key) continue
    const first = boards.get(key)
    if (first && first !== b.level) say('pd-repeat-board', b.level, `its reference board is the one ${first} already asks for`)
    else if (!first) boards.set(key, b.level)
  }

  return out
}
