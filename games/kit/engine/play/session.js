// A blind session (games/DESIGN.md 6.6): one player playing one game from its first level, in course order, keeping
// its own progress like a save. Its record is data, part of the game's content: games/<game>/playtests/<session>.json,
// whose shape is PLAYTEST below. It holds everything the audit panel (./stats.js) reads, and the progress to go on from.
//
//   progress   the shell's save (../../shell/progress.js): solved levels, the boards the built parts run, tasks passed
//   levels     one outcome a level (or task) played: solved, gave up (the session's cap on attempts, or the player),
//              skipped (a play the harness does not cover; the level counts as passed so the course goes on, and a part
//              it builds runs its reference board, as for any level passed without a board)
//              a solved one keeps what the player says they worked out on it (`learned`)
//   attempts   every attempt in order: the text sent, whether it passed, what the game said
import { S, validate } from '../schema.js'

const OUTCOMES = ['solved', 'gave-up', 'skipped', 'open']

const OUTCOME = S.obj({
  level: S.str(),
  task: S.int({ min: 0 }),
  outcome: S.oneOf(OUTCOMES),
  required: S.bool({ about: { zh: '是否属于主路线。专题和挑战属于其他路线。', en: 'whether the level is on the main path (not a topic or a challenge)' } }),
  attempts: S.int({ min: 0 }),
  hints: S.int({ min: 0, about: { zh: '玩家主动请求的提示。', en: 'hints the player asked for' } }),
  usage: S.map(S.any(), { about: { zh: '由玩法提供的观察记录。', en: 'opaque observations supplied by the play' } }),
  seconds: S.opt(S.num({ about: { zh: '从第一次看到关卡到结果出现所花的时间。', en: 'from first seeing the level to its outcome' } })),
  why: S.opt(S.str({ about: { zh: '跳关原因。', en: 'why a level was skipped' } })),
  seen: S.opt(S.num({ about: { zh: '打开时记录首次看到关卡的时间，单位是 Unix 毫秒。', en: 'while open: when the level was first seen (ms since 1970)' } })),
  learned: S.opt(S.str({ about: { zh: '解出后由玩家用自己的话总结发现。', en: 'once solved: what the player says they worked out, in their own words' } })),
})

const ATTEMPT = S.obj({
  level: S.str(),
  task: S.int({ min: 0 }),
  at: S.str(),
  text: S.str(),
  pass: S.bool(),
  says: S.str({ about: { zh: '玩家实际读到的游戏反馈。', en: 'the feedback the game gave, as the player read it' } }),
})

/** The schema of a session's record. */
export const PLAYTEST = S.obj({
  game: S.str(),
  session: S.str(),
  player: S.obj({
    kind: S.oneOf(['llm', 'human', 'script']),
    model: S.opt(S.str()),
    note: S.opt(S.str()),
  }),
  lang: S.oneOf(['zh', 'en']),
  started: S.str(),
  limits: S.obj({ attempts: S.int({ min: 1, about: { zh: '达到此尝试次数时会话放弃该关。', en: 'attempts a level gets before the session gives it up' } }), levels: S.opt(S.int({ min: 1 })) }),
  usage: S.opt(S.obj({ tokens: S.opt(S.int()), seconds: S.opt(S.num()), cost: S.opt(S.num()) }, { about: { zh: '运行器有完整会话时附上。', en: 'the whole session, when the runner knows it' } })),
  progress: S.any({ about: { zh: '会话继续时所用的外壳存档。', en: 'the shell save the session goes on from' } }),
  levels: S.list(OUTCOME),
  attempts: S.list(ATTEMPT),
})

/** What is wrong with a record, [{ at, says }]. */
export const checkPlaytest = (record) => validate(PLAYTEST, record)

/** A new session's record. */
export function newSession({ game, session, player = { kind: 'llm' }, lang = 'en', attempts = 8, levels, progress, now = new Date() }) {
  return { game, session, player, lang, started: now.toISOString(), limits: { attempts, ...(levels ? { levels } : {}) }, progress, levels: [], attempts: [] }
}

/** The outcome entry of a level's task, made when first seen. */
export function outcomeOf(record, level, task, required, now = new Date()) {
  let entry = record.levels.find((e) => e.level === level && e.task === task)
  if (!entry) {
    entry = { level, task, outcome: 'open', required, attempts: 0, hints: 0, usage: {}, seen: now.getTime() }
    record.levels.push(entry)
  }
  return entry
}

/** Close an outcome, with the time it took. */
export function close(entry, outcome, now = new Date(), extra = {}) {
  Object.assign(entry, { outcome, ...extra })
  if (entry.seen !== undefined) entry.seconds = Math.round((now.getTime() - entry.seen) / 1000)
  delete entry.seen
}
