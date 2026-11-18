// Parts for light (视觉完备 chapter 3): Lambert shading from a surface's normals, and a camera's three colour
// sensors reading a spectrum. The spectrum is ten bands from violet to red; each sensor's curve sums to ten.
import { lambertShade, sensorReading } from 'cvlib'

const lightParam = (key, label, value) => ({ key, label, kind: 'number', min: -1, max: 1, step: 0.05, default: value })

export const LIGHT = {
  shade: {
    label: { zh: '朗伯着色', en: 'Lambert shading' },
    description: { zh: '反射率 × (法线 · 灯的方向)，背光的地方是 0', en: 'Reflectance × (normal · lamp direction), 0 where the surface faces away' },
    inputs: ['nx', 'ny', 'nz', 'albedo'],
    params: [lightParam('lx', { zh: '灯 x', en: 'Lamp x' }, 0), lightParam('ly', { zh: '灯 y', en: 'Lamp y' }, 0), lightParam('lz', { zh: '灯 z', en: 'Lamp z' }, 1)],
    eval: ({ nx, ny, nz, albedo }, p) => lambertShade(nx, ny, nz, albedo, [p.lx, p.ly, p.lz]),
    cost: 6,
    unlock: 'lambert',
  },
  sense: {
    label: { zh: '感光', en: 'Sensor' },
    description: { zh: '一种感光元件对一条光谱的读数：光谱乘上它的灵敏度曲线，再求平均', en: 'What one kind of sensor reads from a spectrum: the spectrum times its sensitivity curve, averaged' },
    inputs: ['in'],
    params: [{ key: 'channel', label: { zh: '感光', en: 'Sensor' }, kind: 'select', options: [['R', 'R'], ['G', 'G'], ['B', 'B']], default: 'R' }],
    eval: ({ in: a }, p) => sensorReading(a, p.channel ?? 'R'),
    cost: 20,
    unlock: 'sense',
  },
}

