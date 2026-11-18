import { robotOf } from './robots.js'
import { T } from '../lang.js'
export { N, E, gridScene, circuitFig, windowFig } from './scene.js'
/** Words drawn on boards by several figures and worlds. */
export const W = {
  key: T('钥匙', 'key'), door: T('门', 'door'), start: T('起', 'S'), end: T('终', 'E'), empty: T('空', '∅'),
  capacity: T('容量', 'capacity'),
};

/** Expand a regular grid in drawing order, after any freely positioned cells. */
export function expandScene(scene) {
  const { grid, cells: positioned = [], ...annotations } = scene
  if (!grid) return scene
  const { w, h, x = 0, y = 0, dx = w, dy = h, rows, palette = {} } = grid
  const cells = [...positioned]
  for (const [r, row] of rows.entries()) {
    for (const [c, entry] of [...row].entries()) {
      if (entry === ' ') continue
      const cell = typeof entry === 'string' ? palette[entry] : entry
      if (!cell) throw new Error(`unknown scene grid marker ${JSON.stringify(entry)} at row ${r + 1}, column ${c + 1}`)
      cells.push({ id: `${r},${c}`, x: x + c * dx, y: y + r * dy, w, h, ...cell })
    }
  }
  return { cells, ...annotations }
}

/** A robot model standing in the middle of its field of view. */
export function visionFig(model) {
  const r = robotOf(model), n = 2 * r.vision + 1, sp = n === 3 ? 62 : 48, sz = sp - 8, cells = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const self = x === r.vision && y === r.vision;
    cells.push({ id: self ? 'self' : `${y},${x}`, x: x * sp, y: y * sp, w: sz, h: sz, value: '', cls: self ? 'self' : 'on' });
  }
  return { cells, edges: [], robot: 'self', look: r.look };
}
