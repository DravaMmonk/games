// All content layers are governed by the same declaration and override policy.
const packaged = { declares: 'package', overrides: { package: ['*'], game: ['$text'] } }
const game = { declares: 'game', overrides: { game: ['*'] } }
export const BUILTIN_POLICIES = {
  level: packaged, task: packaged, tag: { ...packaged, overrides: { ...packaged.overrides, game: ['values', '$text'] } }, relation: { ...packaged, variants: { requires: { overrides: { package: ['*'], game: ['edges', '$text'] } } } },
  shape: { declares: 'package', overrides: {} }, kind: packaged, i18n: { declares: 'package', overrides: { package: ['*'], game: ['*'] } }, chapter: game, game,
}
export const kindPolicy = (kind, schemas, value) => {
  const definition = schemas?.kindPolicies?.[kind] ?? schemas?.objectKinds?.[kind] ?? BUILTIN_POLICIES[kind] ?? packaged
  return { ...definition, ...definition.variants?.[value?.kind] }
}
export const declarationLayers = declares => Array.isArray(declares) ? declares : [declares]
export const declaresIn = (policy, scope) => declarationLayers(policy.declares).includes(scope)

const isTextField = field => field?.type === 'text' || field?.type === 'list' && field.of.type === 'text'
const layerType = layer => layer.startsWith('@') ? 'game' : 'package'

/** Return structured layer violations using the registered type's two policy properties. */
export function layerProblems(layer, kind, name, value, schema, schemas, override = false, before) {
  const policy = kindPolicy(kind, schemas, before ?? value)
  const type = layerType(layer)
  const at = `${layer}/${override ? 'overrides/' : ''}${kind}/${name}`
  if (!override) return declaresIn(policy, type) ? [] : [{ rule: 'layer', at, layer, kind, target: name, says: `${kind} may only be declared by ${declarationLayers(policy.declares).join(' or ')}` }]
  const allowed = policy.overrides?.[type] ?? []
  const walk = (value, schema, path = '') => Object.entries(value ?? {}).flatMap(([key, child]) => {
    const field = schema?.fields?.[key]
    const next = path ? `${path}.${key}` : key
    if (key === 'kind' && value.kind === before?.kind) return []
    if (allowed.includes('*') || allowed.includes(next) || allowed.includes('$text') && isTextField(field)) return []
    if (field?.type === 'obj') return walk(child, field, next)
    return [{ rule: 'layer', at: `${at}.${next}`, layer, kind, target: name, path: next, says: `${type} cannot override ${kind}.${next}` }]
  })
  return walk(value, schema)
}
