// The games hub: one row per published game, with the player's progress, under the shared kit's top bar and hero
// (kit/ui.css, kit/bar.js).

import { GAMES } from 'virtual:game-catalog';
import { currentLang, tr } from './kit/lang.js';
import { paintText } from './kit/bar.js';
import { mountHubBar } from './hub-bar.jsx';
import { applyTheme, currentTheme } from './kit/theme.js';
import { solvedCount } from './kit/shell/progress.js';
import { mountBoxy } from '../packages/state-graph/view/boxy.js';
import { mountPress } from './press/press.js';
import { mountDetach } from 'qed/view';

// Card art: each game's illustration, mounted live into its row. The anatomy-kit figures are built into plain modules
// for this page (each folder's build.mjs): State Graph's robot Boxy, Vision Complete's filter press, Q.E.D.'s Detach
// press.
const ART = { grid: mountBoxy, pipeline: mountPress, detach: mountDetach };
let unmount = [];

function render() {
  const en = currentLang() === 'en', pick = x => (typeof x === 'string' ? x : en ? x.en : x.zh);
  document.querySelector('#games').innerHTML = GAMES.filter(g => !g.hidden).map(g => {
    const done = Math.min(solvedCount(g.id), g.levels), started = done > 0;
    return `<article class="game">
      <div class="game-art"${g.art ? ` data-art="${g.art}"` : ''}></div>
      <a class="game-body" href="${g.id}/index.html" aria-labelledby="game-title-${g.id}">
        <p class="game-meta">${pick(g.topic)}${g.dev ? `<em class="dev-tag">${tr("开发中")}</em>` : ''}${g.author ? `<span class="game-author">${tr("作者")} <b>${g.author}</b></span>` : ''}</p>
        <h2 class="game-title"><span id="game-title-${g.id}">${pick(g.title)}</span><small lang="${en ? 'zh-CN' : 'en'}">${en ? g.title.zh : g.title.en}</small></h2>
        <p class="game-desc">${pick(g.lede)}</p>
        <div class="game-foot">
          <span class="meter" aria-hidden="true"><i style="width:${(done / g.levels) * 100}%"></i></span>
          <span class="game-count">${tr("{done} / {levels} 关", {done, levels: g.levels})}</span>
          <b class="game-go">${started ? tr("继续") : tr("开始")}<span aria-hidden="true">→</span></b>
        </div>
      </a></article>`;
  }).join('');
  unmount.forEach(stop => stop());
  unmount = [...document.querySelectorAll('#games [data-art]')].map(el => ART[el.dataset.art](el, { lang: currentLang() }));
}

function paintPage() {
  document.title = tr("图灵模拟器 · Turing Simulator");
  document.querySelector('meta[name="description"]').content = tr("图灵模拟器：把所有知识地图变成图灵完备风格的游戏。视觉完备（计算机视觉）、状态之图（动态规划）、证明完毕（形式化证明）。");
}

mountHubBar(document.querySelector('#hub-bar'));
addEventListener('langchange', () => { paintText(); paintPage(); render(); });
applyTheme(currentTheme());
paintText();
paintPage();
render();
// Progress may change in another tab.
addEventListener('pageshow', render);
