// A judge reads a work and returns null or its first failure: { at?, check?, want?, got?, why }.
// Case indexes are zero-based. The package defines its own failure locations.
const equal = (want, got) => want === got

export function firstFailure(checks, inspect) {
  for (const [check, example] of checks.entries()) {
    const fail = inspect(example, check)
    if (fail) return { ...fail, check }
  }
  return null
}

export const cases = (checks, inspect) =>
  Object.assign((work) => firstFailure(checks, (example, check) => inspect(work, example, check)), { checks })

export const property = (holds, failure) => (work) => holds(work) ? null : failure(work)

export function sameAs(want, { got = (work) => work, same = equal, at, why }) {
  return (work) => {
    const actual = got(work)
    return same(want, actual) ? null : { ...(at === undefined ? {} : { at }), want, got: actual, why: why(want, actual) }
  }
}

export function inOrder(...judges) {
  const judge = (work) => {
    for (const inspect of judges) {
      const fail = inspect(work)
      if (fail) return fail
    }
    return null
  }
  return Object.assign(judge, { checks: judges.flatMap((inspect) => inspect.checks ?? []) })
}

// Hide the examples from the presentation while still judging them and reporting the first failure.
export const hidden = (judge) => Object.assign((work) => judge(work), { checks: [] })
