// The intro figures content calls (capabilities.json figure): each item with its parameters → a board scene
// (../model/scene.js), which ui/svg.js draws.

import { callOf } from 'kernel';
import { E, circuitFig, gridScene, windowFig } from '../model/robot-scene.js';
import { expandScene } from '../model/robot-scene.js';

const FIGURES = {
  scene: expandScene,
  /** A grid: arrows right and down (or by `moves`, [dr, dc] each; none with arrows: false), cells and arrows written
   *  apart over the plain ones. */
  grid({ R, C, arrows = true, moves, cells = {}, edges = {}, robot }) {
    const g = gridScene(R, C, { arrows: false, cell: (r, c) => cells[`${r},${c}`] });
    const steps = moves ?? (arrows ? [[0, 1], [1, 0]] : []);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) for (const [dr, dc] of steps) {
      const a = `${r},${c}`, b = `${r + dr},${c + dc}`;
      if (r + dr >= 0 && r + dr < R && c + dc >= 0 && c + dc < C) g.edges.push(E(a, b, edges[`${a}>${b}`] ?? 'dim'));
    }
    return robot === undefined ? g : { ...g, robot };
  },
  circuit: ({ taps, parts, outs, wires }) => circuitFig({
    taps: taps.map(x => [x.id, x.label, x.kind]),
    parts: parts.map(x => [x.id, x.name, x.tag, x.row]),
    outs: outs.map(x => [x.id, x.label]),
    wires: wires.map(x => [x.from, x.to, x.kind]),
  }),
  window: ({ vals, on }) => windowFig(vals, on),
}

/** The scene a figure item draws. */
export function figure(call) {
  const [name, params] = callOf(call);
  return FIGURES[name.split('/').at(-1)](params);
}

/** Project compact introduction scenes to the same cells used by the save stamp. */
export function expandIntroScenes(pages) {
  return pages.map(page => {
    if (!page.fig) return page
    const [name, scene] = callOf(page.fig)
    return name.split('/').at(-1) === 'scene' && scene?.grid ? { ...page, fig: { [name]: expandScene(scene) } } : page
  })
}
