// A shared row-of-pixels wave bench, judged by the same parameter-bench runner as its view.
import { openKnobs, startValues } from '../bench.js'
import { piText } from '../engine/pi.js'
import { cosine, maxDiff, sampleAt } from 'imglib'

/* ---------- 一道波: c + A·cos(2π·k·x/N + φ·π/4) ---------- */

const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2))
const phaseText = (q) => (q === 0 ? '0' : piText((q * Math.PI) / 4))

export const wave = {
  startsUnsolved: true,
  make({ N }) {
    const curve = (p) => cosine({ ...p, phase: p.phi * 45 })
    return {
      view(v, { stage, open }) {
        const mark = (knob, text) => (open.includes(knob) ? { b: text } : text)
        const phase = phaseText(v.phi)
        const yours = curve(v)
        const target = curve(stage.target)
        const row = sampleAt(yours, N)
        const targetRow = sampleAt(target, N)
        return {
          gap: maxDiff(row, targetRow),
          yours, target, row, targetRow,
          formula: [mark('c', fmt(v.c)), ' + ', mark('A', fmt(v.A)), '·cos(2π·', mark('k', String(v.k)), `·x/${N}${v.phi < 0 ? ' − ' : ' + '}`, mark('phi', v.phi < 0 ? phase.replace('−', '') : phase), ')'],
        }
      },
    }
  },
  verify(_model, bench) {
    for (const [i, s] of bench.stages.entries()) {
      const start = startValues(bench, s)
      for (const [knob, { min, max, step }] of Object.entries(bench.knobs)) {
        for (const v of [start[knob], s.target[knob]]) {
          if (v < min || v > max || Math.abs(min + Math.round((v - min) / step) * step - v) > 1e-9) return `第 ${i + 1} 步的 ${knob} = ${v} 不在刻度上`
        }
        if (!openKnobs(bench, s).includes(knob) && start[knob] !== s.target[knob]) return `第 ${i + 1} 步的 ${knob} 不能转，却和目标不同`
      }
    }
    return ''
  },
}
