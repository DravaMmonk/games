import { holds, partDefinition } from '../../core/index.js'

export function installStageViews(game) {
  const { course } = game
  if (!course) return
  const kind = 'circuit/part'
  const gatedParts = [...new Set([...course.stages.values()]
    .filter(stage => stage.afterLevel || stage.afterTask).map(stage => stage.part))]
  const gatedStages = objects => gatedParts.flatMap(part => {
    const stage = objects.stage(kind, part)
    return stage?.afterLevel || stage?.afterTask ? [stage.id] : []
  })
  const stageFlags = progress => {
    const objects = game.objectProgress(progress)
    return [...objects.grants(kind).awards, ...gatedStages(objects)].filter(id => course.stages.has(id))
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
        const objects = game.objectProgress(progress)
        const { awards, introduced } = objects.grants(kind)
        for (const id of [...awards, ...introduced, ...gatedStages(objects)]) consider(course.stages.get(id))
      }
      progressStages.set(progress, selected)
    }
    return stagedText(text, progressStages.get(progress).get(part) ?? course.stages.get(part))
  }
}
