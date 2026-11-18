// The parameter bench (games/design/README.md 6.4): a level for a parameterized mechanism (a dark box, sampling,
// thousands of training steps). A bench is data over a domain's code:
//
//   model    the simulation, picked by name from the domain (code): what it computes from the knobs, and for a
//            process (training, a duel, timed rounds) its state and the acts that move it
//   setup    the model's own parameters
//   knobs    what the player turns: a range, an index into a list, one of some choices, or a switch
//   cases    several situations the same knobs are judged on at once (scenes, outlier ratios); optional
//   stages   steps taken in turn, each opening some knobs and with its own goal; optional
//   actions  buttons: an act of the model, run once or `repeat` times, or a reset of some knobs
//   goal     limits on what the model computes (`of`), every one must hold; a stage may give its own
//   check    live (the goal judged as the knobs turn) or submit (judged only when the player presses Check: the
//            goal's readings and the pictures' results stay hidden until then, so a knob is not slid until green)
//   layout   where the display items go: head, main (the bench's card), side (beside it), foot
//
// This module is node-safe: the schema, the judge and the number formats, shared by `npm run check` and the bench
// screen (../view/bench/).
import { numberText } from 'kernel'
import { S } from 'kernel'
import { T as t } from 'kernel'

const num = S.num()

/** How a number is written: on a knob, in a goal row, in a table. */
export const FORMATS = ['auto', 'raw', 'int', 'fixed1', 'fixed2', 'fixed3', 'fixed4', 'pct', 'pct1', 'exp', 'grouped', 'quarterPi', 'pow10', 'outOf']
const FORMAT = S.oneOf(FORMATS)

/** Text, or a text the model computes: { of: name }. */
export const TEXT_OF = S.either(S.text(), S.obj({ of: S.str() }))

// What every display item may carry besides its own parameters.
const ITEM_COMMON = {
  when: S.opt(S.str({ about: t('只在模型的这个量为真时显示') })),
  unless: S.opt(S.str()),
  with: S.opt(S.shape('image/nested-layout-blocks', { about: t('嵌进这一项里的项') })),
}
const LINE = S.obj({ of: S.str(), kind: S.oneOf(['target', 'yours', 'faint', 'error', 'seen']), label: S.opt(S.text()), legend: S.opt(S.text()) })
const STAT = S.obj({ of: S.str(), label: S.text(), format: S.opt(FORMAT), unit: S.opt(S.str()), goal: S.opt(S.bool({ about: t('达到目标时标绿') })) })
const LOOK = S.oneOf(['legend', 'label', 'note', 'caption', 'mono', 'serif', 'small', 'lede', 'title', 'line'])

/** The display items every bench has (the kernel's); a domain adds its own pictures and interactions. */
export const KERNEL_DISPLAYS = {
  step: { about: t('这一步的标题和说明') },
  knobs: { about: t('打开的旋钮'), params: S.obj({ only: S.opt(S.list(S.str())) }) },
  actions: { params: S.obj({ only: S.opt(S.list(S.int())) }) },
  verdict: { about: t('目标达到没有；分步的台子带「下一步」'), params: S.obj({ center: S.opt(S.bool()) }) },
  goals: { about: t('目标的每一条和此刻的值'), params: S.obj({ phoneCols: S.opt(S.int({ min: 1, max: 2 })) }) },
  stages: {},
  cases: { about: t('切换情形，每个带对错'), params: S.obj({ passed: S.opt(S.text({ about: t('「n / m 」后面的字') })) }) },
  plot: {
    about: t('曲线图：指向一处读出各条线的值'),
    params: S.obj({
      of: S.opt(S.str({ about: t('模型给出的 { lines, dots, legend }') })),
      lines: S.opt(S.list(LINE)), title: S.opt(TEXT_OF), legend: S.opt(S.bool()),
      lo: S.opt(num), hi: S.opt(num), ticks: S.opt(S.list(num)), tickFormat: S.opt(FORMAT), span: S.opt(num), left: S.opt(num),
      height: S.list(num, { min: 2, about: t('[桌面, 手机] 的高') }), mark: S.opt(S.str({ about: t('竖线的位置（0…1）') })),
    }),
  },
  strips: { about: t('几行像素，最暗是 0，最亮是 1'), params: S.obj({ rows: S.list(S.obj({ of: S.str(), label: S.text() })) }) },
  text: { about: t('一段字：写定的，或模型算出的'), params: S.obj({ text: S.opt(S.text()), of: S.opt(S.str()), look: S.opt(LOOK) }) },
  stats: { params: S.obj({ of: S.list(STAT), phone: S.opt(S.oneOf(['line'])) }) },
  chips: { about: t('一排小标签'), params: S.obj({ of: S.str(), look: S.opt(S.oneOf(['wave', 'plain'])) }) },
  curve: { about: t('一条小曲线（损失）'), params: S.obj({ of: S.str(), caption: S.str() }) },
  table: { params: S.obj({ of: S.str() }) },
  progress: { about: t('一排进度点'), params: S.obj({ of: S.str() }) },
}

/** The display kind of a domain's vocabulary: the kernel's items and the domain's, each also taking when/unless/with. */
export function displayItems(domainItems) {
  const all = { ...KERNEL_DISPLAYS, ...domainItems }
  return Object.fromEntries(Object.entries(all).map(([name, item]) => {
    const own = item.params
    return [name, { ...(item.about && { about: item.about }), params: S.obj({ ...(own?.fields ?? {}), ...ITEM_COMMON }) }]
  }))
}

/* ---------- knobs ---------- */

const KIND = (knob) => (knob.toggle !== undefined ? 'toggle' : knob.list ? 'list' : knob.choices ? 'choice' : knob.values ? 'index' : 'range')
export const knobKind = KIND

const FIRST = { toggle: () => false, list: () => [], choice: (k) => k.choices[0].value, index: () => 0, range: (k) => k.min }
/** A knob's value before anything is turned (`start: null` is a choice with nothing chosen yet). */
export const knobStart = (knob) => ('start' in knob ? knob.start : FIRST[KIND(knob)](knob))

/** Every value a knob can take (a range on its steps). */
export function knobValues(knob) {
  const kind = KIND(knob)
  if (kind === 'toggle') return [false, true]
  if (kind === 'choice') return knob.choices.map((c) => c.value)
  if (kind === 'index') return knob.values.map((_, i) => i)
  return Array.from({ length: Math.round((knob.max - knob.min) / knob.step) + 1 }, (_, i) => knob.min + i * knob.step)
}

/** The knob values a stage (or the bench, without stages) starts from; a per-case knob holds one value per case. */
export function startValues(bench, stage = null) {
  const cases = bench.cases?.length ?? 0
  const values = {}
  for (const [name, knob] of Object.entries(bench.knobs ?? {})) {
    const start = stage?.start && name in stage.start ? stage.start[name] : knobStart(knob)
    values[name] = knob.perCase ? Array.from({ length: cases }, () => start) : start
  }
  return values
}

/** The knobs a stage opens: those it names, or every knob that is not fixed. */
export const openKnobs = (bench, stage) => stage?.opens ?? Object.keys(bench.knobs ?? {}).filter((k) => !bench.knobs[k].fixed)

/* ---------- the goal ---------- */

const holds = (limit, raw) => {
  const numeric = ['atLeast', 'atMost', 'above', 'below'].some((k) => limit[k] !== undefined)
  if (limit.is !== undefined && raw !== limit.is) return false
  if (limit.not !== undefined && raw === limit.not) return false
  if (!numeric) return true
  if (typeof raw !== 'number' || Number.isNaN(raw)) return false
  const v = limit.near !== undefined ? Math.abs(raw - limit.near) : limit.abs ? Math.abs(raw) : raw
  return (limit.atLeast === undefined || v >= limit.atLeast) && (limit.atMost === undefined || v <= limit.atMost) && (limit.above === undefined || v > limit.above) && (limit.below === undefined || v < limit.below)
}

/** Judge limits against what a model computed: { pass, rows: [{ limit, value, pass }] }. */
export function judge(limits = [], quantities = {}) {
  const rows = limits.map((limit) => ({ limit, value: quantities[limit.of], pass: holds(limit, quantities[limit.of]) }))
  return { pass: rows.every((r) => r.pass), rows }
}

/** The goal a stage is judged by: its own, or the bench's. */
export const goalOf = (bench, stage = null) => stage?.goal ?? bench.goal ?? []

/** Evaluate the same stage and cases for the player and for the author's check. */
export function benchRun(bench, model, values, { stageIndex = 0, process = model.start?.() ?? null, running = 0 } = {}) {
  const stage = bench.stages?.[stageIndex] ?? null
  const ctx = { stage, stageIndex, open: openKnobs(bench, stage), process, running }
  const views = bench.cases
    ? bench.cases.map((c, caseIndex) => model.view(values, { ...ctx, case: c, caseIndex }))
    : [model.view(values, ctx)]
  const limits = goalOf(bench, stage)
  const verdicts = views.map((view) => judge(limits, { ...values, ...view }))
  return { views, verdicts, pass: verdicts.every((verdict) => verdict.pass) }
}

/**
 * Every setting of a stage's open knobs (or of `open`; the others at the stage's start) that meets its goal, each
 * written as its values joined by ×, so a check can compare them with the answers a stage means.
 */
export function passingSettings(bench, model, stageIndex = 0, open = openKnobs(bench, bench.stages?.[stageIndex])) {
  const stage = bench.stages?.[stageIndex]
  let settings = [startValues(bench, stage)]
  for (const name of open) settings = settings.flatMap((v) => knobValues(bench.knobs[name]).map((x) => ({ ...v, [name]: x })))
  return settings.filter((v) => benchRun(bench, model, v, { stageIndex }).pass).map((v) => open.map((name) => v[name]).join('×'))
}

/** The limit of a goal on one quantity (a model may read its own goal: the rounds a sprint needs, a collapse line). */
export const limitOf = (goal = [], of) => goal.find((l) => l.of === of) ?? null

/* ---------- numbers ---------- */

const MINUS = (s) => s.replace(/^-/, '−')
const QUARTERS = ['0', 'π/4', 'π/2', '3π/4', 'π']

/** A number in a format, with its unit; text and non-numbers pass through ('—' for a missing or infinite number). */
export function formatValue(v, format = 'raw', unit = '', of = null) {
  if (typeof v !== 'number') return v === null || v === undefined ? '—' : String(v)
  if (!Number.isFinite(v)) return '—'
  const tail = unit ?? ''
  switch (format) {
    case 'auto': return `${Number.isInteger(v) ? String(v) : v.toFixed(2)}${tail}`
    case 'int': return `${Math.round(v)}${tail}`
    case 'fixed1': return `${v.toFixed(1)}${tail}`
    case 'fixed2': return `${v.toFixed(2)}${tail}`
    case 'fixed3': return `${v.toFixed(3)}${tail}`
    case 'fixed4': return `${v.toFixed(4)}${tail}`
    case 'pct': return `${Math.round(v * 100)}%`
    case 'pct1': return `${(v * 100).toFixed(1)}%`
    case 'exp': return `${v.toExponential(0)}${tail}`
    case 'grouped': return `${v.toLocaleString('en-US')}${tail}`
    case 'pow10': return 10 ** v >= 1 ? (10 ** v).toFixed(0) : (10 ** v).toFixed(Math.max(0, -Math.floor(v)))
    case 'quarterPi': {
      const q = Math.round(v)
      return q === 0 ? '0' : `${q < 0 ? '−' : ''}${QUARTERS[Math.abs(q)] ?? `${Math.abs(q) / 4}π`}`
    }
    case 'outOf': return `${numberText(of === null ? v : Math.min(v, of))} / ${of}`
    default: return `${numberText(v)}${tail}`
  }
}

/** The threshold a goal row shows ("≥ 40%", "30 ± 1 mm", "< 1.5 px"), trailing zeros dropped; '' for outOf. */
export function needText(limit) {
  if (limit.format === 'outOf') return ''
  const pct = limit.format === 'pct' || limit.format === 'pct1'
  const number = (x) => MINUS(String(+(pct ? x * 100 : x).toFixed(4)))
  const write = (x) => `${number(x)}${pct ? '%' : limit.unit ?? ''}`
  const bound = [['atLeast', '≥'], ['atMost', '≤'], ['above', '>'], ['below', '<']].find(([k]) => limit[k] !== undefined)
  if (!bound) return ''
  return limit.near !== undefined ? `${number(limit.near)} ± ${write(limit[bound[0]])}` : `${bound[1]} ${write(limit[bound[0]])}`
}

/** A goal row's value, written as the limit says (outOf: "3 / 4"). */
export const rowValue = (limit, value) => formatValue(value, limit.format ?? 'raw', limit.unit ?? '', limit.format === 'outOf' ? (limit.atLeast ?? limit.is) : null)
