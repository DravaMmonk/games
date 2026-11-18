// The when-to-stop bench: a few noisy samples of a smooth curve, fitted by a polynomial. Trained by gradient descent
// the fit first follows the curve, then starts bending through the noise: the error on the training samples keeps
// falling while the error on new samples (validation) turns and rises. A penalty λ·Σw² (all but the constant) is the
// other way to stop it.

import { benchRun, startValues } from 'image'
import { stopBench } from 'mllib'
import { T as t } from 'kernel'

// Losses span 0.005 … 2, so they are plotted as log10.
const logLoss = (v) => Math.log10(Math.max(1e-6, v))

/** The bench model: knobs `step` (an index into the checkpoints) and `lambda` (an index into the penalties). */
export const stop = {
  make({ wave, ...p }, bench) {
    const lambdas = bench.knobs.lambda.values
    const fit = stopBench({ ...p, checkpoints: bench.knobs.step.values, truth: (x) => Math.sin(wave * x) })
    const run = () => fit.training()
    const ridge = lambdas.map((l) => fit.regularised(l))
    const x = (u) => -1 + 2 * u
    return {
      fit,
      view(v, { open }) {
        const byStep = open.includes('step')
        const current = byStep ? run()[v.step] : ridge[v.lambda]
        const history = byStep ? run() : ridge
        const best = Math.min(...history.map((r) => r.valid))
        const upTo = byStep ? v.step : history.length - 1
        const at = byStep ? v.step : v.lambda
        return {
          train: current.train,
          valid: current.valid,
          ratio: current.valid / best,
          curve: {
            lines: [{ curve: (u) => fit.predict(current.w, x(u)), kind: 'yours', label: t('模型', 'model') }, { curve: (u) => fit.data.truth(x(u)), kind: 'faint', label: t('真实规律') }],
            dots: [
              ...fit.data.tx.map((tx, i) => ({ u: (tx + 1) / 2, v: fit.data.ty[i], kind: 'point', label: t('训练样本', 'training sample') })),
              ...fit.data.vx.filter((_, i) => i % 3 === 0).map((vx, i) => ({ u: (vx + 1) / 2, v: fit.data.vy[i * 3], kind: 'ring', label: t('新样本', 'new sample') })),
            ],
            legend: [{ kind: 'yours', label: t('模型', 'Model') }, { kind: 'faint', label: t('真实规律（模型不可见）') }, { kind: 'ring', label: t('新样本', 'New samples') }, { kind: 'point', label: t('训练样本', 'Training samples') }],
          },
          errors: {
            lines: [
              { curve: history.map((h, i) => (i <= upTo ? logLoss(h.train) : NaN)), kind: 'yours', label: t('训练误差', 'training error') },
              { curve: history.map((h, i) => (i <= upTo ? logLoss(h.valid) : NaN)), kind: 'error', label: t('新样本误差', 'new-sample error') },
            ],
            legend: [{ kind: 'yours', label: t('训练误差', 'Training error') }, { kind: 'error', label: t('新样本误差', 'New-sample error') }],
          },
          errorsTitle: byStep ? t('误差随训练步数（对数刻度）') : t('误差随 λ（对数刻度）'),
          now: (at + 0.5) / history.length,
        }
      },
    }
  },
  verify(model, bench) {
    const { fit } = model
    const run = fit.training()
    const valid = run.map((r) => r.valid)
    const bottom = valid.indexOf(Math.min(...valid))
    if (bottom === 0 || bottom === run.length - 1) return '验证误差没有先降后升'
    if (run.at(-1).train >= run[bottom].train) return '训练误差没有一直下降'
    const passes = (stageIndex, values) => benchRun(bench, model, { ...startValues(bench, bench.stages[stageIndex]), ...values }, { stageIndex }).pass
    if (passes(0, { step: 0 }) || passes(0, { step: run.length - 1 })) return '一开始或训练到底也能过'
    const lambdas = bench.knobs.lambda.values
    const good = lambdas.map((_, i) => i).filter((i) => passes(1, { lambda: i }))
    if (!good.length || good.includes(0) || good.includes(lambdas.length - 1)) return 'λ 的两端也能过，或者都不能过'
    return ''
  },
}
