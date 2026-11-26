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
      ? <span className="ck-lines">{value.map((item, k) => (
        <span key={k} className={cell.kept?.(row)?.includes(item) ? 'ck-fixed' : undefined}>
          {value.length > 1 && <span className="ck-number">{k + 1}.</span>}<Formula text={cell.build.text(item)} />
        </span>
      ))}</span>
      : placeholder(cell)
    case 'choice': return L(cell.options.find((option) => option.value === value)?.label) ?? '—'
  }
}

function edit(cell, row, set, at, phone) {
  const value = read(cell, row)
  const change = (value) => set(cell.write ? cell.write(row, value) : { ...row, [cell.name]: value })
  const props = { value, onChange: change }
  switch (cell.shape) {
    case 'choice': {
      const Choice = phone ? ChoiceField : InlineChoice
      return <Choice label={cell.label} options={cell.options} {...props} />
    }
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
    const content = cell.shape === 'tree-list' && value.length
      ? <span className="ck-fixed">{sentences(cell, value)}</span>
      : <span className="ff-fixed ck-fixed">{display(cell, row)}</span>
    return <Field label={cell.fixedLabel}>{content}</Field>
  }
  const field = edit(cell, row, set, at, true)
  if (cell.shape === 'choice') return field
  return <Field label={cell.label}>{field}</Field>
}

/** Each row is a check. The shape of a value chooses its table display and editor. */
export default function Checks({ cells, rows, onChange, result, rowClass, onPick, verdict, phone, ...table }) {
  const columns = cells.map((cell) => {
    const fixedValue = (row) => <span className="ck-fixed">{display(cell, row)}</span>
    return {
      key: cell.name, label: cell.label, align: cell.align,
      className: cell.name === 'goal' ? 'ck-goal' : undefined,
      cell: (row) => cell.fixed?.(row) ? fixedValue(row) : display(cell, row),
      edit: (row, set, at) => cell.fixed?.(row) ? fixedValue(row) : edit(cell, row, set, at, false),
    }
  })
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
