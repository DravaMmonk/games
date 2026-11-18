import { T as catalogText } from 'kernel/words'
// Parts for frequency (视觉完备 chapter 2): a wave of 32 points, the spectrum, a low-pass in the frequency domain and
// multiplying a picture's frequencies by a gain picture.
import { applyGain, lowpass, magnitudeSpectrum, row, sampleAt, sinusoid } from 'imglib'

const N = 32

export const FREQUENCY = {
  fqWave: {
    label: catalogText("波"),
    description: catalogText("一道 32 个点的波：cos 或 sin(2π·k·x/32)，在 −1 和 1 之间摆动"),
    inputs: [],
    params: [
      { key: 'k', label: catalogText("频率 k"), kind: 'number', min: 0, max: 16, step: 1, default: 1 },
      { key: 'form', label: catalogText("形状"), kind: 'select', options: [['cos', 'cos'], ['sin', 'sin']], default: 'cos' },
    ],
    eval: (_, p) => row(sampleAt(sinusoid(Number(p.k ?? 1), p.form), N)),
    cost: 2,
    unlock: 'wave',
  },
  fqSpectrum: {
    label: catalogText("频谱"),
    description: catalogText("中心化、取对数的幅度谱：中心是平均亮度，越往外变化越快"),
    inputs: ['in'],
    eval: ({ in: a }) => magnitudeSpectrum(a),
    // A forward 2-D FFT costs about 2·log2(N²) complex multiply-adds per pixel; 20 at 32×32.
    cost: 20,
    unlock: 'spectrum',
  },
  fqLowpass: {
    label: catalogText("频域低通"),
    description: catalogText("变换到频域，乘一个以中心为圆心的掩膜，再变换回来"),
    inputs: ['in'],
    params: [
      { key: 'shape', label: catalogText("掩膜"), kind: 'select', options: [['disk', catalogText("硬圆盘")], ['gauss', catalogText("高斯")]], default: 'disk' },
      { key: 'R', label: catalogText("半径 R"), kind: 'number', min: 0.5, max: 16, step: 0.5, default: 8 },
    ],
    eval: ({ in: a }, p) => lowpass(a, p.shape ?? 'disk', Number(p.R ?? 8)),
    // Forward and inverse FFT plus the mask multiply.
    cost: 40,
    unlock: 'freq-filter',
  },
  fqApply: {
    label: catalogText("频域相乘"),
    description: catalogText("把图变到频域，每个频率乘上增益图里对应格子的数，再变回来。增益图和频谱画法一样：中心是频率 (0, 0)"),
    inputs: ['in', 'gain'],
    eval: ({ in: a, gain }) => applyGain(a, gain),
    // A forward and an inverse FFT plus the multiply.
    cost: 40,
  },
}

