import { eraLevels } from '../../course.js'
import { declaresIn, kindPolicy } from '../kind-policy.js'
import { meaningsOf } from '../kind-meanings.js'
import { tagKey } from '../tag-identity.js'
import { kindSchemas } from '../plugin-kinds.js'
// A changeset: several operations (operations.js) applied to a game together, as one change.
//
//   { why?: text, by?: who, ops: [{ op: 'tag.set', …its arguments }] }
//
// `by` says who made the change, as the change log keeps it: a person's hand ('studio', 'cli') or an agent
// ('agent:<step>:<model>'). What a person changed of what an agent wrote is read from it (games/DIRECTION.md 4).
//
// A workspace opened for one side (workspace.js `scope`: the package, or the game) runs only that side's operations
// (operations.js opScope). Each operation's arguments are checked against its schema, then it runs on the workspace (workspace.js) in order;
// one that fails stops the changeset with nothing written. The resulting content must load through the platform.
// A successful write records the operations, changed files and inverse in the append-only log. A refused change
// or a preview restores the original workspace.
import { expandNames, fullName } from '../names.js'
import { parsePath } from './edit.js'
import { assertStableIds } from './identity.js'
import { shapeAt, validate } from '../schema.js'
import { OBJECT_SCHEMAS } from '../objects.js'
import { tasksSchema } from '../tasks.js'

import { checkChangeset } from './changeset-check.js'
import { operationsFor, opScope } from './operations.js'
import { adoptionFiles, append, hashOf, headOf, readLog, withLock } from './log.js'

export { LOG, readLog } from './log.js'

/**
 * Apply `changeset` to the open game `ws`. write: put it on disk when it passes (otherwise it is a dry run);
 * check: run platform checks (off: only validate the content schema and dependencies); changesOnly: scope checks to the draft; domain: the
 * game's domain module (its own by default). Returns { ok, says, problems, failed (the index of the operation that
 * failed, or null), lines (every line of the check), order, diff, files, changes ([{ file, before, after }] texts), content
 * (the game as the changeset leaves it, null when an operation failed), inverse (the changeset undoing it) }.
 * texts false: a dry run that leaves out the files' texts (changes, diff, files empty), for a caller that shows none.
 */
export async function runChangeset(ws, changeset, { write = false, check = true, changesOnly = false, undoes = null, base = null, domain: given = null, texts = true } = {}) {
  const start = ws.snapshot()
  const says = []
  const inverse = []
  const fail = (problems, op = null) => {
    ws.restore(start)
    return { ok: false, says, problems, failed: op, lines: [], order: [], diff: '', files: [], changes: [], content: null, inverse: null }
  }
  for (const [k, { op: name, ...supplied }] of (changeset.ops ?? []).entries()) {
    const baseVocabulary = ws.schemas
    const operations = operationsFor(baseVocabulary)
    const op = operations[name]
    const where = `op ${k + 1} (${name})`
    if (ws.copyOnly && name !== 'ui.set') return fail([`${where}: only interface copy is editable here`], k)
    if (!op) return fail([`${where}: no such operation; the operations are ${Object.keys(operations).join(', ')}`], k)
    let args
    try {
      args = sourceArguments(ws, name, op.params, supplied, baseVocabulary)
    } catch (error) {
      return fail([`${where}: ${error.en ?? error.message}`], k)
    }
    // Operations resolve references against the workspace vocabulary.
    const vocabulary = validationVocabulary(ws)
    if (args.layer && args.layer !== ws.layer) return fail([`${where}: open layer ${args.layer} to edit its objects`], k)
    const policy = operationKind(name, args, baseVocabulary) ?? { declares: opScope({ op: name, ...args }) }
    if (ws.scope && !declaresIn(policy, ws.scope)) return fail([`${where}: this is the ${opScope({ op: name, ...args })} workspace's to change, not the ${ws.scope} workspace's`], k)
    const levels = new Set(ws.levels.keys())
    // Chapter files and older log inverses carry qualified levels from every selected package.
    if (name === 'chapter.put') for (const layer of ws.packageLayers) for (const object of layer.objects) {
      if (object.kind === 'level') levels.add(fullName(layer.id, object.name))
    }
    const wrong = validate(op.params, args, { vocabulary, levels })
    if (wrong.length) return fail(wrong.map((p) => `${where}: ${p.at === '(root)' ? '' : `${p.at.slice(1)}: `}${p.says}`), k)
    try {
      const previous = ws.snapshot()
      const done = op.apply(ws, args, { vocabulary })
      ws.normalize(validationVocabulary(ws), previous)
      if (name.startsWith('kind.') || name.startsWith('capability.') || name.startsWith('object.') && args.kind === 'shape') {
        const declarations = ['kind', 'shape']
        const layers = ws.packageLayers.map(layer => layer.id !== ws.packageId ? layer : { ...layer, capabilityDeclarations: Object.fromEntries(ws.capabilities), objects: [
          ...layer.objects.filter(o => !declarations.includes(o.kind)),
          ...declarations.flatMap(kind => [...ws.contentObjects[kind]].map(([name, value]) => ({ kind, name, value }))),
        ] })
        // Rebuild from the unextended layer vocabulary, so replacing a declaration is a hard switch.
        const { layerVocabulary } = await import('../resolver.js')
        ws.schemas = layerVocabulary(layers)
        for (const kind of Object.keys(ws.contentObjects)) if (!kindSchemas(ws.schemas)[kind]) {
          if (ws.contentObjects[kind].size) throw new Error(`cannot remove nonempty kind ${kind}`)
          delete ws.contentObjects[kind]; delete ws.kindFolders[kind]
        }
        for (const [name, definition] of Object.entries(ws.schemas.objectKinds)) if (!definition.extends) {
          const kind = definition.objectKind ?? name
          ws.kindFolders[kind] = definition.folder
          ws.contentObjects[kind] ??= new Map()
        }
      }
      says.push(done.says)
      inverse.unshift(...done.inverse)
    } catch (error) {
      return fail([`${where}: ${error.message}`], k)
    }
  }

  // Load the runtime for the final package selection. A failed check restores the original workspace.
  try {
    const content = ws.content()
    const report = await checkChangeset(ws, content, changeset.ops ?? [], { check, changesOnly, given })
    return settle({ ws, content, changeset, report, start, says, inverse, write, undoes, base, texts: texts || write })
  } catch (error) {
    return fail([`the changeset could not be settled: ${error.message}`])
  }
}

const validationVocabulary = ws => meaningsOf(ws.schemas).reduce((vocabulary, meaning) =>
  meaning.validationVocabulary?.({ vocabulary, workspace: ws }) ?? vocabulary, ws.schemas)

function operationKind(operation, args, vocabulary) {
  const kind = operation.startsWith('object.') ? args.kind
    : operation === 'text.set' ? (args.entry !== undefined ? 'entry' : args.section !== undefined ? 'section' : args.kind)
      : operation.split('.')[0]
  // A text.set naming no kind (the game's texts, a level's) has no declared kind's policy: its scope is opScope's.
  if (kind === undefined) return null
  const name = Object.keys(vocabulary.objectKinds ?? {}).find(name => name === kind || vocabulary.objectKinds[name].objectKind === kind)
  return name && kindPolicy(name, vocabulary)
}

// Tool results carry full names. Operations edit this layer's source spelling before writing it back.
function sourceArguments(ws, operation, params, supplied, vocabulary) {
  const prefix = `${ws.packageId}/`
  const layerPrefix = `${ws.layer}/`
  const local = (value) => typeof value === 'string' && value.startsWith(layerPrefix) ? value.slice(layerPrefix.length) : typeof value === 'string' && value.startsWith(prefix) ? value.slice(prefix.length) : value
  const policy = operationKind(operation, supplied, vocabulary)
  const gameObject = operation.startsWith('chapter.') || supplied.chapter !== undefined || ws.scope === 'game' && policy && declaresIn(policy, 'game')
  const gameLocal = value => typeof value === 'string' && value.startsWith(layerPrefix) ? value.slice(layerPrefix.length) : value
  const objectLocal = gameObject ? gameLocal : local
  const selectors = [...meaningsOf(vocabulary).flatMap(meaning => meaning.selectors ?? []), 'level', 'entry', 'tag', 'relation', 'section', 'chapter', 'task', 'to', 'after']
  const isOverrideTarget = key => operation === 'text.override' && ['entry', 'section'].includes(key)
  const selected = Object.fromEntries(Object.entries(supplied).map(([key, value]) => [key, selectors.includes(key) && !isOverrideTarget(key) ? objectLocal(value) : value]))
  const source = (value, schema) => expandNames(value, gameObject ? ws.layer : ws.packageId, { objects: Object.fromEntries(Object.entries(ws.contentObjects ?? {}).map(([kind, values]) => [kind, Object.fromEntries(values)])), schema, vocabulary, resolve: objectLocal })
  const args = source(selected, params)
  if (operation.startsWith('kind.')) args.kind = local(args.kind)
  if (operation.startsWith('object.') || operation.startsWith('text.') && args.kind !== undefined) args.name = objectLocal(args.name)
  if (args.entry !== undefined && !isOverrideTarget('entry')) args.entry = objectLocal(args.entry)
  if (args.tag !== undefined) args.tag = local(args.tag)
  for (const meaning of meaningsOf(vocabulary)) meaning.sourceArguments?.({ args, operation, local })
  const targets = {
    level: [vocabulary.level, ws.levels.get(args.level)],
    task: [tasksSchema(vocabulary), undefined],
    entry: [kindSchemas(ws.schemas).entry, ws.contentObjects.entry?.get(args.entry)],
    game: [undefined, ws.game],
    chapter: [kindSchemas(vocabulary).chapter, ws.contentObjects.chapter?.get(args.chapter)],
    ...Object.fromEntries(Object.entries({ tag: 'tags', relation: 'relations', section: 'sections' }).map(([kind, plural]) => [kind, [OBJECT_SCHEMAS[plural], ws[plural]?.get(kind === 'tag' ? tagKey(args.member, args.tag) : args[kind])]])),
    ...Object.assign({}, ...meaningsOf(vocabulary).map(meaning => meaning.operationTargets?.({ workspace: ws, args, vocabulary }))),
  }
  const [schema, base] = operation.startsWith('object.') ? [kindSchemas(vocabulary)[args.kind], ws.contentObjects[args.kind]?.get(args.name)] : targets[operation.split('.')[0]] ?? []
  if (operation.startsWith('game.') && args.value !== undefined && args.path !== undefined) {
    const gameSchema = shapeAt(vocabulary.game, ws.game, parsePath(args.path), { vocabulary })
    args.value = expandNames(supplied.value, ws.packaged ? ws.packageId : `@${ws.id}`, { objects: Object.fromEntries(Object.entries(ws.contentObjects ?? {}).map(([kind, values]) => [kind, Object.fromEntries(values)])), schema: gameSchema, vocabulary, textKeys: false })
  }
  if (schema) {
    if (args.data) {
      args.data = source(supplied.data, schema)
      if (args.data.id) args.data = { ...args.data, id: local(args.data.id) }
      if (operation.endsWith('.put')) assertStableIds(base ?? {}, args.data)
    }
    if (args.fields) args.fields = source(args.fields, schema)
    if (base && args.value !== undefined && args.path !== undefined) args.value = source(supplied.value, shapeAt(schema, base, parsePath(args.path), { vocabulary }))
  }
  if (operation.startsWith('text.') && typeof args.value === 'string') args.value = source(args.value, { type: 'text' })
  if (operation === 'level.blueprint' && typeof args.text === 'string') args.text = source(args.text.split('\n'), { type: 'board' }).join('\n')
  return args
}

function removedCourseLevels(ws, start, content) {
  if (ws.packaged || !Array.isArray(start.game?.chapters)) return []
  const placed = new Set((content.eras ?? []).flatMap(eraLevels))
  const previous = start.game.chapters.filter(id => typeof id === 'string')
    .flatMap(id => start.contentObjects.chapter?.get(id.split('/').at(-1))?.levels ?? [])
  return [...new Set(previous)].filter(id => !placed.has(id))
}

// Write or restore after settlement checks the resulting draft.
function settle({ ws, content, changeset, report, start, says, inverse, write, undoes, base, texts }) {
  const { lines, order, checkedChanges = false } = report
  const problems = lines.filter((l) => l.fail).map((l) => l.text)
  const changes = texts ? ws.changes() : []
  const diff = texts ? ws.diff(changes) : ''
  const files = changes.map((c) => c.file)
  const ok = problems.length === 0
  let refused = null
  const removedLevels = removedCourseLevels(ws, start, content)
  if (ok && write) {
    // Written only onto the log the caller saw (`base`, the seq of its last entry, when given) and onto the files as
    // they were opened; the files' hashes go in the entry.
    refused = withLock(ws, () => {
      if (base !== null && headOf(ws) !== base) return `the game changed since you saw it (its log is at #${headOf(ws)}, not #${base}): load it again`
      try {
        ws.write(changes)
      } catch (error) {
        return error.message
      }
      append(ws, { ...(ws.layer && { layer: ws.layer }), why: changeset.why, ...(changeset.by && { by: changeset.by }), ops: changeset.ops, files: changes.map(({ file, after }) => ({ file, after: hashOf(after) })), ...(removedLevels.length > 0 && { removedLevels }), inverse, ...(undoes !== null && { undoes }) })
      return null
    })
  }
  if (!ok || !write || refused) ws.restore(start)
  if (refused) return { ok: false, says, problems: [refused], failed: null, lines, order, diff, files, changes, content, inverse: null }
  return { ok, says, problems, failed: null, lines, order, checkedChanges, removedLevels, diff, files, changes, content, inverse: { why: `undo: ${changeset.why ?? says.join('; ')}`, ops: inverse } }
}

/** The last change of the log not undone yet (an undo is never itself undone this way: apply the change again). */
export function lastUndoable(ws) {
  const entries = readLog(ws)
  const undone = new Set(entries.map((e) => e.undoes).filter((x) => x !== undefined))
  return entries.filter((e) => !e.adopt && e.undoes === undefined && !undone.has(e.seq)).at(-1) ?? null
}

/**
 * Undo the last change of the log (write: put it on disk): only from the files as that change left them, so a file
 * changed since (by hand, or by a later change) is never written back over.
 */
export async function undo(ws, { seq = null, ...options } = {}) {
  const entry = lastUndoable(ws)
  const refused = (problem) => ({ ok: false, says: [], problems: [problem], failed: null, lines: [], order: [], diff: '', files: [], changes: [], content: null, inverse: null })
  if (!entry) return refused('nothing to undo')
  if (seq !== null && seq !== entry.seq) return refused(`#${seq} is not the change undo would undo now (#${entry.seq} is): the log has changed since`)
  if (entry.layer && entry.layer !== ws.layer) return refused(`open layer ${entry.layer} to undo its change`)
  const disk = ws.onDisk()
  const moved = entry.files.filter((f) => ws.owns(f.file) && hashOf(disk.get(f.file)) !== f.after).map((f) => f.file)
  if (moved.length) return refused(`#${entry.seq} cannot be undone: changed since it was made: ${moved.join(', ')}`)
  return runChangeset(ws, { why: `undo #${entry.seq}${entry.why ? `: ${entry.why}` : ''}`, ops: entry.inverse }, { ...options, undoes: entry.seq })
}

/** Take the game's files as they are now into the log (after a change outside the operation set): the entry's seq. */
export function adopt(ws, why) {
  return withLock(ws, () => append(ws, { why, adopt: true, files: adoptionFiles(ws, ws.onDisk()) }))
}
