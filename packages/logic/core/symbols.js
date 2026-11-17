import { unasciiOf } from './formula.js'

// Syntax is a domain resource. The game supplies the names, descriptions and IDs of the symbols that use it.
export const symbolFor = Object.fromEntries(Object.entries({
  formulaNot: '¬', formulaAnd: '∧', formulaOr: '∨', formulaImplies: '→', formulaIff: '↔',
  formulaFalse: '⊥', formulaForall: '∀', formulaExists: '∃',
}).map(([name, symbol]) => [`logic:mark-${name}`, symbol]))

// The sentence strip's order is defined by the logic marks, independent of circuit trays.
const stripOrder = ["logic:mark-formulaForall", "logic:mark-formulaExists", "logic:mark-formulaNot", "logic:mark-formulaAnd", "logic:mark-formulaOr", "logic:mark-formulaImplies", "logic:mark-formulaIff", "logic:mark-formulaFalse"]

export function symbolsAt(symbols, course, level, standalone = false) {
  const byMark = new Map(Object.values(symbols).map(symbol => [symbol.mark, symbol]))
  return stripOrder.map(mark => byMark.get(mark)).filter(symbol =>
    symbol && (standalone || !symbol.at || level === symbol.at || course.before(symbol.at, level)))
}

export function unavailableSymbols(task, symbols, available) {
  if (!['logic:translate', 'logic:query'].includes(task.kind)) return []
  const text = unasciiOf(task.target)
  const known = new Set(available.map(symbol => symbol.mark))
  return Object.values(symbols).filter(({ mark }) => !known.has(mark) && symbolFor[mark] && text.includes(symbolFor[mark]))
}
