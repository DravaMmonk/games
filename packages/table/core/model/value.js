const has = (list, r, c) => (list || []).some(p => p[0] === r && p[1] === c);
/** How likely the floor at (r, c) is to make you slip: an icy cell's own chance (t.ice: [[r, c, p]]), else the map's
 *  (t.slip), else 0. */
export const slipAt = (t, r, c) => (t.ice || []).find(p => p[0] === r && p[1] === c)?.[2] ?? t.slip ?? 0;
/** What stands on a cell: 'gold' (10), 'trap' and 'cliff' (−10), 'wall' (nobody enters), or 'floor'. */
export function tileAt(t, r, c) {
  if (t.gold[0] === r && t.gold[1] === c) return 'gold';
  if (has(t.traps, r, c)) return 'trap';
  if (has(t.cliffs, r, c)) return 'cliff';
  if (has(t.walls, r, c)) return 'wall';
  return 'floor';
}
export const FIXED = { gold: 10, trap: -10, cliff: -10, wall: null };
/**
 * The robot's best move from every floor cell once the values have settled: to the best neighbour, or, on a map where
 * it only moves right or down (o.slip(r, c) = the chance to slide the other way, 0 on firm ground), the move whose
 * expected value is best. Returns [[from, to]].
 */
export function policy(t, table, o = {}) {
  const v = (r, c) => (r >= 0 && c >= 0 && r < t.R && c < t.C ? table.get(`${r},${c}`) ?? null : null), out = [];
  for (let r = 0; r < t.R; r++) for (let c = 0; c < t.C; c++) {
    if (tileAt(t, r, c) !== 'floor') continue;
    const p = o.slip ? o.slip(r, c) : 0, mix = (a, b) => (a === null || b === null ? null : (1 - p) * a + p * b);
    const moves = o.slip ? [[r, c + 1, mix(v(r, c + 1), v(r + 1, c))], [r + 1, c, mix(v(r + 1, c), v(r, c + 1))]]
      : [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].map(([y, x]) => [y, x, v(y, x)]);
    const ok = moves.filter(m => m[2] !== null);
    if (!ok.length) continue;
    const best = ok.reduce((a, b) => (b[2] > a[2] ? b : a));
    out.push([`${r},${c}`, `${best[0]},${best[1]}`]);
  }
  return out;
}

/** The settled values of a map without slipping: every floor cell = γ × its best neighbour, scanned until nothing changes. */
export function settle(t, gamma = 0.9) {
  const table = new Map(valueBase(t)), v = (r, c) => (r >= 0 && c >= 0 && r < t.R && c < t.C ? table.get(`${r},${c}`) : null);
  for (let moved = true; moved;) {
    moved = false;
    valueOrder(t).forEach(({ r, c, id }) => {
      const n = [v(r - 1, c), v(r + 1, c), v(r, c - 1), v(r, c + 1)].filter(x => x !== null && x !== undefined);
      const x = n.length ? Math.round(gamma * Math.max(...n) * 1e9) / 1e9 : null;
      if (x !== table.get(id)) { table.set(id, x); moved = true; }
    });
  }
  return table;
}

export const valueBase = t => { const b = []; for (let r = 0; r < t.R; r++) for (let c = 0; c < t.C; c++) { const k = tileAt(t, r, c); b.push([`${r},${c}`, k === 'floor' ? 0 : FIXED[k]]); } return b; }
export const valueOrder = t => { const o = []; for (let r = 0; r < t.R; r++) for (let c = 0; c < t.C; c++) if (tileAt(t, r, c) === 'floor') o.push({ r, c, id: `${r},${c}` }); return o; }
