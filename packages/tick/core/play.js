import { tickPlay } from './tick-play.js'
import { checked, runLevel } from './run.js'
import { joinCopy } from 'kernel'
import { T } from 'kernel/words'

export const play = tickPlay({
  run: runLevel,
  given: (L) => joinCopy([
    ...(L.listens ? [T('line：这一拍线上的位')] : []),
    ...(L.inputs ?? []).map(({ name, label }) => T('{name}：输入「{label}」', { name, label })),
    ...(L.talks ? [T('say：接到这里的位这一拍说到线上，每一拍检查')] : []),
    ...(L.outputs ?? []).map(({ name, label }) => T('{name}：输出「{label}」，每一拍检查', { name, label })),
  ], '\n'),
  lanes: (L, test) => {
    const want = L.want(test)
    return [
      ...(L.listens ? [{ name: 'line', ticks: test.line, text: (v) => (v === undefined ? '.' : String(v)) }] : []),
      ...(L.inputs ?? []).map((i) => ({ name: i.name, ticks: test.inputs[i.name] })),
      ...checked(L).map((o) => ({ name: o.name, ticks: want[o.name], wanted: true })),
    ]
  },
})
