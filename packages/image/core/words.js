import { T as catalogText } from 'kernel/words'
// What each part of the image domain does, in a line (games/design/README.md 4: a description says only what a part does),
// and the names of a level's input cards: for the parts list, the components box and the cards (ui/), and for a blind
// session (play.js).
import { L } from 'kernel'

/** Names for the cards of a level with several inputs, unless the level names them itself. */
export const INPUT_LABELS = {
  left: catalogText("左图"),
  right: catalogText("右图"),
  scene: catalogText("现场"),
  empty: catalogText("空场"),
}

const DESCRIPTIONS = {
  shift: catalogText("整张图平移一格；从边界移入的格子补 0"),
  invert: catalogText("每个像素变成 1 − 自己：亮的变暗，暗的变亮"),
  add: catalogText("两张图逐像素相加：a + b"),
  sub: catalogText("两张图逐像素相减：a − b"),
  mul: catalogText("两张图逐像素相乘：a × b"),
  softmax: catalogText("把两个或三个分数转成总和为 1 的权重。第三输入可留空，此时第三输出为 0。"),
  arith: catalogText("两张图逐像素相加、相减、相乘或相除。可将左侧或右侧设为常数，另一侧接线输入"),
  merge: catalogText("有三个输入口，将接入的图逐像素相加；空置的输入口不计入"),
  const: catalogText("始终输出同一个数。与图相加或相乘时，这个数作用于每一格"),
  threshold: catalogText("大于阈值输出 1，否则输出 0"),
  square: catalogText("每个像素平方"),
  sqrt: catalogText("每个像素开方"),
  relu: catalogText("负数变 0，正数不变"),
  globalMax: catalogText("用整张图的最大值填满每一格"),
  blur3h: catalogText("每格换成它和左右两个邻居的平均"),
  box3: catalogText("每格换成它周围 3×3 九个格子的平均"),
  gauss: catalogText("高斯模糊，σ 可调"),
  diffx: catalogText("右边邻居 − 自己"),
  sobelx: catalogText("横向求导、纵向平滑"),
  sobely: catalogText("纵向求导、横向平滑"),
  kernel3: catalogText("任意 3×3 核（按“互相关”读权重）"),
  learn3: catalogText("3×3 核，权重由训练决定"),
  harris: catalogText("Harris 角点响应：两个方向都在变的地方是正的大数，直边上是负的"),
  downsample: catalogText("每隔一个像素取一个，尺寸减半"),
  zeroUp: catalogText("尺寸翻倍：每个像素放在 2×2 的左上角，其余三格补 0"),
  maxpool: catalogText("每个 2×2 块取最大值，尺寸减半"),
  gradmag: '√(Gx² + Gy²)',
  argmin4: catalogText("逐像素比较几张代价图，输出最小者的编号"),
  disparity: catalogText("左右图逐行匹配，输出视差，窗口可选"),
}

/** What a part of a course's part table (`types`, engine/kit.js) does, as a { zh, en } pair (the parts box). */
export const descriptionOf = (types, type) => types[type]?.definition?.desc ?? DESCRIPTIONS[type] ?? types[type]?.description
// The same, resolved in the current language.
export const describe = (types, type) => L(descriptionOf(types, type) ?? '')
