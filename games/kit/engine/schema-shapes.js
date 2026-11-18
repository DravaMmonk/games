// Named schemas expand once during assembly, so all content readers see the same fields and hints.
import { CODE_NAME } from './object-name.js'

export function mapSchemaChildren(schema, map) {
  const result = { ...schema }
  for (const key of ['fields', 'cases']) if (schema[key]) result[key] = Object.fromEntries(Object.entries(schema[key]).map(([name, child]) => [name, map(child)]))
  if (schema.of) result.of = Array.isArray(schema.of) ? schema.of.map(map) : map(schema.of)
  if (schema.key) result.key = map(schema.key)
  return result
}

export function usesNamedShapes(schema) {
  return Boolean(schema && (
    schema.type === 'shape' || schema.casesFrom ||
    Object.values(schema.fields ?? {}).some(usesNamedShapes) ||
    Object.values(schema.cases ?? {}).some(usesNamedShapes) ||
    (Array.isArray(schema.of) ? schema.of.some(usesNamedShapes) : usesNamedShapes(schema.of)) ||
    usesNamedShapes(schema.key)
  ))
}

export const schemaOwner = name => name.split('/')[0]

export function shapeCompiler(shapes, vocabulary, authorize = () => {}) {
  const resolved = new Map()
  const lookup = (name, active) => {
    if (active.includes(name)) throw new Error(`schema shape cycle: ${[...active, name].join(' → ')}`)
    if (!CODE_NAME.test(name) || !Object.hasOwn(shapes, name)) throw new Error(`undeclared schema shape ${name}`)
    if (!resolved.has(name)) resolved.set(name, compile(shapes[name], schemaOwner(name), null, [...active, name]))
    return resolved.get(name)
  }
  const compile = (source, owner, group = null, active = []) => {
    if (!source || typeof source.type !== 'string') throw new Error(`${owner}: invalid field schema`)
    if (source.type === 'shape') {
      const { name, type: _type, ...hints } = source
      authorize(owner, name)
      return { ...lookup(name, active), ...mapSchemaChildren(hints, child => compile(child, owner, group, active)) }
    }
    const { casesFrom, ...schema } = source
    if (casesFrom !== undefined) {
      if (source.type !== 'by' || source.cases || !vocabulary.kinds[casesFrom]) throw new Error(`invalid schema case source ${casesFrom}`)
      schema.cases = Object.fromEntries(Object.entries(vocabulary.kinds[casesFrom]).flatMap(([name, item]) => {
        const declarer = schemaOwner(name)
        if (group && declarer !== group) return []
        if (!item.shape || schemaOwner(item.shape) !== declarer) throw new Error(`${name}: ${casesFrom} needs its own case shape`)
        return [[name, lookup(item.shape, active)]]
      }))
      if (!Object.keys(schema.cases).length) throw new Error(`no schema cases from ${casesFrom}`)
      // Case shapes have already been compiled in the declaring package.
      const { cases, ...rest } = schema
      return { ...mapSchemaChildren(rest, child => compile(child, owner, group, active)), cases }
    }
    return mapSchemaChildren(schema, child => compile(child, owner, group, active))
  }
  return { compile, resolve: name => lookup(name, []) }
}
