import { unasciiOf } from './formula.js'

import marksSource from '../capabilities/mark.json' with { type: 'json' }

import { readCopy } from 'kernel/words'

const marks = readCopy(marksSource)

const stripOrder = Object.entries(marks.items).sort(([, a], [, b]) => a.order - b.order).map(([name]) => `logic/${name}`)
export const symbolFor = Object.fromEntries(Object.entries(marks.items).map(([name, { symbol }]) => [`logic/${name}`, symbol]))

export function symbolsAt(symbols, course, level, standalone = false) {
  const byMark = new Map(Object.values(symbols).map(symbol => [symbol.mark, symbol]))
  return stripOrder.map(mark => byMark.get(mark)).filter(symbol =>
    symbol && (standalone || !symbol.at || level === symbol.at || course.before(symbol.at, level)))
}

export function unavailableSymbols(task, symbols, available) {
  if (!['logic/translate', 'logic/query'].includes(task.kind)) return []
  const text = unasciiOf(task.target)
  const known = new Set(available.map(symbol => symbol.mark))
  return Object.values(symbols).filter(({ mark }) => !known.has(mark) && symbolFor[mark] && text.includes(symbolFor[mark]))
}
