export * from './attention.js'
export * from './layers.js'
export { gradientStep } from './optimization.js'
export { gaussian } from './sampling.js'

/** Compare gradient descent checkpoints and ridge fits on a seeded polynomial fitting problem. */
export { stopBench } from './curve-fit.js'

export function register() {}
