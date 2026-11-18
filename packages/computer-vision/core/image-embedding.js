import { correlate, downsample, gaussianKernel, map } from 'image-processing'

export const features = (img) => {
  const small = downsample(downsample(correlate(img, gaussianKernel(1.2), 'edge'), 2), 2)
  const mean = small.data.reduce((s, v) => s + v, 0) / small.data.length
  const centred = map(small, (v) => v - mean)
  const norm = Math.sqrt(centred.data.reduce((s, v) => s + v * v, 0)) || 1
  return map(centred, (v) => v / norm)
}
