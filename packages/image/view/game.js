import { T as catalogText } from 'kernel/words'
import { createElement, useMemo } from 'react'
import WorkshopPlay from './WorkshopPlay.jsx'
import { circuitScreen } from 'circuit/view'
import { partDefinition } from 'circuit'
import { displays as ui } from './ui/displays.js'
// An image game on the shared shell (../../shell), from its content (games/design/README.md 6.3): the course (course.js)
// becomes the shell's game description, with the image domain's play resources, its
// parts box and its intro figures.
import { FlaskConical, Workflow } from 'lucide-react'
import { defineGame } from 'circuit/view'
import { levelLabels } from 'kernel/view'
import { isCore } from 'circuit'
import { imageWorks } from '../core/work.js'
import { playKinds } from 'kernel/view'
import { plays } from '../core/plays.js'
import { partsFor } from 'circuit/view'
import { imageBoards } from '../core/engine/board-view.js'
import { imagePreview } from './engine/preview.js'
import { descriptionOf } from '../core/words.js'
import { imagePartCatalog, shownUnlocks } from '../core/part-catalog.js'

export const playPresentation = {
  'image/graph': { icon: Workflow, label: catalogText("搭电路") },
  'image/board': { icon: FlaskConical, label: catalogText("机关台") },
  'image/probe': { icon: FlaskConical, label: catalogText("机关台") },
}

const { familyOf, iconOf } = ui['image/catalog']
/**
 * content (../../engine/content.js): { id, title, kicker, lede, power, eras, concept, replaces,
 * levels, glossary }.
 */
export default function imageGame(content, image = imageWorks(content), { kernel } = {}) {
  const parameters = ({ bench, model }) => ({ bench, model, displays: Promise.resolve(Object.fromEntries([...(kernel?.tables.display ?? [])].map(([name, value]) => [name, value.component ?? value]))) })
  const { CHAPTERS, LEVELS, course, kit } = image
  const { types } = kit
  const catalog = imagePartCatalog(image)
  const decorate = part => part.part ? { ...part, family: familyOf(part.part, types), icon: iconOf(part.part, types) } : part
  const boards = imageBoards(image)
  const cards = Object.fromEntries(Object.keys(types).map((type) => [type, {
    name: types[type].label, desc: descriptionOf(types, type), family: familyOf(type, types), icon: iconOf(type, types),
  }]))
  const levels = LEVELS.map((level) => ({ ...level, tasks: level.tasks.map((task) => ({ ...task, source: task })) }))
  const labels = levelLabels(content.eras)
  const game = defineGame({
    id: content.id,
    course,
    glossary: content.glossary,
    title: content.title,
    kicker: content.kicker,
    lede: content.lede,
    Hero: ui['image/hero'],
    power: content.registries['image/power'][content.power],
    chapters: CHAPTERS,
    levels,
    intro: (level) => image.intros[level.id],
    IntroFigure: (props) => ui['image/introduction']({ ...props, types }),
    kinds: playKinds(plays, { imageCircuit: ui['image/circuit'](image, cards), parameters, probe: ui['image/probe'] }, playPresentation, { circuit: circuitScreen, workshop: (play, prepare) => function Exercise(screen) { const resource = useMemo(() => prepare(screen.level.source, screen), [screen.level.source]); return createElement(WorkshopPlay, { screen, resource, play }) } }),
    unlocked: (level) => [...shownUnlocks(level).map(flag => decorate(catalog.unlockOf(flag))), ...course.awards({ id: level.id }).map(id => {
      const stage = course.stages.get(id)
      return { part: stage.part, label: stage.definition.name, icon: iconOf(stage.part, types) }
    })],
    core: (level) => isCore(course, level),
    levelLabel: (level) => labels.get(level.id) ?? level.id,
    parts: {
      all: catalog.parts.map(decorate),
      settings: (part, progress) => {
        const staged = game.textFor(part, progress)
        const stage = course.stages.get(staged.stage ?? part.part)
        const definition = stage && partDefinition(stage)
        return (definition?.settings ?? []).filter(setting => !setting.fixed).map(setting => ({
          key: setting.key, label: setting.label ?? setting.key,
          values: (setting.options ?? []).map(option => ({ value: option.value, label: option.label ?? option.value })),
        }))
      },
      preview: (part, { progress }) => {
        image.syncOwn(progress?.built)
        const made = imagePreview(image, content.registries['image/box'][content.box], part)
        return {
          sample: made && { ...made, parts: partsFor(made.task, boards.forTask(made.task), { cards, portLabels: {}, defined: game.defined }) },
          inside: boards.BUILT[part.part] && { course: boards, cards },
        }
      },
    },
    // A better circuit costs less, or as much with fewer parts.
  })
  game.circuit = boards
  game.image = image
  game.defined = { of: (type) => kit.defs[type] ?? null, defaults: kit.defaultParams, ops: kit.ops, widgets: { 'image/imageKernel': ui['image/imageKernel'] } }
  return game
}
