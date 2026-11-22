// Advisories (games/design/README.md 5.2): house conventions a machine can see, raised for a human to decide on. They
// are never a check: nothing here fails content, gates a write or a release, or reaches an agent's tools. Only the
// Studio's background lane reads them (../app/studio-advisories.js).
//
//   adviseText(field, text)        → [{ rule, says }] for one text, by the field it is in
//   advisories(content, vocabulary) → [{ id, rule, level, path, says }] over the levels of a game or a package
//
// `id` names the finding on this very wording: a human's decision on it stands until the text changes.
import { createHash } from 'node:crypto'
import { find } from './schema.js'
import { REF } from './text.js'
import { showPath } from './ops/edit.js'

// Upper bounds in characters of the Chinese side; a translation may run to three times as long.
const LIMITS = { title: 6, brief: 90, intro: 170, hint: 110, after: 70 }
const TRANSLATED = 3
const BANNED = [/搞定|接一下|啥|就行|没事/, /对[^，。]{1,8}进行|得到证明|得到揭示|被引入/, /\b(?:simply|obviously)\b/i]
const AHEAD = [/下一关|后面的关|后面你会|之后会用到|以后会用到|稍后/, /\bnext level\b|\blater levels?\b|\byou will (?:later|soon)\b|\bcoming up\b/i]

const plain = text => String(text ?? '').replace(REF, '·').replace(/<[^>]+>/g, '').replace(/\\[()]/g, '')
const first = (patterns, texts) => patterns.flatMap(pattern => texts.map(text => text.match(pattern)?.[0])).find(Boolean)

/** The rules by id: each reads one text as { field, zh, others } and says what a human should look at, or nothing. */
export const ADVISORY_RULES = {
  'copy-length'({ field, zh, others }) {
    const limit = LIMITS[field]
    if (!limit) return null
    if (zh.length > limit) return `${field} zh ${zh.length}/${limit}`
    const long = others.find(([, text]) => text.length > limit * TRANSLATED)
    return long ? `${field} ${long[0]} ${long[1].length}/${limit * TRANSLATED}` : null
  },
  'copy-banned'({ zh, others }) {
    const word = first(BANNED, [zh, ...others.map(([, text]) => text)])
    return word ? `「${word}」` : null
  },
  'copy-ahead'({ zh, others }) {
    const word = first(AHEAD, [zh, ...others.map(([, text]) => text)])
    return word ? `「${word}」` : null
  },
}

/** What the rules say of one text: a string, or its wordings by language. */
export function adviseText(field, text) {
  const sides = typeof text === 'string' ? { zh: text } : text ?? {}
  const zh = plain(sides.zh)
  const others = Object.entries(sides).filter(([lang, value]) => lang !== 'zh' && !lang.startsWith('$') && typeof value === 'string').map(([lang, value]) => [lang, plain(value)])
  return Object.entries(ADVISORY_RULES).flatMap(([rule, read]) => {
    const says = read({ field, zh, others })
    return says ? [{ rule, says }] : []
  })
}

// A text's field is the nearest key the rules know (a paragraph of an intro is `intro[2].t`), else its own key.
const fieldOf = (path) => {
  const keys = path.filter(key => typeof key === 'string')
  return keys.findLast(key => key in LIMITS) ?? keys.at(-1)
}

/** The advisories on every text of every level, read by the level schema of `vocabulary`. */
export function advisories(content, vocabulary) {
  return content.levels.flatMap(({ id: level, ...value }) => find(vocabulary.level, value, 'text', { vocabulary })
    .filter(hit => !hit.key)
    .flatMap(({ path, value: text }) => adviseText(fieldOf(path), text).map(({ rule, says }) => ({
      id: createHash('sha1').update(JSON.stringify([rule, level, path, text])).digest('hex').slice(0, 16),
      rule, level, path: showPath(path), says,
    }))))
}
