import { meaningsOf } from './kind-meanings.js'
import { contentSchemas } from './content.js'
// The rules every game follows, over one game's content (content.js): its content against its domain's vocabulary
// (./vocabulary.js), the course audit (../course.js), unique level ids
// that require only real levels, its links, and then its domain's own
// checks (reference answers pass, naive ones fail, …). npm run check (check.js) and every changeset (ops/changeset.js)
// run it.
//
// A game is checked through its spec, which its domain makes under node (the package core runtime: { vocabulary,
// spec(content), validate(spec) }): { id, domain, title, course, levels, texts?, audit?() → [{ rule, level,
// part, text? }] }.
// `audit` adds the game's own course problems to the shared audit's. game.json may leave findings open (`open`, the
// work list in its design doc): they are listed, not failed, and one met since fails until it is dropped.
import { REF, refProblems } from './text.js'
import { gameOf } from './games.mjs'
import { checkContent } from './vocabulary.js'
import { firstText, textEntries } from './i18n.js'
import { find } from './schema.js'
import { noMemo } from './check-cache.js'
import { dependencyProblemsInProject } from './project-dependencies.js'
import { packageLevel } from './package-play.js'

const registeredReferenceNames = (content, selections = {}) => Object.fromEntries(Object.entries(contentSchemas.get(content)?.references ?? {}).flatMap(([kind, { target }]) => {
  if (!target) return []
  const objects = selections[target] ?? Object.entries(content.registries[target] ?? {}).map(([id, value]) => ({ ...value, id }))
  return [[kind, new Map(objects.map(({ id, title, name }) => [id, String(firstText(title ?? name))]))]]
}))

export function checkContentLines(content, { domain, root }) {
  const problems = checkContent(domain, content)
  if (!problems.length) problems.push(...dependencyProblemsInProject(content, root))
  return problems.map(problem => ({
    fail: true,
    text: `content: ${problem.at}: ${problem.says}`,
    ...(['exists', 'dependency'].includes(problem.rule) && { problem }),
  }))
}

/** Check each package level independently of any learning route. */
async function checkPackageLevels(content, domain, mutants) {
  const lines = []
  const names = { ...registeredReferenceNames(content), ...Object.assign({}, ...meaningsOf(contentSchemas.get(content)).map(meaning => meaning.textNames?.({ content, vocabulary: domain.vocabulary }))) }
  for (const [name, value] of Object.entries({ levels: content.levels, ...Object.assign({}, ...meaningsOf(contentSchemas.get(content)).map(meaning => meaning.texts?.({ content }))) })) {
    for (const problem of refProblems(value, name, names)) lines.push({ fail: true, text: `text ${problem}` })
  }
  for (const level of content.levels) {
    try {
      const shell = packageLevel(content, level.id)
      const spec = domain.spec(shell)
      lines.push(...await domain.checkPhase?.({ phase: 'course', spec, content: shell }) ?? [])
      lines.push(...await domain.validate({ ...spec, memo: noMemo, mutants }))
    } catch (error) {
      lines.push({ fail: true, level: level.id, text: `${level.id}: ${error.message}` })
    }
  }
  return lines
}

/**
 * Everything checked on game `content`, as lines [{ text, fail? }].
 * `domain`: its domain module (resolver.js runtimeOf). Content that does not fit the vocabulary is not built into a course: what
 * is wrong with it is all there is to say. `mutants`: also mutation reports for supported tasks. `cache`: the game's
 * kept checks (check-cache.js), which the domain's checks of an unchanged level are read from; never with `mutants`.
 */
export async function checkGame(content, { domain, mutants = false, cache = null, root }) {
  const invalid = checkContentLines(content, { domain, root })
  if (invalid.length) return invalid
  const lines = meaningsOf(contentSchemas.get(content)).flatMap(meaning => meaning.contentChecks?.({ content }) ?? [])
  if (content.packageTarget) return [...lines, ...await checkPackageLevels(content, domain, mutants)]
  const fail = text => lines.push({ fail: true, text })
  const spec = domain.spec(content)
  lines.push(...await domain.checkPhase?.({ phase: 'course', spec, content }) ?? [])

  const seen = new Set()
  for (const level of spec.levels) {
    if (seen.has(level.id)) fail(`${level.id}: duplicate id`)
    seen.add(level.id)
    for (const r of level.requires ?? []) if (!spec.levels.some((l) => l.id === r)) fail(`${level.id}: requires missing level ${r}`)
  }

  // References to levels, parts and entries: the names come from the game as the shell gets it.
  const game = await gameOf(content)
  const names = {
    ...registeredReferenceNames(content, { level: game.levels }),
    ...Object.assign({}, ...meaningsOf(contentSchemas.get(content)).map(meaning => meaning.textNames?.({ content, game, vocabulary: domain.vocabulary }))),
  }
  const extraTexts = Object.assign({}, ...meaningsOf(contentSchemas.get(content)).map(meaning => meaning.texts?.({ content, game, spec })))
  const placed = new Set(spec.levels.map(level => level.id))
  for (const [name, value] of Object.entries({ levels: spec.levels, ...spec.texts, ...extraTexts })) for (const problem of refProblems(value, name, names)) fail(`text ${problem}`)

  // An entry is linked only where it is open already: in a level it opens at or after, in an entry opening no earlier.
  // The links are read off every text of the content, by its schema, whatever its fields are called.
  const vocabulary = meaningsOf(contentSchemas.get(content)).reduce((vocabulary, meaning) => meaning.validationVocabulary?.({ vocabulary, content }) ?? vocabulary, domain.vocabulary)
  const opensBy = (at, where) => !at || at === where || (where && spec.course.before(at, where))
  const linked = (schema, value, kind) => find(schema, value, 'text', { vocabulary })
    .flatMap(({ value }) => typeof value === 'string' ? [value] : textEntries(value).map(([, text]) => text))
    .flatMap((s) => [...s.matchAll(REF)].filter((m) => m[1] === kind).map((m) => m[2]))
  const levelLinks = (kind) => content.levels.filter(({ id }) => placed.has(id)).map(({ id, ...level }) => [id, [...new Set(linked(vocabulary.level, level, kind))]])
  lines.push(...await domain.checkPhase?.({ phase: 'references', spec, content, game, levelLinks, opensBy, linked, placed }) ?? [])

  // Mutation reports are requested explicitly because providers may perform expensive checks.
  // A domain's check of one level goes through `memo` (check-cache.js), which runs it or hands back what it said last.
  const memo = cache && !mutants ? cache.memo(content, spec) : noMemo
  lines.push(...(await domain.validate({ ...spec, memo, mutants })))
  if (cache && !mutants) cache.save()
  return lines
}
