/**
 * Adapt rule inputs, including any frame regions, from positional values to named premises. A rule that `binds` takes
 * a particular thing (names.js), and its part says so (`binds`) to the boxes inside it.
 */
export function ruleImplementations(bodies) {
  return Object.fromEntries(Object.entries(bodies).map(([type, body]) => [type, {
    run(values, _named, ctx) {
      const inputs = Object.fromEntries(body.inputs.map((name, index) => [name, values[index]]))
      return body.eval(inputs, ctx.node, ctx, ctx.key ?? undefined)
    },
    ...(body.binds && { circuitPart: () => ({ binds: true }) }),
  }]))
}
