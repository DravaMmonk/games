import { fromFn, image } from 'imglib'

export const BANDS = Array.from({ length: 10 }, (_, i) => 415 + 30 * i)
const SENSORS = { R: [590, 35], G: [540, 38], B: [450, 28] }
const sensitivity = (channel, nm) => Math.exp(-((nm - SENSORS[channel][0]) ** 2) / (2 * SENSORS[channel][1] ** 2))
export const CURVES = Object.fromEntries(Object.keys(SENSORS).map((c) => {
  const raw = BANDS.map((nm) => sensitivity(c, nm))
  const total = raw.reduce((a, b) => a + b, 0)
  return [c, raw.map((v) => (v * BANDS.length) / total)]
}))
export function lambertShade(nx, ny, nz, albedo, [lx, ly, lz]) {
  const dx = lx ?? 0
  const dy = ly ?? 0
  const dz = lz ?? 1
  return fromFn(nx.w, nx.h, (x, y) => {
    const i = y * nx.w + x
    return albedo.data[i] * Math.max(0, nx.data[i] * dx + ny.data[i] * dy + nz.data[i] * dz)
  })
}

export const sensorReading = (spectrum, channel) => image(1, 1,
  spectrum.data.reduce((sum, value, band) => sum + value * CURVES[channel][band], 0) / spectrum.data.length,
)
