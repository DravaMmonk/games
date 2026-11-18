import { T as catalogText } from 'kernel/words'
import { circuitReports } from 'circuit'
import { runLevel } from './run.js'

export const vocabulary = {
  "module": "tick",
  "kinds": {
    "operation": {},
    "family": {
      "tick/value": {
        "about": catalogText("算数的元件")
      },
      "tick/memory": {
        "about": catalogText("读写寄存器的元件")
      }
    },
    "tick/want": {
      "tick/line": {
        "about": catalogText("这一拍线上的位")
      },
      "tick/delayed": {
        "about": catalogText("输入 input 上一拍的值；第一拍给 first"),
        "params": {
          "type": "obj",
          "fields": {
            "input": {
              "type": "str"
            },
            "first": {
              "type": "int"
            }
          }
        }
      }
    }
  },
  "languages": {}
}

export const meaning = {
  type: 'level', read: value => value,
  baselineReportPriority: 1,
  baselineReports: context => circuitReports(context, runLevel),
  vocabulary(base) {
    const kinds = { ...base.kinds }
    for (const [kind, items] of Object.entries(vocabulary.kinds)) kinds[kind] = { ...kinds[kind], ...items }
    return { ...base, kinds, capabilities: { ...base.capabilities, ...Object.fromEntries(Object.keys(vocabulary.kinds).map(kind => [kind, kinds[kind]])) }, languages: { ...base.languages, ...vocabulary.languages } }
  },
}
