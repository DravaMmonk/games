import { packed } from 'circuit'
import { qualifyItems } from 'kernel'
import declarations from '../capabilities/operation.json' with { type: 'json' }

export const operations = qualifyItems('tick', {
  held: {
    ...declarations.items.held,
    run: (_args, { reg, start }, ctx) => {
      const value = ctx?.held?.(`${ctx.scope ?? ''}${reg}`)
      return value === undefined ? start : value
    },
  },
  keep: {
    ...declarations.items.keep,
    run: ([value]) => value,
    circuitPart: settingsOf => ({
      sink: true,
      collect: inputs => inputs.in,
      register: node => settingsOf(node).reg,
    }),
  },
})

export const keepsState = part => Boolean(part?.register || part?.keepsState)

/** Collect successful register writes in board order, including explicit null values. */
export function collectWrites(nodes, partOf, values, writes, scope = '') {
  for (const node of nodes) {
    const register = partOf(node.type)?.register
    if (register && values.has(node.id)) writes.set(`${scope}${register(node)}`, values.get(node.id))
  }
}

export const packRegisters = options => packed({
  ...options,
  keepsState: true,
  effects: {
    __state({ inner, run, partOf, node, ctx }) {
      const targets = inner.nodes.filter(card => keepsState(partOf(card.type))).map(card => card.id)
      const { values } = run(targets)
      if (ctx.stores) collectWrites(inner.nodes, partOf, values, ctx.stores, `${ctx.scope ?? ''}${node.id}/`)
      return null
    },
  },
})
