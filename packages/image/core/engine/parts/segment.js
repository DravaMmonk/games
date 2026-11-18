import { T as catalogText } from 'kernel/words'
// Parts for labelling every pixel (视觉完备 chapter 9): a transposed convolution, zero insertion and a kernel.
import { correlate, zeroUp } from 'imglib'

const NEAREST = [1, 1, 0, 1, 1, 0, 0, 0, 0]

export const SEGMENT = {
  tconv: {
    label: catalogText("转置卷积（步幅 2）"),
    description: catalogText("补零放大一倍，再用 3×3 的核走一遍"),
    inputs: ['in'],
    params: [{ key: 'w', label: catalogText("权重"), kind: 'kernel', default: NEAREST }],
    eval: ({ in: a }, p) => correlate(zeroUp(a), p.w ?? NEAREST),
    cost: 9,
    unlock: 'tconv',
  },
}

