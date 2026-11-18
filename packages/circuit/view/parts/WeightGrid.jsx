import { NumberField } from 'kernel/view'

import { T } from 'kernel/words'

import "./weight-grid.css"

/** The editor of a square kernel's weights (or the read-only learned weights). */
export default function WeightGrid({ value = [], params, onChange, readOnly, phone, roomy }) {
  const cols = params?.cols ?? 3
  const change = (index, next) => onChange(value.map((weight, k) => k === index ? next : weight))
  return <div className={`pf-weights ${roomy ? 'is-roomy' : ''} ${readOnly ? 'is-fixed' : ''}`} style={{ '--weight-cols': cols }} role="group">
    {value.map((weight, k) => readOnly
      ? <output key={k} style={{ '--weight': Math.max(-1, Math.min(1, weight)) }}>{Number(weight).toFixed(2)}</output>
      : <NumberField key={k} label={T("权重 {value} 行 {value2} 列", {value: Math.floor(k / cols) + 1, value2: k % cols + 1})} value={weight} onChange={(next) => change(k, next)} phone={phone} />)}
  </div>
}
