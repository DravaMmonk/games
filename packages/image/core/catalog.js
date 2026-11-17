import { createCapabilityRegistry, S } from 'kernel'
import { imageReports } from './baseline.js'
import { vocabulary } from './vocabulary.js'
import { levelSchema } from './level-schema.js'
import { SCENES } from './items/scenes/index.js'
import { BENCH_MODELS } from './items/benches.js'

export function extendVocabulary(base, contribution, first = false) {
  const registry = createCapabilityRegistry()
  registry.vocabulary(contribution.module, contribution)
  return {
    ...base,
    kinds: Object.fromEntries([...new Set([...Object.keys(base.kinds), ...Object.keys(registry.kinds)])].map(kind => [kind, first ? { ...registry.kinds[kind], ...base.kinds[kind] } : { ...base.kinds[kind], ...registry.kinds[kind] }])),
    capabilities: { ...base.capabilities, ...Object.fromEntries(Object.entries(registry.tables).map(([kind, items]) => [kind, { ...base.capabilities[kind], ...items }])) },
    languages: { ...base.languages, ...registry.languages },
  }
}

export const meaning = {
  type: 'level', read: value => value, baselineReports: imageReports,
  assemble({ registries, problems }) {
    const owners = new Map()
    for (const [level, value] of Object.entries(registries.level)) for (const view of value.opensViews ?? []) {
      if (owners.has(view) && owners.get(view) !== level) problems.push({ at: `levels/${level}.opensViews`, says: `${view} is already opened by ${owners.get(view)}` })
      else owners.set(view, level)
    }
  },
  vocabulary(base) {
    const projected = extendVocabulary(base, vocabulary, true)
    const fields = { ...base.level?.fields, ...levelSchema.fields }
    if (base.level) for (const key of Object.keys(levelSchema.fields).filter(key => key !== 'tasks')) {
      const previous = base.level.fields[key]
      if (!previous) fields[key] = S.opt(fields[key])
      else {
        const alternatives = S.either(previous, fields[key])
        fields[key] = previous.optional || fields[key].optional ? S.opt(alternatives) : alternatives
      }
    }
    const level = base.level ? S.obj({ ...fields, tasks: S.list(S.either(base.level.fields.tasks.of, levelSchema.fields.tasks.of), { min: 1 }) }) : levelSchema
    const gameFields = { ...base.game.fields }
    const ownGame = { box: S.opt(S.name('image/box')), power: S.opt(S.name('image/power')), mode: S.opt(S.oneOf(['notes'])) }
    for (const [key, schema] of Object.entries(ownGame)) gameFields[key] = gameFields[key] ? S.opt(S.either(gameFields[key], schema)) : schema
    return { ...projected, level, game: S.obj(gameFields) }
  },
}

export const imageItems = content => ({ scenes: { ...SCENES, ...content.imageItems?.scenes }, benches: { ...BENCH_MODELS, ...content.imageItems?.benches } })
