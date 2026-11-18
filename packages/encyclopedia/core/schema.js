import { S } from 'kernel'

/** A game's encyclopedia (the shell's glossary): groups, and entries opening at a level (`at`) and linking others. */
export const GLOSSARY = S.obj({
  englishNamesInChinese: S.opt(S.bool()),
  groupByChapter: S.opt(S.bool()),
  groups: S.list(S.obj({ id: S.str(), title: S.text(), values: S.opt(S.list(S.name('entry'))) })),
  entries: S.list(S.obj({ id: S.str(), group: S.opt(S.name('group')), title: S.text(), aliases: S.opt(S.list(S.text(), { min: 1 })), body: S.list(S.text()), at: S.opt(S.level()), see: S.opt(S.list(S.name('entry'))) })),
})

