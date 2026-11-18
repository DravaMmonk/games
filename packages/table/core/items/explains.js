// Why a failed test went wrong beyond its numbers (capabilities.json explain): a sentence added to the failure's message,
// in the current language.

import { callOf } from 'kernel';
import { tr } from '../lang.js';

/** Explains: (t, res, o) → text or ''. `res` is the run, `o` the task's settings. */
const EXPLAINS = {
  roll(t, res, o) {
    let item = -1, touched = new Set();
    const s = res.steps.find(x => {
      if (x.cell.item !== item) { item = x.cell.item; touched = new Set(); }
      const hit = touched.has(x.cell.src) && x.writes[0][1] > x.probe['view#old'];
      touched.add(x.cell.w);
      return hit;
    });
    if (t.kind === '01' && s) { const it = t.items[s.cell.item]; return tr("处理「{n}」（{w} kg）时，改 dp[{w2}] 要读 dp[{src}]，可 dp[{src}] 在这一轮已经改过，里面已经放了一个{n}。于是{n}又被放了一次。", {n: it.n, w: it.w, w2: s.cell.w, src: s.cell.src}); }
    if (t.kind === 'inf' && o.dirs.inf === 'desc') return tr("这一题每种东西可以拿很多件。从右往左改写时，dp[w − 重量] 总是旧值，每种东西都只被拿了一次。");
    return '';
  },
}

/** What an explain item adds to a failed test's message. */
export function explain(call, t, res, o) {
  const [name] = callOf(call);
  return EXPLAINS[name.split('/').at(-1)](t, res, o);
}
