import { registeredValueTypes } from 'kernel'

const scalar = (type) => ({ num: 'kernel/number', int: 'kernel/number', str: 'kernel/string', bool: 'kernel/boolean' })[type] ?? type
export const typeAlternatives = (type) => Array.isArray(type) ? type.flatMap(typeAlternatives) : [scalar(type)]

/** Union types accept every possible source value. Explicit any is the dynamic value type. */
export function acceptsType(expected, actual, types = registeredValueTypes) {
  const expand = (type) => typeAlternatives(type).flatMap((name) => types[name]?.accepts ?? [name])
  const targets = expand(expected)
  const sources = expand(actual)
  return targets.includes('kernel/any') || sources.includes('kernel/any') || sources.every((type) => targets.includes(type))
}
