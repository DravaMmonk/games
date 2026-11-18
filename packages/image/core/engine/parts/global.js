import { T as catalogText } from 'kernel/words'
// Parts that see the whole picture (视觉完备 chapter 5): attention over patches, a position code, and the fixed
// encoder a contrastive bench trains (a picture as 64 features of length 1).
import { features, patchAttention } from 'cvlib'

export const GLOBAL = {
  attention: {
    label: catalogText("注意力"),
    description: catalogText("切成 P×P 图块；每块按 softmax(q·k/√d) 对所有块的 v 加权平均。只接 Q 时，K、V 也用它"),
    inputs: ['Q', 'K', 'V'],
    optional: ['K', 'V'],
    params: [
      { key: 's', label: catalogText("q 放大"), kind: 'number', min: 0, max: 100, step: 1, default: 1 },
      { key: 'P', label: catalogText("图块边长"), kind: 'select', options: [[2, '2'], [4, '4'], [8, '8']], default: 4 },
    ],
    eval: ({ Q, K, V }, p) => patchAttention(Q, K ?? Q, V ?? K ?? Q, p.s ?? 1, p.P ?? 4),
    // Every pixel is a weighted sum over all the patches: on a 16×16 picture, 256 / P² of them, twice over.
    cost: (p) => 512 / (p.P ?? 4) ** 2,
    unlock: 'attention',
  },
  embed: {
    label: catalogText("对比编码器"),
    description: catalogText("把图变成 4×4 = 16 个特征，长度为 1：整体变亮、对比度变、挪一两格、加点噪声，它都变得不多"),
    inputs: ['in'],
    eval: ({ in: a }) => features(a),
    cost: 12,
    unlock: 'embed',
  },
}

