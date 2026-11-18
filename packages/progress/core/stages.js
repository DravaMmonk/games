import { fullName } from 'kernel'

const metadata = new Set(['id', 'afterLevel', 'afterTask'])
export const stageName = (target, id) => fullName(target.includes('/') ? target.split('/')[0] : '', id).replace(/^\//, '')

function merge(base, patch, replace, path) {
  const next = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    const field = [...path, key]
    if (value === null) delete next[key]
    else if (value && typeof value === 'object' && !Array.isArray(value) && !replace(field, value)) {
      next[key] = merge(base?.[key], value, replace, field)
    } else next[key] = value
  }
  return next
}

/** Apply only the declared object fields from a stage, leaving its prerequisites on the stage. */
export function stagePatch(base, stage, replace = () => false) {
  return merge(base, Object.fromEntries(Object.entries(stage).filter(([key]) => !metadata.has(key))), replace, [])
}

export function stageChain(target, raw, patch = stagePatch) {
  const { stages = [], ...base } = raw
  const chain = [{ target, id: target, index: 0, definition: base }]
  let definition = base
  for (const [index, stage] of stages.entries()) {
    definition = patch(definition, stage)
    chain.push({ ...stage, target, id: stageName(target, stage.id), index: index + 1, definition })
  }
  return chain
}

export function stageSchema(schema) {
  if (schema?.type === 'either') return { ...schema, of: schema.of.map(stageSchema) }
  if (schema?.type === 'by') return { ...schema, cases: Object.fromEntries(Object.entries(schema.cases).map(([name, branch]) => [name, stageSchema(branch)])) }
  if (schema?.type !== 'obj' || schema.fields.stages) return schema
  const fields = Object.fromEntries(Object.entries(schema.fields)
    .filter(([name]) => !['id', 'tasks'].includes(name))
    .map(([name, field]) => [name, { ...field, optional: true }]))
  return { ...schema, fields: { ...schema.fields, stages: { type: 'list', optional: true, of: { type: 'obj', fields: {
    ...fields,
    id: { type: 'str', pattern: '^(?:@?[a-z][a-z0-9-]*/)?[A-Za-z_][A-Za-z0-9_-]*$', stageId: true },
    afterLevel: { type: 'level', optional: true },
    afterTask: { type: 'task', optional: true },
  } } } } }
}
