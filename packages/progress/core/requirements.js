const list = items => Array.isArray(items) ? items : []
const refOf = level => `levels/${level}.json`

export function stageProviders(content, stages) {
  const levels = new Map(content.levels.map(level => [level.id, {
    level: level.id, task: list(level.tasks).length - 1, optional: false,
  }]))
  const tasks = new Map(content.levels.flatMap(level => list(level.tasks).map((task, index) => [task.id, {
    level: level.id, task: index, optional: Boolean(task.optional),
  }])))
  return stages.flatMap(({ item, afterLevel, afterTask }) => {
    const gate = afterLevel ? levels.get(afterLevel) : tasks.get(afterTask)
    return gate ? [{ item, ...gate }] : []
  })
}

function providersOf(content, { publications, introductions = false, extraProviders }) {
  const providers = new Map()
  const offer = (item, level, task, optional) => {
    if (!providers.has(item)) providers.set(item, [])
    providers.get(item).push({ level, task, optional })
  }
  for (const level of content.levels ?? []) {
    if (introductions) {
      for (const item of list(level.adds)) offer(item, level.id, -1, false)
      for (const item of list(level.awards)) offer(item, level.id, list(level.tasks).length - 1, false)
    }
    for (const item of list(level.opens)) offer(item, level.id, -1, false)
    for (const [index, task] of list(level.tasks).entries()) {
      if (!task) continue
      for (const item of list(task.awards)) offer(item, level.id, index, Boolean(task.optional))
      if (introductions) for (const item of list(task.adds)) offer(item, level.id, index - 1, Boolean(task.optional))
      // A task starts with its own options and publishes after it passes.
      for (const item of list(task.opens)) offer(item, level.id, index - 1, Boolean(task.optional))
      for (const item of publications?.(task) ?? []) offer(item, level.id, index, Boolean(task.optional))
    }
  }
  for (const { item, level, task, optional } of extraProviders ?? []) offer(item, level, task, optional)
  return providers
}

export function referenceDependencies({ content, links, placed, bindings, ancestors, layout }, { itemsOf, ...options }) {
  const eras = content.eras ?? [], levels = content.levels ?? []
  const original = links.length
  links = [...links]
  const problems = []
  const assumed = layout(eras, { links })
  const providers = providersOf(content, options)
  for (const level of levels) {
    if (!placed.has(level.id)) continue
    const required = ancestors(level.id, assumed.required)
    const tasks = Array.isArray(level.tasks) ? level.tasks : [level]
    for (const [index, task] of tasks.entries()) {
      const items = new Set(itemsOf(level, task))
      const gives = new Set([...list(task?.gives ?? level.gives), ...list(task?.opens)])
      for (const item of items) {
        if (gives.has(item)) continue
        const all = providers.get(item)
        if (!all?.length) continue
        const earlier = all.filter((provider) => provider.level !== level.id || provider.task < index)
        if (!earlier.length) {
          problems.push({ at: refOf(level.id), says: `the reference uses ${item} before any task in this level awards it` })
          continue
        }
        const choices = earlier.filter((provider) => !provider.optional)
        if (!choices.length) {
          problems.push({ at: refOf(level.id), says: `the reference uses ${item}, whose provider can be skipped` })
          continue
        }
        if (choices.some((provider) => provider.level === level.id || required.has(provider.level))) continue
        const by = [...new Set(choices.map(({ level }) => level))]
        const bound = by.filter((id) => bindings.get(level.id)?.has(id))
        if (bound.length === 1) continue
        const detail = `${task.id ?? level.id}: ${item}`
        if (by.length > 1) {
          problems.push({ at: refOf(level.id), says: `the reference uses ${item}; choose a prerequisite that supplies it (${by.join(', ')})` })
          continue
        }
        const [from] = by
        if (!placed.has(from)) {
          problems.push({ at: refOf(level.id), says: `the reference uses ${item}; place its provider ${from} or bind it to the game that supplies it` })
          continue
        }
        links.push({ from, to: level.id, required: true, source: 'reference', detail })
        required.add(from)
        for (const id of ancestors(from, assumed.required)) required.add(id)
      }
    }
  }
  return { links: links.slice(original), problems }
}

export function externalSupplies({ content, plan, external, ancestors }, publications) {
  // A cross-game prerequisite can supply awards from a shared package.
  const issued = new Map()
  const after = (level, item) => {
    const awards = issued.get(level) ?? new Set()
    awards.add(item)
    issued.set(level, awards)
  }
  if (external.size) {
    for (const [item, providers] of providersOf(content, { publications })) for (const { level, optional } of providers) if (!optional) after(level, item)
    for (const level of content.levels ?? []) for (const item of list(level.adds)) after(level.id, item)
  }
  const externalItems = new Map([...plan.place.keys()].map((level) => [level, new Set(
    external.size ? [level, ...ancestors(level, plan.required)].flatMap((id) => (external.get(id) ?? [])
      .flatMap(({ level: source }) => [...(issued.get(source) ?? [])])) : []
  )]))
  return { externalItems, externalAwardSources: issued }
}
