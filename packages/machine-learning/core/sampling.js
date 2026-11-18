export function gaussian(next) {
  // Box–Muller from a seeded uniform source.
  const u = Math.max(1e-9, next())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next())
}
