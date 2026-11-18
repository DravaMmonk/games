import { T } from '../lang.js'
export const TAGS = ['N', 'V', 'A'];
export const TAG = { N: { n: T('名词', 'noun'), s: T('名', 'N') }, V: { n: T('动词', 'verb'), s: T('动', 'V') }, A: { n: T('形容词', 'adjective'), s: T('形', 'A') } };
export function bestTags(t) {
  let best = null;
  (function go(k, prev, acc, cost) {
    if (k === t.words.length) { if (!best || cost < best.cost) best = { tags: acc, cost }; return; }
    TAGS.forEach(g => { const e = t.emit[k][g]; if (e === undefined) return; go(k + 1, g, [...acc, g], cost + e + (k ? t.trans[prev][g] : t.start[g])); });
  })(0, null, [], 0);
  return best;
}
