import { S } from 'kernel'

const wordSetKinds = Symbol.for('games.logic-wordset-kinds')

/** Register a package's named reading dictionaries alongside any other installed dictionaries. */
export function registerWordSets(kernel, name, type) {
  kernel.kind(name, {
    type, read: value => value,
    derived: ['wordSets'],
    assemble: ({ registries, schemas }) => ({
      wordSets: Object.assign({}, ...schemas[wordSetKinds].map(kind => registries[kind])),
    }),
    vocabulary(base) {
      const kinds = base[wordSetKinds] ?? []
      if (kinds.includes(type)) return base
      const available = [...kinds, type]
      const names = available.map(kind => S.name(kind))
      const words = S.list(S.either(...names, S.map(S.text())))
      const bind = schema => {
        if (!schema || typeof schema !== 'object') return schema
        if (Array.isArray(schema)) return schema.map(bind)
        return Object.fromEntries(Object.entries(schema).map(([key, value]) => [
          key, key === 'words' ? { ...words, ...(value.optional && { optional: true }) } : bind(value),
        ]))
      }
      return {
        ...base, [wordSetKinds]: available,
        game: S.obj({ ...base.game.fields, words: S.opt(names.length === 1 ? names[0] : S.either(...names)), hero: S.opt(S.ref('display')) }),
        level: bind(base.level),
      }
    },
  })
}
