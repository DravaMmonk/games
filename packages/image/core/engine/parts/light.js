import { T as catalogText } from 'kernel/words'
// Parts for light (视觉完备 chapter 3): Lambert shading from a surface's normals, and a camera's three colour
// sensors reading a spectrum. The spectrum is ten bands from violet to red; each sensor's curve sums to ten.
import { lambertShade, sensorReading } from 'cvlib'

const lightParam = (key, label, value) => ({ key, label, kind: 'number', min: -1, max: 1, step: 0.05, default: value })

export const LIGHT = {
  shade: {
    label: catalogText("朗伯着色"),
    description: catalogText("反射率 × (法线 · 灯的方向)，背光的地方是 0"),
    inputs: ['nx', 'ny', 'nz', 'albedo'],
    params: [lightParam('lx', catalogText("灯 x"), 0), lightParam('ly', catalogText("灯 y"), 0), lightParam('lz', catalogText("灯 z"), 1)],
    eval: ({ nx, ny, nz, albedo }, p) => lambertShade(nx, ny, nz, albedo, [p.lx, p.ly, p.lz]),
    cost: 6,
    unlock: 'lambert',
  },
  sense: {
    label: catalogText("感光"),
    description: catalogText("一种感光元件对一条光谱的读数：光谱乘上它的灵敏度曲线，再求平均"),
    inputs: ['in'],
    params: [{ key: 'channel', label: catalogText("感光"), kind: 'select', options: [['R', 'R'], ['G', 'G'], ['B', 'B']], default: 'R' }],
    eval: ({ in: a }, p) => sensorReading(a, p.channel ?? 'R'),
    cost: 20,
    unlock: 'sense',
  },
}

