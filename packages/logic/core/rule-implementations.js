/** Adapt rule inputs, including any frame regions, from positional values to named premises. */
export function ruleImplementations(bodies) {
  return Object.fromEntries(Object.entries(bodies).map(([type, body]) => [type, {
    run(values, _named, ctx) {
      const inputs = Object.fromEntries(body.inputs.map((name, index) => [name, values[index]]))
      return body.eval(inputs, ctx.node, ctx, ctx.key ?? undefined)
    },
  }]))
}
