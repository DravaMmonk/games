import { CHAPTERS, COURSE_OPTIONS } from './course-schema.js'
import { kernelTags } from './tag-identity.js'
import { S } from './schema.js'
import { createCapabilityRegistry } from './capabilities.js'

export const capabilities = createCapabilityRegistry()

export const vocabulary = {
  plugins: { tags: { key: '<member>:<namespace>/<name>', register: 'tag(fullName, member)', reserved: ['kernel'], readers: [...kernelTags.values()].map(({ name, member }) => ({ name, member })) }, core: ['play', 'kind', 'state', 'check', 'agent', 'tag', 'object'], view: ['play', 'editor', 'display'], exports: ['kernel', 'kernel/view'], declarations: 'kinds/<name>.json' },
  meanings: capabilities.meanings,
  capabilities: capabilities.tables,
  kinds: capabilities.kinds,
  languages: capabilities.languages,
  courses: capabilities.schemas,
  game: S.either(...Object.values(capabilities.schemas).map((s) => s.game)),
  level: S.either(...Object.values(capabilities.schemas).map((s) => s.level)),
}

/** A fresh assembly starts with only the platform's configuration schema. */
export function vocabularyFor() {
  return { ...vocabulary, game: S.obj({ title: S.opt(S.text()), author: S.opt(S.str()), kicker: S.opt(S.text()), lede: S.opt(S.text()), topic: S.opt(S.text()), description: S.opt(S.text()), art: S.opt(S.str()), icon: S.opt(S.str()), dev: S.opt(S.bool()), hidden: S.opt(S.bool()), chapters: S.opt(CHAPTERS), ...COURSE_OPTIONS }), level: null }
}
