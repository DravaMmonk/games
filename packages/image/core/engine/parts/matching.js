import { T as catalogText } from 'kernel/words'
// Parts for finding the same point again (视觉完备 chapter 6): Hough voting, RANSAC and homographies, and warping a
// picture by one. Points come from a mask's bright pixels; a homography travels as a 1×9 row and pairs of points as a
// row of x, y, x′, y′ four at a time.
import { fromFn, random, row } from 'imglib'
import { distanceToLine, houghGrid, HOUGH_BINS, pairsOf, pointsOf, ransacLine, robustHomography, warp } from 'cvlib'

export const MATCHING = {
  hough: {
    label: catalogText("Hough 累加器"),
    description: catalogText("亮于 0.5 的每个点给经过它的所有直线 x·cosθ + y·sinθ = ρ 投一票：横着是 θ（16 格，0° … 180°），竖着是 ρ（每格 2 像素）"),
    inputs: ['in'],
    eval: ({ in: a }) => houghGrid(a),
    cost: HOUGH_BINS,
    unlock: 'hough',
  },
  ransac: {
    label: catalogText("RANSAC 找直线"),
    description: catalogText("在亮于 0.5 的点里，k 轮各抽两点连线、数离线不到 δ 的点，留下支持最多的线并用它的内点重新拟合，画出来（离线不到 0.7 的格子为 1）"),
    inputs: ['in'],
    params: [
      { key: 'k', label: catalogText("轮数 k"), kind: 'number', min: 1, max: 200, step: 1, default: 10 },
      { key: 'd', label: 'δ', kind: 'number', min: 0.25, max: 3, step: 0.25, default: 1 },
    ],
    eval: ({ in: a }, p) => {
      const fit = ransacLine(pointsOf(a), p.k ?? 10, p.d ?? 1, random(7))
      return fromFn(a.w, a.h, (x, y) => (fit && distanceToLine(fit.line, [x, y]) < 0.7 ? 1 : 0))
    },
    cost: (p) => Math.max(1, Math.round((p.k ?? 10) / 4)),
    unlock: 'ransac',
  },
  homography: {
    label: catalogText("求单应"),
    description: catalogText("点对每 4 个数一对：(x, y) → (x′, y′)。k = 0 时用全部点对直接解（DLT）；k > 0 时做 RANSAC：k 轮各抽 4 对解 H，数误差小于 1.5 像素的点对，留下最多的一组再解一次。输出 H 的 9 个数"),
    inputs: ['pairs'],
    params: [{ key: 'k', label: catalogText("轮数 k"), kind: 'number', min: 0, max: 200, step: 10, default: 0 }],
    eval: ({ pairs }, p) => {
      const H = robustHomography(pairsOf(pairs), p.k ?? 0, random(11))
      if (!H) throw new Error('the pairs do not fix a homography')
      return row(H)
    },
    cost: 1,
    unlock: 'homography',
  },
  warp: {
    label: catalogText("单应变形"),
    description: catalogText("按 H 把图搬到「画布」那么大的一张图上：画布上每一格取原图里 H⁻¹ 指向的那一格（最近的一格），落在原图外是 0"),
    inputs: ['in', 'H', 'onto'],
    anySize: true,
    eval: ({ in: a, H, onto }) => warp(a, Array.from(H.data), onto),
    cost: 4,
  },
}

