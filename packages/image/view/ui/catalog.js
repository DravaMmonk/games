import { T as catalogText } from 'kernel/words'
import { qualifyItems } from 'kernel/view'
import { iconOf as definedIcon } from 'circuit/view'
import { ArrowRightFromLine, ArrowRightToLine, AudioWaveform, Box, Calculator, Grid3x3, Minimize2, Network, Package, Search, Sparkles } from 'lucide-react'

// How each part looks on the board and in the parts list: a family (colour and icon); families group parts by what they
// look at, which is the idea the game is teaching. What a part does is ../words.js.
export const FAMILIES = qualifyItems('image', {
  io: { label: catalogText("输入与输出"), icon: ArrowRightFromLine },
  pixel: { label: catalogText("逐像素"), icon: Calculator },
  neighbour: { label: catalogText("看邻居"), icon: Grid3x3 },
  size: { label: catalogText("改尺寸"), icon: Minimize2 },
  search: { label: catalogText("搜索与比较"), icon: Search },
  frequency: { label: catalogText("频率"), icon: AudioWaveform },
  global: { label: catalogText("看全局"), icon: Network },
  learned: { label: catalogText("可学习"), icon: Sparkles },
  own: { label: catalogText("你封装的"), icon: Package },
  other: { label: catalogText("元件"), icon: Box },
})

const FAMILY_OF = Object.fromEntries(Object.entries({
  input: 'io', output: 'io',
  add: 'pixel', sub: 'pixel', mul: 'pixel', arith: 'pixel', merge: 'pixel', const: 'pixel', threshold: 'pixel', invert: 'pixel',
  softmax: 'pixel', square: 'pixel', sqrt: 'pixel', cos: 'pixel', exp: 'pixel', relu: 'pixel', max: 'pixel', lrnSigmoid: 'pixel',
  mystery: 'neighbour', shift: 'neighbour', blur3h: 'neighbour', box3: 'neighbour', gauss: 'neighbour', diffx: 'neighbour',
  sobelx: 'neighbour', sobely: 'neighbour', kernel3: 'neighbour', gradmag: 'neighbour', harris: 'neighbour',
  downsample: 'size', maxpool: 'size', lrnGap: 'size', zeroUp: 'size',
  argmin4: 'search', disparity: 'search',
  fqSpectrum: 'frequency', fqLowpass: 'frequency', fqWave: 'frequency', fqMean: 'global',
  globalMax: 'global', attention: 'global',
  learn3: 'learned', lrnConv: 'learned', lrnConst: 'learned', lrnDense: 'learned', lrnRgb: 'learned', lrnRes: 'learned',
  'dg-encode': 'learned', 'dg-decode': 'learned', 'dg-decoder': 'learned', 'dg-mu': 'learned', 'dg-sigma': 'learned', 'dg-sample': 'learned', 'dg-reparam': 'learned',
}).map(([name, family]) => [name === 'input' || name === 'output' ? name : `image/${name}`, `image/${family}`]))

export const familyOf = (type, types) => types?.[type]?.definition?.family ?? (types?.[type]?.circuitOf ? 'image/own' : FAMILY_OF[type] ?? 'image/other')
export const iconOf = (type, types) => definedIcon(types?.[type]?.definition?.icon) ?? (type === 'output' ? ArrowRightToLine : FAMILIES[familyOf(type, types)].icon)
