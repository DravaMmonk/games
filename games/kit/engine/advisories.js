// Advisories (games/design/README.md 5.2): house conventions a machine can see, raised for a human to decide on. They
// are never a check: nothing here fails content, gates a write or a release, or reaches an agent's tools. Only the
// Studio's background lane reads them (../app/studio-advisories.js).
//
//   adviseText(field, text, at?)   → [{ rule, says }] for one text, by the field it is in
//   copyAdvisories(content, vocabulary) → [{ rule, level, path, says, on }] over the texts of every level
//   advisories(content, domain)    → [{ id, rule, level, path, says }]: the copy advisories, and on a game those of
//                                    its packages (checks registered with phase 'advisory': [{ rule, level, says }])
//
// `id` names the finding on what it was raised on (`on`: the wording, or what a package says): a human's decision on
// it stands until that changes.
import { createHash } from 'node:crypto'
import { find } from './schema.js'
import { REF } from './text.js'
import { showPath } from './ops/edit.js'

// Upper bounds in characters of the Chinese side; a translation may run to three times as long.
const LIMITS = { title: 8, brief: 90, intro: 120, hint: 70, after: 120 }
const TRANSLATED = 3
const REPEATED = 15 // characters from which a passage said twice is a repeat
const WORDS = {
  'copy-banned': { zh: /搞定|接一下|啥|就行|没事|对[^，。]{1,8}进行|得到证明|得到揭示|被引入/, en: /\b(?:simply|obviously)\b/i },
  'copy-ahead': { zh: /后面的关|后面你会|之后会用到|以后会用到|稍后/, en: /\blater levels?\b|\byou will (?:later|soon)\b|\bcoming up\b/i },
  // Another level is reached by a link, never by where it stands.
  'copy-pointing': { zh: /上一关|下一关|前一关|(?<!最)后一关|前两关|前几关|」那一?关/, en: /\b(?:the last|previous|next|earlier) levels?\b/i },
}
const FIELD_WORDS = {
  'copy-brief-why': { field: 'brief', zh: /因为|为了|所以/, en: /\bbecause\b|\bso that\b/i },
  'copy-intro-part': { field: 'intro', first: true, zh: /^\s*新元件/, en: /^\s*A new part/i },
}

const plain = text => String(text ?? '').replace(REF, '·').replace(/<[^>]+>/g, '').replace(/\\[()]/g, '')
const wordings = text => Object.entries(typeof text === 'string' ? { zh: text } : text ?? {})
  .filter(([lang, value]) => !lang.startsWith('$') && typeof value === 'string').map(([lang, value]) => [lang, plain(value)])
const word = (patterns, sides) => sides.map(([lang, text]) => patterns[lang] && text.match(patterns[lang])?.[0]).find(Boolean)

/** What the rules say of one text (a string, or its wordings by language); `first`: it opens its list (an intro's first paragraph). */
export function adviseText(field, text, { first = false } = {}) {
  const sides = wordings(text)
  const out = []
  const limit = LIMITS[field]
  const long = limit && sides.find(([lang, value]) => value.length > (lang === 'zh' ? limit : limit * TRANSLATED))
  if (long) out.push({ rule: 'copy-length', says: `${field} ${long[0]} ${long[1].length}/${long[0] === 'zh' ? limit : limit * TRANSLATED}` })
  for (const [rule, patterns] of Object.entries(WORDS)) {
    const found = word(patterns, sides)
    if (found) out.push({ rule, says: `「${found}」` })
  }
  for (const [rule, { field: only, first: opening, ...patterns }] of Object.entries(FIELD_WORDS)) {
    const found = field === only && (!opening || first) && word(patterns, sides)
    if (found) out.push({ rule, says: `「${found.trim()}」` })
  }
  return out
}

// A text's field is the nearest key the rules know (a paragraph of an intro is `intro[2].t`), else its own key.
const fieldOf = (path) => {
  const keys = path.filter(key => typeof key === 'string')
  return keys.findLast(key => key in LIMITS) ?? keys.at(-1)
}
const zhOf = text => plain(typeof text === 'string' ? text : text?.zh)

/**
 * The copy advisories on every text of every level, read by the level schema of `vocabulary`: each text by its own
 * field, then across levels a passage said word for word in an earlier level (copy-repeat).
 */
export function copyAdvisories(content, vocabulary) {
  const texts = content.levels.flatMap(({ id: level, ...value }) => find(vocabulary.level, value, 'text', { vocabulary })
    .filter(hit => !hit.key).map(({ path, value: text }) => ({ level, path, text, field: fieldOf(path), zh: zhOf(text) })))
  const said = new Map()
  return texts.flatMap(({ level, path, text, field, zh }) => {
    const found = adviseText(field, text, { first: path.find(key => typeof key === 'number') === 0 })
    // Titles and task briefs may share a standard wording.
    if (!['title', 'brief'].includes(field) && zh.length >= REPEATED) {
      const before = said.get(zh)
      if (before && before !== level) found.push({ rule: 'copy-repeat', says: `= ${before}` })
      else if (!before) said.set(zh, level)
    }
    return found.map(({ rule, says }) => ({ rule, level, path: showPath(path), says, on: text }))
  })
}

const idOf = (...parts) => createHash('sha1').update(JSON.stringify(parts)).digest('hex').slice(0, 16)

/** Every advisory on `content`, read through its `domain` (resolver.js runtimeOf). A package has no course to advise on. */
export async function advisories(content, domain) {
  const copy = copyAdvisories(content, domain.vocabulary)
  const course = content.packageTarget ? [] : await domain.checkPhase?.({ phase: 'advisory', spec: domain.spec(content), content }) ?? []
  return [
    ...copy.map(({ on, ...found }) => ({ id: idOf(found.rule, found.level, found.path, on), ...found })),
    ...course.map(({ rule, level, says }) => ({ id: idOf(rule, level, says), rule, level, path: '', says })),
  ]
}
