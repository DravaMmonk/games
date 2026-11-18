// Figures available to game introductions.
export const figures = {
  'conv-press': () => import('./conv/figure.js'),
  'ransac-pegboard': () => import('./ransac/figure.js'),
  'surface-bump': () => import('./surface-bump/figure.js'),
}
