import { introductions } from 'circuit'
import { T } from './lang.js'
import { modelsOf } from './model/parts.js'

export function tablePartCatalog({ course, model, LEVELS, PARTS }) {
  // A merger's models are one card. Disambiguate other cards that have the same name.
  const cards = [...introductions(course, part => modelsOf(part)?.[0] ?? part)]
  const primitives = cards.map(([part, at]) => {
    const card = model.def(part)
    const models = modelsOf(part)
    const twin = !models && cards.some(([other]) => other !== part && String(model.def(other).name) === String(card.name))
    const name = twin ? T("{zh} · {zh2}", { zh: { zh: String(card.name.zh), en: String(card.name.en) }, zh2: { zh: String(card.tag.zh), en: String(card.tag.en) } }) : card.name
    const desc = models ? T("用所选模式把几个输入合并成一个值。") : card.desc
    return { key: `part:${part}`, part, name, desc, at }
  })
  const awards = new Set(LEVELS.map(level => level.unlock))
  const built = Object.entries(PARTS).filter(([key]) => awards.has(key))
    .map(([key, { name, desc }]) => ({ key, part: key, name, desc }))
  return { primitives, built }
}
