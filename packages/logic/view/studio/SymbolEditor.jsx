import { L, formOf, Rows } from 'kernel/view'

export default function SymbolEditor({ content, vocabulary, full, onPick }) {
  const raw = content.registries['logic/symbol'][full]
  return (
    <article className="arrange">
      <h2>{L(raw.name)}</h2>
      <Rows form={formOf(content.objectKinds['logic/symbol'].schema, raw, { vocabulary })} onPick={onPick} />
    </article>
  )
}
