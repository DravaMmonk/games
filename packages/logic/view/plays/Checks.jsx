import { SentenceRow, TreeButton, TreeList } from 'sentence/view'
import { Formula } from '../ui/Formula.jsx'
import { ChoiceField, Field, InlineChoice, RowTable, Verdict, L } from 'kernel/view'

const read = (cell, row) => cell.read ? cell.read(row) : row[cell.name]
const placeholder = (cell) => <span className="ck-placeholder">{L(cell.placeholder)}</span>

// In a form, a list of sentences reads as a rule row (strip/TreePick.jsx SentenceRow); a table keeps text.
const sentences = (cell, value) => <SentenceRow texts={value.map((item) => L(cell.build.text(item)))} end={cell.end} />

function display(cell, row) {
  const value = read(cell, row)
  switch (cell.shape) {
    case 'tree': return value ? <Formula text={cell.build.text(value)} /> : placeholder(cell)
    case 'tree-list': return value.length
      ? <span className="ck-lines">{value.map((item, k) => <span key={k}>{k + 1}. <Formula text={cell.build.text(item)} /></span>)}</span>
      : placeholder(cell)
    case 'choice': {
      const option = cell.options.find((o) => o.value === value)
      return option ? L(option.label) : placeholder(cell)
    }
  }
}

function edit(cell, row, set, at, phone) {
  const value = read(cell, row)
  const change = (value) => set(cell.write ? cell.write(row, value) : { ...row, [cell.name]: value })
  const props = { value, onChange: change }
  switch (cell.shape) {
    case 'choice': return phone ? <ChoiceField label={cell.label} options={cell.options} {...props} /> : <InlineChoice options={cell.options} unset={cell.placeholder} {...props} />
    case 'tree':
    case 'tree-list': {
      const tree = { ...props, build: cell.build, title: cell.title(at), scope: `${cell.scope}:${at}` }
      return cell.shape === 'tree' ? <TreeButton placeholder={cell.placeholder} {...tree} /> : <TreeList addLabel={cell.addLabel} kept={cell.kept?.(row)} end={cell.end} blank={cell.blank} {...tree} />
    }
  }
}

function CellForm({ cell, row, set, at }) {
  if (cell.fixed?.(row)) {
    const value = read(cell, row)
    // Fixed, a field reads as it would be written, only locked: the sentence in its box, the situation's premises in
    // short boxes, the choice's buttons with the one it holds lit.
    if (cell.shape === 'choice') return <ChoiceField label={cell.fixedLabel} options={cell.options} value={value} disabled />
    if (cell.shape === 'tree') return <Field label={cell.fixedLabel}><span className="ff-fixed">{value ? <Formula text={cell.build.text(value)} /> : L(cell.placeholder)}</span></Field>
    return <Field label={cell.fixedLabel}>{value.length ? sentences(cell, value) : placeholder(cell)}</Field>
  }
  const field = edit(cell, row, set, at, true)
  if (cell.shape === 'choice') return field
  return <Field label={cell.label}>{field}</Field>
}

/** A single scenario with choices and tables of boolean cells. */
export function CheckScenario({ fields }) {
  const pick = (cell) => (
    <button key={cell.key} type="button" aria-pressed={cell.on} onClick={cell.change} title={L(cell.title)}>{L(cell.text)}</button>
  )
  return (
    <section className="ck-scenario">
      {fields.map(({ key, name, before, after, cells, grid }) => (
        <div key={key} className="ck-field" role={name ? 'group' : undefined} aria-label={L(name)}>
          {before && <span className={grid ? 'ck-grid-label' : undefined}>{L(before)}</span>}
          {grid
            ? <table className="ck-grid"><tbody>{grid.map((row, k) => <tr key={k}>{row.map((cell) => <td key={cell.key}>{pick(cell)}</td>)}</tr>)}</tbody></table>
            : <span className="ck-scenario-cells">{cells.map(pick)}</span>}
          {after && <span>{L(after)}</span>}
        </div>
      ))}
    </section>
  )
}

/** Each row is a check. The shape of a value chooses its table display and editor. */
export default function Checks({ cells, rows, onChange, result, rowClass, onPick, verdict, phone, ...table }) {
  const columns = cells.map((cell) => ({
    key: cell.name, label: cell.label, align: cell.align,
    cell: (row) => display(cell, row),
    edit: (row, set, at) => cell.fixed?.(row) ? display(cell, row) : edit(cell, row, set, at, false),
  }))
  if (result) columns.push({
    key: 'result',
    label: result.label,
    cell: (_, k) => {
      const value = result.at(k)
      return value ? <span className={value.tone ? `ck-${value.tone}` : ''}>{value.text}</span> : result.empty
    },
  })
  return (
    <div className="ck">
      <RowTable {...table} phone={phone} rows={rows} columns={columns} onChange={onChange} rowClass={rowClass} onPick={onPick} form={(row, set, at) => cells.map((cell) => <CellForm key={cell.name} cell={cell} row={row} set={set} at={at} />)} />
      {verdict && <Verdict pass={verdict.pass}>{verdict.text}</Verdict>}
    </div>
  )
}
