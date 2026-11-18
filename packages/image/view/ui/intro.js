import { T as catalogText } from 'kernel/words'
import { createElement } from 'react'
import { createFigureHost } from 'kernel/view'
import { figureTask, figureTest, partFigure } from '../../core/intros.js'
import { WORDS } from 'kernel/view'
import { IntroFigure, FigureHost } from 'kernel/view'

const INPUT = catalogText("输入")
const OUTPUT = catalogText("输出")
const INPUT_NAMES = {
  left: catalogText("左图"),
  right: catalogText("右图"),
  scene: catalogText("现场"),
  empty: catalogText("空场"),
}

const item = (label, image, view) => image.w * image.h === 1 && (image.c ?? 1) === 1
  ? { label, value: image.data[0] }
  : { label, value: image, views: [view ? ({ 'image/pixels': 'pixels', 'image/terrain': 'surface', 'image/slope': 'slope', 'image/profile': 'profile', 'image/spectrum': 'spectrum' })[view] : (image.h === 1 ? 'plot' : 'pixels'), 'pixels'] }

export function imageHero({ theme }) {
  return createElement(FigureHost, { mount: createFigureHost, name: 'conv-press', theme, bare: true })
}

export function imageIntroduction({ fig, level, theme, types }) {
  const { caption, view } = fig
  if (fig.figure) return createElement(IntroFigure, { caption, art: createElement(FigureHost, { mount: createFigureHost, name: fig.figure, theme }) })
  if (fig.test !== undefined) {
    const test = figureTest(fig, level)
    if (!test) return null
    const task = figureTask(fig, level)
    const inputs = Object.entries(test.inputs).map(([name, image]) => item(task.inputLabels?.[name] ?? INPUT_NAMES[name] ?? INPUT, image, view))
    const outputs = Object.entries(test.expected).map(([name, image]) => item(task.outputLabels?.[name] ?? WORDS.wanted, image, view))
    return createElement(IntroFigure, { caption, inputs, outputs })
  }
  if (!fig.part) return null
  try {
    const made = partFigure(fig, level, types)
    const inputs = made.ins.map((image, index) => item(made.ins.length > 1 ? String.fromCharCode(97 + index) : INPUT, image, view))
    return createElement(IntroFigure, { caption, inputs, operation: types[fig.part].label, outputs: [item(OUTPUT, made.out, view)] })
  } catch {
    return null
  }
}
