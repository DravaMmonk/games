import { T as catalogText } from 'kernel/words'
// Parts that learn (视觉完备 chapter 4): learnable kernels, dense layers and constants, the sigmoid, the larger of
// two, many channels and residual blocks.
import { image, map, random, zip } from 'imglib'
import { conv3, convRgb, residualConv } from 'cvlib'
import { affine, sigmoid } from 'mllib'

// A trained layer starts from small random numbers (seeded, so every new layer starts the same way).
const CONV_INIT = (() => {
  const next = random(5)
  return Array.from({ length: 9 }, () => Math.round((next() * 2 - 1) * 0.02 * 1e4) / 1e4)
})()

export const LEARNING = {
  lrnConv: {
    label: catalogText("卷积层"),
    description: catalogText("可学习 3×3 核，从一组很小的随机数开始"),
    inputs: ['in'],
    params: [{ key: 'w', label: catalogText("权重"), kind: 'kernel', learnable: true, default: CONV_INIT }],
    eval: ({ in: a }, p) => conv3(a, p.w ?? CONV_INIT),
    cost: 9,
  },
  lrnDense: {
    label: catalogText("全连接 w·x + b"),
    description: catalogText("可学习的权重 w 和偏置 b"),
    inputs: ['in'],
    params: [{ key: 'p', label: 'w, b', kind: 'kernel', learnable: true, default: [1, 0] }],
    eval: ({ in: a }, p) => map(a, v => affine(v, p.p?.[0] ?? 1, p.p?.[1] ?? 0)),
    cost: 2,
    unlock: 'dense',
  },
  lrnSigmoid: {
    label: 'Sigmoid',
    description: catalogText("1 / (1 + e⁻ˣ)，把任意数压到 0…1"),
    inputs: ['in'],
    eval: ({ in: a }) => map(a, sigmoid),
    cost: 2,
    unlock: 'sigmoid',
  },
  lrnConst: {
    label: catalogText("可学习常数"),
    description: catalogText("一个由训练决定的数。和一张图相加、相乘时，它用在每一格上"),
    inputs: [],
    params: [{ key: 'p', label: catalogText("值"), kind: 'kernel', learnable: true, default: [1] }],
    eval: (_, p) => image(1, 1, p.p?.[0] ?? 1),
    cost: 0,
  },
  max: {
    label: catalogText("取较大"),
    description: catalogText("两张图逐格取较大的那个"),
    inputs: ['a', 'b'],
    eval: ({ a, b }) => zip(a, b, Math.max),
    cost: 1,
    unlock: 'max',
  },
  // Earned by solving 4-5 and 4-7.
  lrnRgb: {
    label: catalogText("多通道 3×3 核"),
    description: catalogText("一个核横跨 R、G、B：3×3×3 个可学习权重"),
    inputs: ['r', 'g', 'b'],
    params: [{ key: 'w', label: catalogText("权重"), kind: 'kernel', learnable: true, default: Array(27).fill(0) }],
    eval: ({ r, g, b }, p) => convRgb(r, g, b, p.w ?? Array(27).fill(0)),
    cost: 29,
    unlock: 'lrn-rgb',
  },
  lrnRes: {
    label: catalogText("残差块"),
    description: catalogText("输出 = 输入 + 卷积层(输入)"),
    inputs: ['in'],
    params: [{ key: 'w', label: catalogText("权重"), kind: 'kernel', learnable: true, default: CONV_INIT }],
    eval: ({ in: a }, p) => residualConv(a, p.w ?? CONV_INIT),
    cost: 10,
    unlock: 'lrn-res',
  },
}

