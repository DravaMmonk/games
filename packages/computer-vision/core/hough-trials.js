import { approximateNormal, random } from 'image-processing'
import { houghAccumulate, houghPeaks, lineGap, pointAlongLine, polarLine } from './match.js'

/** Points along `lines` ({ theta°, rho, n, from?, to? }) with noise `sigma`, plus `outliers` scattered points. */
export function houghScene(seed, lines, outliers, sigma = 0.7) {
  const next = random(seed)
  const points = []
  for (const { theta, rho, n, from = -22, to = 22 } of lines) {
    const line = polarLine(theta, rho)
    for (let i = 0; i < n; i++) {
      const s = from + ((to - from) * (i + next())) / n
      const [x, y] = pointAlongLine(line, s, approximateNormal(next) * sigma)
      if (Math.abs(x) <= 24 && Math.abs(y) <= 24) points.push([x, y])
    }
  }
  for (let i = 0; i < outliers; i++) points.push([(next() - 0.5) * 48, (next() - 0.5) * 48])
  return points
}

// The peak's line is the vote-weighted centre of its 3×3 cells (a common sub-bin refinement).
function refinePeak(acc, peak) {
  const { votes, nT, nR, dTheta, dRho, rhoMax } = acc
  let sw = 0
  let st = 0
  let sr = 0
  for (let dr = -1; dr <= 1; dr++) {
    for (let dt = -1; dt <= 1; dt++) {
      const r = peak.r + dr
      const t = peak.t + dt
      if (r < 0 || r >= nR || t < 0 || t >= nT) continue
      const v = votes[r * nT + t]
      sw += v
      st += v * (t + 0.5) * dTheta
      sr += v * ((r + 0.5) * dRho - rhoMax)
    }
  }
  return { ...peak, theta: st / sw, rho: sr / sw }
}

/**
 * The bench's model. scenes: [{ label, lines, points }]; steps: the bin-size dial, [Δθ°, Δρ] per step; rhoMax: the
 * accumulator's reach; tol: { theta, rho } how close a peak must come to a line.
 */
export function houghBench({ scenes, steps, rhoMax, tol }) {
  function run(scene, step) {
    const [dTheta, dRho] = steps[step]
    const acc = houghAccumulate(scene.points, dTheta, dRho, rhoMax)
    const peaks = houghPeaks(acc, 3).map((p) => refinePeak(acc, p))
    const top = peaks.slice(0, 2)
    const used = new Set()
    const found = scene.lines.map((line) => {
      const index = top.findIndex((p, i) => {
        if (used.has(i)) return false
        const gap = lineGap(p, line)
        return gap.dTheta <= tol.theta && gap.dRho <= tol.rho
      })
      if (index >= 0) used.add(index)
      return index
    })
    return { acc, peaks, found, matched: found.filter((i) => i >= 0).length }
  }
  return { scenes, steps, run, rhoMax, tol }
}
