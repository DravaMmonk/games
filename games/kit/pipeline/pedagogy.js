// The pedagogy lint (games/design/README.md 4.1, 8): what a game's content shows of levels that teach nothing new. The
// checks see form, not meaning; they catch the shapes padding takes, and the review step reads for the rest.
//
//   pd-repeat-board   two levels' reference boards are the same board: the same puzzle twice
//   pd-slide          (report) a bench step with one knob open and the goal's readout on screen, judged live: turning
//                     it until the readout turns green passes, whether or not the player has understood anything
//   pd-quiz           (report) a task that only asks the player to pick an answer (a choice task): nothing is built,
//                     tried or worked out; what it asks belongs in the copy (intro, pass text), or in a task to do
//
//   pd-serial-chapter (report) a chapter has multiple main-path levels but no required parallel routes; review
//                     must justify the serial dependencies or identify independent required routes
//
// lintPedagogy(content, spec) → [{ rule, at, says, report? }]; spec is the domain's (its `blueprints`: every board the
// content writes, by level and task).

export const PEDAGOGY_RULES = {
  'pd-serial-chapter': 'a chapter has a wholly serial main path: review whether each serial dependency is necessary (report)',
  'pd-repeat-board': 'two levels have the same reference board: one of them repeats the other',
  'pd-slide': 'a bench step turns one knob with the goal read out live: it passes by sliding until green (report)',
  'pd-quiz': 'a task only asks to pick an answer: put what it asks in the copy, or make it something to do (report)',
}

const KERNEL_GOALS = '"goals"'

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

  // A task that is only a quiz.
  for (const level of content.levels) {
    for (const task of level.tasks) if (task.kind === 'choice') say('pd-quiz', `${level.id}${task.id && task.id !== level.id ? ` task ${task.id}` : ''}`, 'it only asks to pick an answer', true)
  }

  // A bench step of one knob with its goal read out on screen.
  for (const level of content.levels) {
    for (const task of level.tasks) {
      const bench = task.bench
      if (!bench?.knobs || bench.check === 'submit' || !JSON.stringify(bench.layout ?? {}).includes(KERNEL_GOALS)) continue
      for (const [k, stage] of (bench.stages ?? [null]).entries()) {
        const open = stage?.opens ?? Object.keys(bench.knobs).filter((n) => !bench.knobs[n].fixed)
        if (open.length === 1) say('pd-slide', `${level.id}${task.id && task.id !== level.id ? ` task ${task.id}` : ''}${stage ? ` step ${k + 1}` : ''}`, `only ${open[0]} turns, and the goal reads out live`, true)
      }
    }
  }
  return out
}
