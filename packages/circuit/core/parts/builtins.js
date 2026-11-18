import { qualifyItems } from 'kernel'
import declarations from '../../capabilities/operation.json' with { type: 'json' }

export const BUILTIN_ITEMS = qualifyItems('circuit', declarations.items)

// These operations are tied to lazy branches and circuit register state.
export const BUILTINS = qualifyItems('circuit', {
  if: { ...declarations.items.if, run: ([condition, yes, no]) => condition ? yes : no },
  held: { ...declarations.items.held, run: (_args, { reg: register, start }, ctx) => {
    const held = ctx?.held?.(`${ctx.scope ?? ''}${register}`)
    return held === undefined ? start : held
  } },
})
