import { taskOpen } from 'kernel/view'
import { holds, partDefinition } from '../../core/index.js'

export function installStageViews(game) {
  const { course, levels, isOpen } = game
  if (!course) return
  const awardedStages = new WeakMap()
  const stageFlags = progress => {
    if (!awardedStages.has(progress)) {
      const passed = new Set(progress.passed)
      const objects = game.objectProgress(progress)
      const stages = levels.flatMap(level => [
        ...(progress.solved.includes(level.id) ? course.awards(level) : []),
        ...(level.tasks ?? []).flatMap((task, index) => passed.has(task.key) ? course.awards({ id: level.id, task: index + 1 }) : []),
      ])
      for (const part of new Set([...course.stages.values()].filter(stage => stage.afterLevel || stage.afterTask).map(stage => stage.part))) {
        const stage = objects.stage('circuit/part', part)
        if (stage?.afterLevel || stage?.afterTask) stages.push(stage.id)
      }
      awardedStages.set(progress, [...new Set(stages)])
    }
    return awardedStages.get(progress)
  }
  const flagsOf = game.flagsOf
  game.flagsOf = progress => flagsOf({ ...progress, flags: [...(progress.flags ?? []), ...stageFlags(progress)] })
  const stageTexts = new WeakMap()
  const stagedText = (text, entry) => {
    if (!entry) return text
    if (stageTexts.get(text)?.has(entry.id)) return stageTexts.get(text).get(entry.id)
    const definition = partDefinition(entry)
    const result = { ...text, stage: entry.id, name: definition.name ?? text.name, desc: definition.desc ?? text.desc,
      forms: definition.setting.form?.options?.map(option => option.value) ?? text.forms }
    if (!stageTexts.has(text)) stageTexts.set(text, new Map())
    stageTexts.get(text).set(entry.id, result)
    return result
  }
  game.textAt = (text, id, part = text?.part) => {
    if (!course || !part) return text
    const has = holds(course, { id, task: 0 }, new Set())
    return stagedText(text, course.stages.get(has.stage(part)))
  }
  const progressStages = new WeakMap()
  game.textFor = (text, progress) => {
    const part = text?.part
    if (!course || !part) return text
    if (!progressStages.has(progress)) {
      const selected = new Map()
      const consider = entry => {
        if (entry && entry.index > (selected.get(entry.part)?.index ?? -1)) selected.set(entry.part, entry)
      }
      for (const id of course.startStages) consider(course.stages.get(id))
      if (progress.all) for (const entry of course.stages.values()) consider(entry)
      else {
        for (const id of stageFlags(progress)) {
          const entry = course.stages.get(id)
          if (entry?.afterLevel || entry?.afterTask) consider(entry)
        }
        const solved = new Set(progress.solved)
        const passed = new Set(progress.passed)
        for (const level of levels) {
          if (!isOpen(level, solved)) continue
          for (let task = 0; task < (level.tasks?.length ?? 1); task++) {
            const at = { id: level.id, task }
            if (taskOpen(game, progress, level.id, task)) for (const id of course.opens(at)) {
              if (!course.local(id, at)) consider(course.stages.get(id))
            }
            if (passed.has(level.tasks?.[task]?.key)) for (const id of course.awards({ id: level.id, task: task + 1 })) {
              if (!course.local(id, at)) consider(course.stages.get(id))
            }
          }
          if (solved.has(level.id)) for (const id of course.awards(level)) consider(course.stages.get(id))
        }
      }
      progressStages.set(progress, selected)
    }
    return stagedText(text, progressStages.get(progress).get(part) ?? course.stages.get(part))
  }
}
