import { S } from 'kernel'

const vocabularyProjection = Symbol.for('games.qed-vocabulary')

/** QED selects named reading dictionaries; logic also accepts inline dictionaries. */
export function register(kernel) {
  kernel.capability('display', 'qed/hero', { about: { zh: '证明完毕的地图插图', en: 'QED map illustration' }, role: 'hero' })
  kernel.kind('qed/readings', {
    type: 'qed/wordset', read: value => value,
    derived: ['wordSets'],
    assemble: ({ registries }) => ({ wordSets: registries['qed/wordset'] ?? {} }),
    vocabulary(base) {
      if (base[vocabularyProjection]) return base
      const words = S.list(S.either(S.name('qed/wordset'), S.map(S.text())))
      const bind = schema => !schema || typeof schema !== 'object' ? schema : Array.isArray(schema) ? schema.map(bind) : Object.fromEntries(Object.entries(schema).map(([key, value]) => [key, key === 'words' ? { ...words, ...(value.optional && { optional: true }) } : bind(value)]))
      return { ...base, [vocabularyProjection]: true, game: S.obj({ ...base.game.fields, words: S.opt(S.name('qed/wordset')), hero: S.opt(S.ref('display')) }), level: bind(base.level) }
    },
  })
}
