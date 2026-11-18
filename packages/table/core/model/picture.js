const at = (img, r, c) => img[Math.max(0, Math.min(img.length - 1, r))][Math.max(0, Math.min(img[0].length - 1, c))];
/** Energy: |right − left| + |below − above|, the picture's edge clamped. */
export const energy = img => img.map((row, r) => row.map((_, c) => Math.abs(at(img, r, c + 1) - at(img, r, c - 1)) + Math.abs(at(img, r + 1, c) - at(img, r - 1, c))));
/** The seam table: each cell = its energy + the smallest of the three cells above it. */
export function seamTable(img) {
  const e = energy(img), f = e.map(row => row.slice());
  for (let r = 1; r < f.length; r++) for (let c = 0; c < f[0].length; c++) f[r][c] = e[r][c] + Math.min(...[c - 1, c, c + 1].filter(x => x >= 0 && x < f[0].length).map(x => f[r - 1][x]));
  return { e, f };
}
/** The cheapest seam, bottom to top: [[r, c]]. */
export function seamPath(img) {
  const { e, f } = seamTable(img), R = f.length, C = f[0].length;
  let c = f[R - 1].indexOf(Math.min(...f[R - 1]));
  const path = [[R - 1, c]];
  for (let r = R - 1; r > 0; r--) {
    c = [c - 1, c, c + 1].filter(x => x >= 0 && x < C).find(x => f[r - 1][x] === f[r][c] - e[r][c]);
    path.push([r - 1, c]);
  }
  return path;
}
export const shade = v => `color-mix(in srgb, var(--ink) ${Math.round(8 + v * 9)}%, var(--chip))`;
