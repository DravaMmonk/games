import declarationsSource from '../../capabilities/operation.json' with { type: 'json' }
// Keep the image operations, scoring and course unlocks. Studio owns the parts' data and expressions.
import { operationsOf } from 'circuit'
import { applyRules, defineParts, shows } from 'circuit'
import { NODE_TYPES } from './nodes.js'

import { readCopy } from 'kernel/words'

const declarations = readCopy(declarationsSource)

const native = Object.entries(NODE_TYPES).filter(([, spec]) => !spec.fixed)
const nativeForResource = new Map(native.flatMap(([type, spec]) => {
  const outputs = typeof spec.outputs === 'function' ? spec.outputs() : [null]
  return outputs.map((output) => [`${type}${output ? `-${output}` : ''}`, { type, spec }])
}))

/** One resource for each result of an existing image operation. */
export const IMAGE_OPS = Object.fromEntries(native.flatMap(([type, spec]) => {
  const settings = spec.params ?? []
  const outputs = typeof spec.outputs === 'function' ? spec.outputs() : [null]
  return outputs.map((output) => [
    `${type}${output ? `-${output}` : ''}`,
    {
      ...declarations.items[`${type.split('/').at(-1)}${output ? `-${output}` : ''}`],
      run(args, namedParams, ctx) {
        const input = Object.fromEntries(spec.inputs.flatMap((name, index) => args[index] == null ? [] : [[name, args[index]]]))
        const params = { ...namedParams }
        for (const { key, options } of settings) {
          params[key] = options?.find(([value]) => String(value) === params[key])?.[0] ?? params[key]
        }
        return spec.eval(input, params, ctx?.variant ?? null, output ?? undefined)
      },
    },
  ])
}))

const settingOf = (setting, old = {}) => {
  const { key, control, label, fixed, when, default: value, min, max, step, layout, options } = setting
  const originalOptions = new Map((old.options ?? []).map((option) => [String(option[0]), option]))
  const converted = options?.map((option) => {
    const prior = originalOptions.get(option.value)
    return [prior?.[0] ?? option.value, option.label ?? option.value, prior?.[2]]
  })
  const kind = control === 'custom' ? 'kernel' : control === 'buttons' ? 'select' : control
  return {
    key, label, fixed, when, kind, min, max, step, authored: setting,
    ...(converted && { options: converted }),
    ...(control === 'buttons' && { buttons: layout ?? 'row' }),
    default: converted?.find(([id]) => String(id) === String(value))?.[0] ?? value,
    ...(old.pi && { pi: true }),
    ...(old.learnable && { learnable: true }),
  }
}

export function imageDefinitions(file) {
  const defined = defineParts(file, IMAGE_OPS)
  // Image boards carry images through fixed ports. Other domains can share the same package catalog.
  const defs = Object.fromEntries(Object.entries(defined.defs).filter(([type]) => {
    const { inputs, inputTypes, outputType, outputTypes } = defined.PARTS[type]
    const outputs = Object.values(outputTypes)
    return Array.isArray(inputs) && Object.values(inputTypes).every(type => type === 'image/image' || type === 'kernel/any')
      && (outputs.length ? outputs.every(type => type === 'image/image') : outputType === 'image/image')
  }))
  const resources = new Map(Object.entries(defs).map(([type, def]) => {
    return [type, operationsOf(def)]
  }))
  const authoredTypes = new Set([...resources.values()].flat().map((resource) => nativeForResource.get(resource)?.type))
  const types = Object.fromEntries(Object.entries(NODE_TYPES).filter(([type, spec]) => spec.fixed || !authoredTypes.has(type)))
  for (const [type, def] of Object.entries(defs)) {
    if (types[type]?.fixed) continue
    const nativeSpec = nativeForResource.get(resources.get(type)[0])
    const nativeType = nativeSpec?.type
    const original = nativeSpec?.spec
    const part = defined.PARTS[type]
    const namespace = type.includes('/') ? type.slice(0, type.indexOf('/') + 1) : ''
    const flag = (value) => value && !value.includes('/') ? `${namespace}${value}` : value
    const params = def.settings.map((setting) => settingOf(
      { ...setting, default: part.defaults[setting.key] },
      original?.params?.find(({ key }) => key === setting.key),
    ))
    types[type] = {
      ...original,
      resource: nativeType,
      unlock: flag(original?.unlock),
      label: def.name,
      description: def.desc,
      inputs: part.inputs,
      inputTypes: part.inputTypes,
      outputType: part.outputType,
      outputTypes: part.outputTypes,
      inputLabels: Object.fromEntries(def.inputs.map((port) => [port.name, port.label ?? port.name])),
      outputLabels: Object.fromEntries((def.outputs ?? []).map((port) => [port.name, port.label ?? port.name])),
      outputs: part.outputs,
      params,
      definition: def,
      evaluate: part.eval,
      specialize: part.specialize,
      eval: (ins, params, variant, key) => part.eval(ins, { params }, { variant }, key ?? def.outputNames?.[0]),
    }
  }
  return {
    types, defs, ops: IMAGE_OPS,
    shows: (type, key, params) => !defs[type]?.setting[key] || shows(defs[type].setting[key], defs[type], params, IMAGE_OPS),
    applyRules: (type, params, changed) => defs[type] ? applyRules(defs[type], params, changed, IMAGE_OPS) : params,
  }
}
