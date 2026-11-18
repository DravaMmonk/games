// The Hough voting bench: edge points vote for every line (θ, ρ) through them; the player picks a bin size and wins
// when, in every scene, the two strongest peaks are the scene's two lines.

import { benchRun } from 'image'
import { houghBench, houghScene } from 'computer-vision'
import { T as t } from 'kernel'

const NAMES = ['A', 'B']

/** The bench model: knob `bin` (an index into [Δθ°, Δρ] bin sizes); each case a scene; matched: lines found. */
export const hough = {
  make({ rhoMax, tol }, bench) {
    const scenes = bench.cases.map(({ label, seed, lines, outliers }) => ({ label, lines, points: houghScene(seed, lines, outliers) }))
    const steps = bench.knobs.bin.values
    const m = houghBench({ scenes, steps, rhoMax, tol })
    return {
      ...m,
      view(v, { caseIndex }) {
        const scene = scenes[caseIndex]
        const run = m.run(scene, v.bin)
        const [dTheta, dRho] = steps[v.bin]
        return {
          matched: run.matched,
          scene,
          run,
          bin: [dTheta, dRho],
          dTheta: `${dTheta}°`,
          dRho: `${dRho} px`,
          cells: `${run.acc.nT}×${run.acc.nR}`,
          peaksTitle: [scene.label, ' · ', t('票数最高的峰')],
          peaks: {
            head: [t('峰'), 'θ', 'ρ', t('票数'), t('匹配')],
            rows: run.peaks.slice(0, 3).map((p, i) => {
              const hit = run.found.indexOf(i)
              return { dim: i >= 2, cells: [String(i + 1), `${p.theta.toFixed(1)}°`, p.rho.toFixed(1), String(p.votes), i < 2 ? { text: hit >= 0 ? NAMES[hit] : '—', tone: hit >= 0 ? 'pass' : 'fail' } : ''] }
            }),
          },
          tolerance: t(`容差 ${tol.theta}°、${tol.rho} px。`, `Tolerance ${tol.theta}°, ${tol.rho} px.`),
        }
      },
    }
  },
  verify(model, bench) {
    const { steps, rhoMax } = model
    const pattern = steps.map((_, bin) => benchRun(bench, model, { bin }).pass)
    if (!pattern.some(Boolean)) return 'no bin size passes every scene'
    if (pattern[0] || pattern[1]) return 'the finest bins pass'
    if (pattern.at(-1) || pattern.at(-2)) return 'the coarsest bins pass'
    // Coarse bins must fail because the two rails fall into one cell or neighbouring cells: one peak.
    const [dTheta, dRho] = steps.at(-1)
    const [a, b] = model.scenes[0].lines
    const cell = (line) => [Math.floor(line.theta / dTheta), Math.floor((line.rho + rhoMax) / dRho)]
    const [ca, cb] = [cell(a), cell(b)]
    if (Math.abs(ca[0] - cb[0]) > 1 || Math.abs(ca[1] - cb[1]) > 1) return 'coarse bins still separate the two rails'
    if (model.run(model.scenes[0], steps.length - 1).matched > 1) return 'coarse bins find both rails'
    return ''
  },
}
