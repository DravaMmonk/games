import { L } from 'kernel/view'


// The numbers a level reads off a board, under its task (games/design/README.md 6.9): a row of cells, each a number over
// its name, the same in every game. items: [{ value, label, pass?, fail? }], a falsy item left out; no items, no row.

export default function Readouts({ items }) {
  const cells = items.filter(Boolean)
  if (!cells.length) return null
  return (
    <div className="readouts">
      {cells.map(({ value, label, pass, fail }) => (
        <div key={L(label)} className={fail ? 'is-fail' : pass ? 'is-pass' : undefined}><b>{value}</b><span>{L(label)}</span></div>
      ))}
    </div>
  )
}
