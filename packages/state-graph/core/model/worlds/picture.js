import { energy, shade } from 'table'
// Pictures as tables: every cell is a pixel. A pixel's energy is how much it differs from its neighbours (an edge is
// high, a flat background is low); a seam is a path from the top row to the bottom, one pixel per row, each step to
// the pixel below, below-left or below-right. Removing the seam with the least energy narrows the picture by one
// column without cutting through what stands out in it.

import { rcName } from 'table';
import { tr } from 'kernel/words'
import { T } from '../../words.js'
import { world, look, num, yes } from 'table';
import { gridDef } from './grid.js';

/** A test's energies: given outright (t.energy, for a small picture of plain numbers), or worked out from its pixels. */
const energyOf = t => t.energy || energy(t.img);

export const pic = world({
  ...gridDef,
  sensors: { ul: gridDef.sensors.ul, up: gridDef.sensors.up, ur: gridDef.sensors.ur, left: gridDef.sensors.left, right: gridDef.sensors.right, dl: gridDef.sensors.dl, down: gridDef.sensors.down, dr: gridDef.sensors.dr, energy: num(T("本格能量"), T("能"), 'pixel'), top: yes(T("是顶行"), T("顶"), 'toprow') },
  facts: ['energy', 'top'],
  mark: (t, key) => { const [r, c] = key.split(',').map(Number); return { corner: energyOf(t)[r][c] }; },
  sense: (t, { r, c }, id) => (id === 'top' ? r === 0 : energyOf(t)[r][c]),
  answerKeys: t => Array.from({ length: t.C }, (_, c) => `${t.R - 1},${c}`),
  answer(t, table) { return Math.min(...this.answerKeys(t).map(k => table.get(k) ?? Infinity)); },
  label: t => tr("{C}×{R} 像素", {C: t.C, R: t.R, value: t.C * t.R > 1 ? 's' : ''}),
  orderText: () => tr("逐行，从顶行往下"),
  scene(t, view, o) {
    const g = look(view, [], [], o.bench), sp = 46, sz = 40, px = 13, cells = [], path = new Set(o.path || []);
    // The picture itself, small, to the left of its table (a test of plain energies has none).
    const x0 = -(t.C * px) - 40;
    (t.img || []).forEach((row, r) => row.forEach((v, c) => cells.push({ id: `p${r},${c}`, x: x0 + c * px, y: r * px, w: px, h: px, rx: 1, value: '', fill: shade(v), cls: path.has(`${r},${c}`) ? 'cut' : 'px' })));
    for (let r = 0; r < t.R; r++) for (let c = 0; c < t.C; c++) {
      const id = `${r},${c}`;
      cells.push({ id, x: c * sp, y: r * sp, w: sz, h: sz, rx: 8, value: g.val(id), corner: this.mark(t, id).corner, cls: [g.cls(id), path.has(id) ? 'path' : ''].filter(Boolean).join(' '), tap: g.tap(id), aria: rcName(id) });
    }
    return { cells, edges: g.arrows(), robot: g.robot };
  },
});

const GLYPHS = { T: ['#####', '..#..', '..#..', '..#..', '..#..'], L: ['#....', '#....', '#....', '#....', '#####'], O: ['.###.', '#...#', '#...#', '#...#', '.###.'], X: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'] };
/** A grey picture: a faintly grainy background (1–2) with bright letters (8) drawn on it. */
export function picture(w, h, letters, seed = 7) {
  let s = seed;
  const grain = () => { s = (s * 1103515245 + 12345) % 2147483648; return s % 5 === 0 ? 2 : 1; };
  const img = Array.from({ length: h }, () => Array.from({ length: w }, grain));
  letters.forEach(([ch, x0, y0]) => GLYPHS[ch].forEach((row, y) => [...row].forEach((p, x) => { if (p === '#') img[y0 + y][x0 + x] = 8; })));
  return img;
}

