import { meaningsOf } from './kind-meanings.js'
import { contentSchemas } from './content.js'
// The rules every game follows, over one game's content (content.js): its content against its domain's vocabulary
// (./vocabulary.js), the course audit (../course.js), unique level ids
// that require only real levels, and its links. Authoring checks also run curriculum rules and example verdicts.
//
// A game is checked through its spec, which its domain makes under node (the package core runtime: { vocabulary,
// spec(content), validate(spec) }): { id, domain, title, course, levels, texts?, audit?() → [{ rule, level,
// part, text? }] }.
// `audit` adds the game's own course problems to the shared audit's. game.json may leave findings open (`open`, the
// work list in its design doc): they are listed, not failed, and one met since fails until it is dropped.
import { REF, refProblems } from './text.js'
import { checkContent } from './vocabulary.js'
import { textEntries } from './i18n.js'
import { find } from './schema.js'
import { noMemo } from './check-cache.js'
import { dependencyProblemsInProject } from './project-dependencies.js'
import { packageLevel, packageLevelOrder } from './package-play.js'

const registeredReferenceNames = (content, selections = {}) => Object.fromEntries(Object.entries(contentSchemas.get(content)?.references ?? {}).flatMap(([kind, { target }]) => {
  if (!target) return []
  return [[kind, new Set(selections[target]?.map(({ id }) => id) ?? Object.keys(content.registries[target] ?? {}))]]
}))

function checkContentLines(content, { domain, root }) {
  const problems = checkContent(domain, content)
  if (!problems.length) problems.push(...dependencyProblemsInProject(content, root))
  return problems.map(problem => ({
    fail: true,
    text: `content: ${problem.at}: ${problem.says}`,
    ...(['exists', 'dependency'].includes(problem.rule) && { problem }),
  }))
}

const authoredOrder = content => content.packageTarget ? packageLevelOrder(content) : content.levels.map(level => level.id)

/** Check content without constructing a course. */
export function checkContentOnly(content, options) {
  return { lines: checkContentLines(content, options), order: authoredOrder(content) }
}

/** Check each package level independently of any learning route. */
async function checkPackageLevels(content, domain, { authoring, mutants }, order) {
  const lines = []
  const names = { ...registeredReferenceNames(content), ...Object.assign({}, ...meaningsOf(contentSchemas.get(content)).map(meaning => meaning.textNames?.({ content, vocabulary: domain.vocabulary }))) }
  const byId = new Map(content.levels.map(level => [level.id, level]))
  const levels = order.map(id => byId.get(id))
  for (const [name, value] of Object.entries({ levels, ...Object.assign({}, ...meaningsOf(contentSchemas.get(content)).map(meaning => meaning.texts?.({ content }))) })) {
    for (const problem of refProblems(value, name, names)) lines.push({ fail: true, text: `text ${problem}` })
  }
  for (const level of content.levels) {
    try {
      const shell = packageLevel(content, level.id)
      const checker = domain.forContent?.(shell) ?? domain
      const spec = checker.spec(shell)
      const phase = authoring ? 'course' : 'runtime'
      const findings = [...await checker.checkPhase?.({ phase, spec, content: shell }) ?? [],
        ...(authoring ? await checker.validate({ ...spec, memo: noMemo, mutants }) : [])]
      lines.push(...findings.map(line => ({ level: level.id, ...line })))
    } catch (error) {
      lines.push({ fail: true, level: level.id, text: `${level.id}: ${error.message}` })
    }
  }
  return lines
}

/**
 * Everything checked on `content`, with diagnostic lines and the level order their paths use.
 * `domain`: its domain module (resolver.js runtimeOf). Content that does not fit the vocabulary is not built into a course: what
 * is wrong with it is all there is to say. `authoring`: also review course rules and example verdicts.
 * `mutants`: mutation reports for supported tasks in an authoring review. `cache`: the game's
 * kept checks (check-cache.js), which the domain's checks of an unchanged level are read from; never with `mutants`.
 */
export async function checkGame(content, { domain, authoring = false, mutants = false, cache = null, root }) {
  const invalid = checkContentLines(content, { domain, root })
  if (invalid.length) return { lines: invalid, order: authoredOrder(content) }
  const meanings = meaningsOf(contentSchemas.get(content))
  const lines = meanings.flatMap(meaning => [
    ...meaning.contentChecks?.({ content }) ?? [],
    ...(authoring ? meaning.authoringChecks?.({ content }) ?? [] : []),
  ])
  if (content.packageTarget) {
    const order = packageLevelOrder(content)
    return { lines: [...lines, ...await checkPackageLevels(content, domain, { authoring, mutants }, order)], order }
  }
  const fail = text => lines.push({ fail: true, text })
  const spec = domain.spec(content)
  const phase = authoring ? 'course' : 'runtime'
  lines.push(...await domain.checkPhase?.({ phase, spec, content }) ?? [])

  const order = spec.levels.map(level => level.id)
  const placed = new Set(order)
  const seen = new Set()
  for (const level of spec.levels) {
    if (seen.has(level.id)) fail(`${level.id}: duplicate id`)
    seen.add(level.id)
    for (const r of level.requires ?? []) if (!placed.has(r)) fail(`${level.id}: requires missing level ${r}`)
  }

  const context = { content, spec }
  const names = {
    ...registeredReferenceNames(content, { level: spec.levels }),
    ...Object.assign({}, ...meanings.map(meaning => meaning.textNames?.({ ...context, vocabulary: domain.vocabulary }))),
  }
  const extraTexts = Object.assign({}, ...meanings.map(meaning => meaning.texts?.(context)))
  for (const [name, value] of Object.entries({ levels: spec.levels, ...spec.texts, ...extraTexts })) for (const problem of refProblems(value, name, names)) fail(`text ${problem}`)

  if (!authoring) return { lines, order }

  // An entry is linked only where it is open already: in a level it opens at or after, in an entry opening no earlier.
  // The links are read off every text of the content, by its schema, whatever its fields are called.
  const vocabulary = meanings.reduce((vocabulary, meaning) => meaning.validationVocabulary?.({ vocabulary, content }) ?? vocabulary, domain.vocabulary)
  const opensBy = (at, where) => !at || at === where || (where && spec.course.before(at, where))
  const references = (schema, value) => find(schema, value, 'text', { vocabulary })
    .flatMap(({ value }) => typeof value === 'string' ? [value] : textEntries(value).map(([, text]) => text))
    .flatMap(text => [...text.matchAll(REF)])
  const linked = (schema, value, kind) => references(schema, value).filter(match => match[1] === kind).map(match => match[2])
  let linksByLevel
  const levelLinks = (kind) => {
    linksByLevel ??= content.levels.filter(({ id }) => placed.has(id)).map(({ id, ...level }) => {
      const byKind = new Map()
      for (const [, type, target] of references(vocabulary.level, level)) {
        if (!byKind.has(type)) byKind.set(type, new Set())
        byKind.get(type).add(target)
      }
      return [id, byKind]
    })
    return linksByLevel.map(([id, byKind]) => [id, [...byKind.get(kind) ?? []]])
  }
  lines.push(...await domain.checkPhase?.({ phase: 'references', ...context, levelLinks, opensBy, linked, placed }) ?? [])

  // Mutation reports are requested explicitly because providers may perform expensive checks.
  // A domain's check of one level goes through `memo` (check-cache.js), which runs it or hands back what it said last.
  const memo = cache && !mutants ? cache.memo(content, spec) : noMemo
  lines.push(...(await domain.validate({ ...spec, memo, mutants })))
  if (cache && !mutants) cache.save()
  return { lines, order }
}
