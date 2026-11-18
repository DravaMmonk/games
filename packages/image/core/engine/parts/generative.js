import { T as catalogText } from 'kernel/words'
// Parts for drawing what was never seen (视觉完备 chapter 8): an autoencoder that squeezes a blob into a few numbers,
// trained and fixed encoders and decoders, sampling from a latent code and reparameterising it.
import { seedOf } from 'kernel'
import { random, row } from 'imglib'
import { blobAt, decode, DECODER_START, encode, encodeBlobCentre, ENCODER_START } from 'cvlib'
import { gaussian } from 'mllib'

export const GENERATIVE = {
  'dg-encode': {
    label: catalogText("编码器"),
    description: catalogText("把整张图压成一行 k 个数（权重靠训练）"),
    inputs: ['in'],
    params: [
      { key: 'k', label: catalogText("几个数"), kind: 'select', options: [[1, catalogText("1 个")], [2, catalogText("2 个")], [3, catalogText("3 个")]], default: 1 },
      // Content fixes these 48 weights on the card while training can still update them.
      { key: 'w', label: catalogText("权重"), kind: 'kernel', learnable: true, default: ENCODER_START },
    ],
    eval: ({ in: a }, p) => encode(a, p.w ?? ENCODER_START, Number(p.k ?? 1)),
    cost: 16,
    unlock: 'dg-autoencoder',
  },
  'dg-decode': {
    label: catalogText("解码器"),
    description: catalogText("由那几个数画回一张图（权重靠训练）"),
    inputs: ['in'],
    params: [{ key: 'w', label: catalogText("权重"), kind: 'kernel', learnable: true, default: DECODER_START }],
    eval: ({ in: z }, p) => decode(z, p.w ?? DECODER_START),
    cost: 16,
    unlock: 'dg-autoencoder',
  },
  'dg-encoder': {
    label: catalogText("编码器（已训练）"),
    description: catalogText("一个斑点 → 两个数：它在左右、上下的位置"),
    inputs: ['in'],
    eval: ({ in: a }) => encodeBlobCentre(a),
    cost: 16,
    unlock: 'dg-decoder',
  },
  'dg-decoder': {
    label: catalogText("解码器（已训练）"),
    description: catalogText("两个数 → 一个斑点：z₁ 管左右，z₂ 管上下"),
    inputs: ['in'],
    eval: ({ in: z }) => {
      if (z.h !== 1 || z.w !== 2) throw new Error('要两个数')
      return blobAt(z.data[0], z.data[1])
    },
    cost: 16,
    unlock: 'dg-decoder',
  },
  'dg-mu': {
    label: 'μ',
    description: catalogText("两个可训练的数：分布的中心"),
    inputs: [],
    params: [{ key: 'w', label: 'μ', kind: 'kernel', learnable: true, default: [0, 0] }],
    eval: (_, p) => row(p.w ?? [0, 0]),
    cost: 0,
    unlock: 'dg-latent',
  },
  'dg-sigma': {
    label: 'σ',
    description: catalogText("两个可训练的数：分布有多散"),
    inputs: [],
    params: [{ key: 'w', label: 'σ', kind: 'kernel', learnable: true, default: [1, 1] }],
    eval: (_, p) => row(p.w ?? [1, 1]),
    cost: 0,
    unlock: 'dg-latent',
  },
  'dg-sample': {
    label: catalogText("采样 z ~ N(μ, σ²)"),
    description: catalogText("每算一次都重新抽一个随机数"),
    inputs: ['mu', 'sigma'],
    // The draw is seeded by what it is given: μ and σ move on every training step, so each step draws afresh, and the
    // same board on the same test always gives the same verdict.
    eval: ({ mu, sigma }) => {
      const next = random(seedOf(mu.data, sigma.data))
      return row(Array.from(mu.data, (m, i) => m + sigma.data[i] * gaussian(next)))
    },
    cost: 2,
    unlock: 'dg-latent',
  },
  'dg-reparam': {
    label: catalogText("重参数化 μ + σ·ε"),
    description: catalogText("随机只从 ε 进来，μ、σ 照常求导"),
    inputs: ['mu', 'sigma', 'eps'],
    eval: ({ mu, sigma, eps }) => row(Array.from(mu.data, (m, i) => m + sigma.data[i] * eps.data[i])),
    cost: 2,
    unlock: 'dg-reparam',
  },
}

