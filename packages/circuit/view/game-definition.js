import { describeObservation } from '../core/observation.js'
import { circuitSettings } from './settings.js'
import { composeCircuitModules } from './compose.js'
import { defineGame as defineShellGame, taskOpen } from 'kernel/view'
import { earnedUnlocks, circuitProgress, createProgress } from '../core/progress.js'
/**
 * Describe a game for GameShell. Required: id, title, kicker, lede ({ zh, en } pairs), chapters
 * ([{ id, title, track, label?, question?, number?, kicker? }], track: the chapter's level tree from kit/course.js
 * layout), levels ([{ id, chapter, title, kind, tasks: [{ key, kind?, step?, brief?, hint?, intro?, after?, carries?,
 * opens? … }], requires?, unlocks?, keeps?, after?, note? … }], in play order, every level one task or more;
 * `keeps`: whether passing a task keeps the board it passed with in progress.built, for a part that runs it, by default
 * when the level unlocks something) and kinds ({ [kind]: { Screen, icon?, label? } }).
 * Optional:
 *
 *   Hero          the map's illustration ({ theme })
 *   power         a first-run dialog { title, lines }
 *   intro(level)  a level's introduction pages [{ t, fig?, show? }]; IntroFigure draws a page's fig ({ fig, level,
 *                 theme }), the kit a value it shows (show: ../engine/views.js SHOW); a level's afterShow is the value
 *                 its pass text shows
 *   parts         the components box (元件箱) { all: [{ key, name, desc?, icon?, family?, at? }] (a built part's key is
 *                 the flag earning it; a primitive has `at`, the levels that bring it in, and is earned once one is open),
 *                 preview?(part, { progress }) → { sample?, experiment?, inside? } for the editor (../circuit/preview.jsx),
 *                 filters?(progress) → [{ key, name, icon?, lock?, keys }] to narrow the box, such as by robot }
 *   unlocked(level)  what passing a level awards [{ part?, label, icon?, family? }]
 *   extraParts   introduced parts used outside the components box, in its same record format
 *   passed(level)    more for the passed dialog, after the level's key idea: { label, lines } or null, such as the
 *                    rules a level declared
 *   core(level)   whether the map draws a level full size (a milestone: ../course.js isCore) or smaller
 *   note(level)   the level's key idea, shown when it is passed (default: level.note ?? level.after)
 *   glossary      the encyclopedia: { groups: [{ id, title }], entries: [{ id, group, title, body, at?, see? }] }
 *   levelLabel(level), isOpen(level, solved, all), better(score, best), bestLabel(best)
 *
 * Part descriptions and available forms follow the same named stages as the circuit cards.
 */
export function defineGame(def) {
  const game = defineShellGame(def)
  const { byId, isOpen } = game
  game.flagsOf = progress => [...new Set([...(progress.flags ?? []),
    ...progress.solved.flatMap(id => byId[id] ? earnedUnlocks(byId[id], progress) : [])])]
  // The primitives a level brings in, for the map.
  game.introduced = (level) => (def.parts?.all ?? []).filter((part) => part.at?.includes(level.id))
  game.isCircuitPart = (type) => Boolean(type && (game.course?.stages.has(type) || game.partDefs?.parts?.[type]))
  // A built part is earned by solving its level; a primitive when its introducing task becomes available.
  // With every level unlocked, the components box is full too (the encyclopedia opens every entry the same way).
  const earned = (progress, parts) => {
    if (progress.all) return parts.map((part) => part.key)
    const solved = new Set(progress.solved)
    const introduced = (part, id) => {
      const level = byId[id]
      if (!level || !isOpen(level, solved)) return false
      if (!part.atTasks) return true
      return level.tasks?.some((task, k) => part.atTasks.includes(task.key) && taskOpen(game, progress, id, k))
    }
    return [...game.flagsOf(progress), ...parts.filter((part) => part.at?.some((id) => introduced(part, id))).map((part) => part.key)]
  }
  const parts = [...(def.parts?.all ?? []), ...(def.extraParts ?? [])].filter(({ part }) => part)
  game.earnedParts = (progress) => {
    const keys = new Set(earned(progress, parts))
    return parts.filter(({ key }) => keys.has(key))
  }
  if (def.parts) {
    game.parts = { ...def.parts, earned: (progress) => earned(progress, def.parts.all) }
  }
  game.progress = circuitProgress(game)
  game.compose = defineGame
  game.openProgress = ({ content, tasks }) => {
    game.partDefs = content.partDefs
    return createProgress({ id: content.id, tasks, restoreBuilt: game.restoreBuilt })
  }
  game.describeObservation = describeObservation
  game.referenceName = (kind, id, lang) => {
    if (kind !== 'part') return null
    const name = game.parts?.all.find(part => part.key === id)?.name
    return (name && typeof name === 'object' ? name[lang] ?? name.zh ?? name.en : name) || null
  }
  game.settings = circuitSettings
  game.mapBadges = (level, { solved, all }) => {
    const first = { ...level, unlocks: (level.unlocks ?? []).filter(flag => !game.unlocksBefore(level).includes(flag)) }
    const accepts = ({ part }) => game.isCircuitPart(part)
    return [...game.introduced(level).filter(accepts).map(part => ({ label: part.name, fresh: true, open: all || game.isOpen(level, solved) })), ...game.unlocked(first).filter(accepts).map(part => ({ label: part.label, open: all || solved.has(level.id) }))]
  }
  game.composeModules = composeCircuitModules
  return game
}
