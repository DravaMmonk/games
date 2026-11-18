import { qualifyItems } from 'kernel'
import { benchRun, startValues } from '../bench.js'
import { obscura } from '../benches/obscura.js'
import { wave } from '../benches/waves.js'
export const BENCH_MODELS = qualifyItems('image', { obscura, wave })

export function benchOf(bench, models = BENCH_MODELS) {
  const item = models[bench.model]
  const model = item.make(bench.setup ?? {}, bench)
  const verify = () => {
    if (item.startsUnsolved) {
      const index = (bench.stages ?? [null]).findIndex((stage, stageIndex) =>
        benchRun(bench, model, startValues(bench, stage), { stageIndex }).pass)
      if (index !== -1) {
        return bench.stages ? `第 ${index + 1} 步一开始就算完成` : 'the starting setting already passes'
      }
    }
    return item.verify(model, bench)
  }
  return { bench, model, verify }
}
