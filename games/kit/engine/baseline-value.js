import { createHash } from 'node:crypto'

// Stable, lossless projections of runtime data; arrays retain execution order.
export function baselineValue(input) {
  const memo = new WeakMap(), hashes = new WeakMap(), pool = new Map()
  // Search traces copy growing states. Intern equal subtrees so complete reports stay practical.
  const intern = value => {
    if (!value || typeof value !== 'object' || hashes.has(value)) return value
    const entries = Object.entries(value).map(([key, v]) => [key, intern(v)])
    const token = v => v && typeof v === 'object' ? { hash: hashes.get(v) } : v
    const hash = createHash('sha256').update(JSON.stringify([Array.isArray(value), entries.map(([key, v]) => [key, token(v)])])).digest('hex')
    if (pool.has(hash)) return pool.get(hash)
    const out = Array.isArray(value) ? entries.map(([, v]) => v) : Object.fromEntries(entries)
    hashes.set(out, hash)
    pool.set(hash, out)
    return out
  }
  const project = (value, ancestors = new Set()) => {
    if (value === undefined) return { $undefined: true }
    if (typeof value === 'number' && !Number.isFinite(value)) return { $number: String(value) }
    if (Object.is(value, -0)) return { $number: '-0' }
    if (typeof value === 'symbol') return { $symbol: value.description }
    if (typeof value === 'function') return { $function: true }
    if (value === null || typeof value !== 'object') return value
    if (ancestors.has(value)) throw new Error('cyclic baseline data: select a data projection')
    if (memo.has(value)) return memo.get(value)
    const next = new Set([...ancestors, value])
    const visit = v => project(v, next)
    const keep = result => { const out = intern(result); memo.set(value, out); return out }
    if (value instanceof Map) return keep({ $map: [...value].map(([k, v]) => [visit(k), visit(v)]).sort((a, b) => JSON.stringify(a[0]).localeCompare(JSON.stringify(b[0]), 'en')) })
    if (value instanceof Set) return keep({ $set: [...value].map(visit).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en')) })
    if (ArrayBuffer.isView(value)) return keep(Array.from(value, visit))
    if (Array.isArray(value)) return keep(value.map(visit))
    if (value.constructor?.name === 'Lazy') return String(value)
    return keep(Object.fromEntries(Object.keys(value).sort().map(key => [key, visit(value[key])])))
  }
  return project(input)
}

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function movedSymbolBaseline(input, move) {
  if (!move) return input
  const { owner, names, edgeTarget, edgeSources, fromField, toField } = move
  const prefix = new RegExp(`^${escape(owner)}/`)
  const local = name => typeof name === 'string' ? name.replace(prefix, '') : name
  const mixedEdge = edge => local(edge?.to) === edgeTarget && edgeSources.includes(local(edge?.from)) && (edge.of === 'grant' || edge.of === undefined)
  const formulaName = name => names.includes(local(name))
  const member = names.map(escape).join('|')
  const formulaCopy = new RegExp(`(?<![\\w/])((?:${escape(owner)}/)?)part\\.(${member})(?=\\.)`, 'g')
  const formulaFile = new RegExp(`(?<![\\w/])((?:packages/${escape(owner)}/|${escape(owner)}/)?)parts/(${member})(?=\\.json\\b)`, 'g')
  const memo = new WeakMap()
  const walk = (value, identity = null) => {
    if (typeof value === 'string') return value.replace(formulaCopy, '$1symbol.$2').replace(formulaFile, '$1symbols/$2')
    if (!value || typeof value !== 'object') return value
    if (memo.has(value)) return memo.get(value)
    if (Array.isArray(value)) {
      const identityOwner = formulaName(value[0]) ? value[0] : identity
      let out = value.map(child => walk(child, identityOwner))
      // Ownership changes the typed order edges for these names. Preserve every unrelated edge's order.
      if (value.some(edge => edge && typeof edge === 'object' && ['part', 'symbol', 'grant'].includes(edge.of) && (formulaName(edge.from) || formulaName(edge.to)))) {
        const affected = edge => ['part', 'symbol', 'grant'].includes(edge?.of) && (formulaName(edge?.from) || formulaName(edge?.to))
        out = [...out.filter(edge => !affected(edge)), ...out.filter(affected).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'))]
      }
      memo.set(value, out)
      return out
    }
    const identityOwner = formulaName(value.part) ? value.part : formulaName(value.type) ? value.type : identity
    const out = Object.fromEntries(Object.entries(value).filter(([key, child]) => !(formulaName(identityOwner) && key === 'editor' && child === 'strip'))
      .map(([key, child]) => [key, walk(child, formulaName(key) ? key : identityOwner)]))
    if (out[fromField] && Object.keys(out[fromField]).length && Object.values(out[fromField]).every(symbol => formulaName(symbol.type))) {
      out[toField] = out[fromField]
      delete out[fromField]
    }
    if ((formulaName(out.from) || formulaName(out.to)) && ['symbol', 'grant'].includes(out.of)) out.of = 'part'
    // Move only the declared definitions into the canonical symbol inventory on either side.
    if (out.structure?.parts?.parts) {
      const parts = { ...out.structure.parts.parts }
      const symbols = { ...out.structure.symbols }
      for (const [name, definition] of Object.entries(parts)) if (formulaName(name)) {
        if (Object.hasOwn(symbols, name)) throw new Error(`baseline symbol collision: ${name}`)
        symbols[name] = definition
        delete parts[name]
      }
      out.structure = { ...out.structure, parts: { ...out.structure.parts, parts }, ...(Object.keys(symbols).length && { symbols }) }
    }
    memo.set(value, out)
    return out
  }
  // Normalize the declared cross-type grant edges.
  const order = input?.structure?.relations?.order
  if (Array.isArray(order)) input = { ...input, structure: { ...input.structure, relations: { ...input.structure.relations, order: order.map(edge => mixedEdge(edge) ? { ...edge, of: 'part' } : edge) } } }
  return walk(input)
}

/** Only registered names are aliases; prose, formulas and arbitrary slashes stay meaningful. */
export function nameNormalizer(names, { replacements = [], inventory = [], stripPrefixes = [], symbolMove } = {}) {
  const rules = replacements.map(({ pattern, flags, replacement }) => [new RegExp(pattern, flags), replacement])
  const kindNames = text => rules.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), text)
  names = [...new Set([...names, ...inventory.map(name => kindNames(name.replace(/^[^:]+:(@?[a-z][a-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_-]*)$/, '$1')))])]
  const prefix = stripPrefixes.length ? new RegExp(`^(?:${stripPrefixes.map(escape).join('|')})-`) : /$^/
  const local = name => kindNames(name).replace(/^@?[^/:]+[/:]/, '').replace(prefix, '')
  const aliases = new Map()
  for (const name of names) {
    const short = local(name)
    const group = aliases.get(short) ?? new Set()
    group.add(name)
    aliases.set(short, group)
  }
  // Ambiguous local names keep their qualified identity; never merge two independent objects.
  const pairs = [...new Set(names)].filter(name => local(name) !== name && aliases.get(local(name)).size === 1).sort((a, b) => b.length - a.length || a.localeCompare(b, 'en'))
  const pattern = pairs.length ? new RegExp(`(?<![\\w/-])(${pairs.map(escape).join('|')})(?![\\w-])`, 'g') : null
  const normalize = text => {
    const named = kindNames(text)
    return pattern ? named.replace(pattern, name => local(name)) : named
  }
  return input => {
    const memo = new WeakMap()
    const walk = value => {
      if (typeof value === 'string') return normalize(value)
      if (!value || typeof value !== 'object') return value
      if (memo.has(value)) return memo.get(value)
      if (Array.isArray(value)) { const out = value.map(walk); memo.set(value, out); return out }
      const entries = Object.entries(value).map(([key, v]) => [normalize(key), walk(v)])
      for (const [key, list] of entries) if (key === '$map' || key === '$set') list.sort((a, b) => JSON.stringify(key === '$map' ? a[0] : a).localeCompare(JSON.stringify(key === '$map' ? b[0] : b), 'en'))
      if (new Set(entries.map(([key]) => key)).size !== entries.length) throw new Error(`baseline alias collision: ${Object.keys(value).join(', ')}`)
      const out = Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b, 'en')))
      memo.set(value, out)
      return out
    }
    return movedSymbolBaseline(walk(input), symbolMove)
  }
}

// Keep shared proof terms shared on disk. Decoding removes representation identity before comparison.
export function packBaseline(value) {
  const nodes = [], seen = new WeakMap()
  const encode = value => {
    if (value === null || typeof value !== 'object') return value
    if (seen.has(value)) return { ref: seen.get(value) }
    const id = nodes.length
    seen.set(value, id)
    nodes.push(null)
    nodes[id] = Array.isArray(value) ? { array: value.map(encode) } : { object: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])) }
    return { ref: id }
  }
  const root = encode(value)
  return { encoding: 'shared-json-v1', root, nodes }
}

export function unpackBaseline({ encoding, root, nodes }) {
  if (encoding !== 'shared-json-v1') throw new Error('unknown baseline encoding')
  const memo = new Map()
  const decode = value => {
    if (value === null || typeof value !== 'object') return value
    const id = value.ref
    if (memo.has(id)) return memo.get(id)
    const node = nodes[id]
    const out = node.array ? node.array.map(decode) : Object.fromEntries(Object.entries(node.object).map(([k, v]) => [k, decode(v)]))
    memo.set(id, out)
    return out
  }
  return decode(root)
}

export function differences(before, after) {
  const memo = new WeakMap()
  const object = v => v !== null && typeof v === 'object'
  const same = (a, b) => {
    if (Object.is(a, b)) return true
    if (!object(a) || !object(b) || Array.isArray(a) !== Array.isArray(b)) return false
    if (memo.get(a)?.has(b)) return memo.get(a).get(b)
    const keys = Object.keys(a)
    const equal = keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && same(a[key], b[key]))
    if (!memo.has(a)) memo.set(a, new WeakMap())
    memo.get(a).set(b, equal)
    return equal
  }
  const diff = (a, b, path) => {
    if (same(a, b)) return []
    if (!object(a) || !object(b) || Array.isArray(a) !== Array.isArray(b)) return [{ path, before: a, after: b }]
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().flatMap(key => diff(a[key], b[key], `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`))
  }
  return diff(before, after, '$')
}

/** Only copy-key spellings and existence diagnostic wording are migration metadata. */
export function existenceBaseline(input) {
  const memo = new WeakMap()
  const walk = (value, key = '') => {
    if (typeof value === 'string') {
      if (key === '$key') return value.replace(/^(?:(@?[a-z][a-z0-9-]*\/)?)((?:glossary\.groups|group)\.)([A-Za-z0-9_-]+\.(?:title|desc))$/, '$1tag.$3')
      if (key === 'stdout') return value.replace(/^(  FAIL content: [^\n]+: )unknown (tag|level|part|entry|tray|section|relation|kind|grant|[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*) ([#@A-Za-z0-9_/:.-]+)(?:; expected ([A-Za-z0-9_/-]+))?$/gm, (_, head, kind, target, member) => `${head}missing target ${kind} ${target}${member ? ` (member ${member})` : ''}`)
      return value
    }
    if (!value || typeof value !== 'object') return value
    if (memo.has(value)) return memo.get(value)
    const out = Array.isArray(value) ? value.map(child => walk(child)) : Object.fromEntries(Object.entries(value).map(([key, child]) => [key, walk(child, key)]))
    memo.set(value, out)
    return out
  }
  return walk(input)
}

/** Normalize only the initial version-format migration inside named configuration files. */
export function versionMetadataBaseline(input, retiredDependency) {
  const memo = new WeakMap()
  const walk = (value, file) => {
    if (!value || typeof value !== 'object') return value
    if (memo.has(value)) return memo.get(value)
    let entries = Object.entries(value)
    if (file === 'package.json') {
      const old = Number.isInteger(value.vocabulary) && Object.keys(value).every(key => ['vocabulary', 'uses'].includes(key))
      const current = ['0.0.0', '1.0.0'].includes(value.version) && ['^0.0.0', '^1.0.0', '^2.0.0'].includes(value.kernel) && value.uses && !Array.isArray(value.uses) && Object.keys(value).every(key => ['version', 'kernel', 'uses'].includes(key)) && Object.values(value.uses).every(range => ['^0.0.0', '^1.0.0'].includes(range))
      if (old || current) entries = [['uses', old ? value.uses ?? [] : Object.keys(value.uses).filter(id => id !== retiredDependency)]]
    }
    if (file === 'game.json' && ['^0.0.0', '^1.0.0', '^2.0.0'].includes(value.kernel) && value.packages && !Array.isArray(value.packages) && Object.values(value.packages).every(range => ['^0.0.0', '^1.0.0'].includes(range))) entries = entries.filter(([key]) => key !== 'kernel').map(([key, child]) => [key, key === 'packages' ? Object.keys(child).filter(id => id !== retiredDependency) : child])
    const out = Array.isArray(value) ? value.map(child => walk(child)) : Object.fromEntries(entries.map(([key, child]) => [key, walk(child, key)]))
    memo.set(value, out)
    return out
  }
  return walk(input)
}

/** Step 6 changes chapter identities and removes the retired display-order representation only. */
export function collectionFieldsBaseline(value) {
  const result = structuredClone(value)
  const local = id => typeof id === 'string' ? id.replace(/^@(?:[^/]+\/)?/, '') : String(id)
  if (result.structure?.relations) delete result.structure.relations.order
  for (const era of Array.isArray(result.structure?.eras) ? result.structure.eras : []) {
    era.id = local(era.id)
    if (Number.isInteger(era.number) && String(era.number) === era.id) delete era.number
  }
  for (const record of result.records ?? []) {
    const plan = record.course?.plan
    if (!plan) continue
    for (const [, place] of plan.place?.$map ?? []) if (place.era !== undefined) place.era = local(place.era)
    for (const key of ['rows', 'tracks']) if (plan[key]?.$map) {
      plan[key].$map = plan[key].$map.map(([id, value]) => [local(id), value]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    }
    for (const link of plan.dependencyLinks ?? []) if (link.source === 'course') link.detail = local(link.detail)
  }
  return result
}

/** Selected task discriminators move from native kind to the package play protocol. */
export function levelPlayBaseline(value, names = []) {
  if (!value.structure?.levels) return value
  const plays = new Set(names)
  return { ...value, structure: { ...value.structure, levels: value.structure.levels.map(level => ({ ...level,
    tasks: level.tasks.map(task => {
      if (task.kind !== undefined || !plays.has(task.play)) return task
      const { play, ...fields } = task
      return { ...fields, kind: play }
    }),
  })) } }
}

/** Selected tasks and references use the renamed play and panel fields. */
export function nestedPlayBaseline(value, names = []) {
 const plays = new Set(names)
 const memo = new WeakMap()
 const walk = input => {
  if (!input || typeof input !== 'object') return input
  if (memo.has(input)) return memo.get(input)
  if (Array.isArray(input)) { const result = []; memo.set(input, result); result.push(...input.map(walk)); return result }
  const result = Object.fromEntries(Object.entries(input).map(([key, child]) => [key, walk(child)]))
  memo.set(input, result)
  if (result.mode === undefined && plays.has(result.play)) { result.mode = result.play; delete result.play; if (result.panel !== undefined && result.after === undefined) { result.after = result.panel; delete result.panel } }
  return result
 }
 return walk(value)
}

/** Standalone palettes contain only primitives installed by the selected package closure. */
export function dependencyPaletteBaseline(input, { packaged, dependencies = [], palette = {} } = {}) {
  if (!packaged) return input
  const absent = new Set(Object.entries(palette).flatMap(([owner, names]) => dependencies.includes(owner) ? [] : names))
  const keep = name => !absent.has(name)
  return { ...input, records: input.records.map(record => {
    if (!record.availability) return record
    const a = record.availability
    return { ...record, availability: { ...a,
      usable: a.usable.filter(keep), emptyProgress: a.emptyProgress.filter(keep),
      definitions: Object.fromEntries(Object.entries(a.definitions).filter(([name]) => keep(name))),
      tray: { ...a.tray, types: a.tray.types.filter(keep), folded: a.tray.folded.filter(keep) },
    } }
  }) }
}
