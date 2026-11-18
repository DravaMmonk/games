import { T as catalogText } from 'kernel/words'
export const vocabulary = {
  "module": "rows",
  "kinds": {
    "kind": {
      "rows/equation": {
        "about": {
          "zh": "补齐等式右边的加法式"
        }
      }
    }
  },
  "languages": {
    "rows/sum": {
      "about": catalogText("由整数和加号组成的等式右边")
    }
  }
}

export const meaning = {
  type: 'level', read: value => value,
  vocabulary(base) {
    const kinds = { ...base.kinds }
    for (const [kind, items] of Object.entries(vocabulary.kinds)) kinds[kind] = { ...kinds[kind], ...items }
    return { ...base, kinds, languages: { ...base.languages, ...vocabulary.languages } }
  },
}
