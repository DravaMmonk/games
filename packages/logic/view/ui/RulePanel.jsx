// The prover's panel for the tray's folded parts (a machine level's `partsPanel`, ../../../circuit/view/CircuitLevel.jsx
// trayPanel): the parts under the connective each belongs to, as the proof board's tray groups them. A proof-board
// part is one row, named once, with its rule used backwards and its rewrite side by side, each a button that places
// the card and reads as the rule it carries. A machine part that is no bound rule is a row of its own.
import { Glyph } from 'circuit/view'
import { L, usePlainProse } from 'kernel/view'
import { tr } from 'kernel/words'
import { mark } from 'notation'
import { NotationLabel } from 'notation/view'
import { FormulaText } from 'kernel/view'
import { directCardsOf } from '../../core/machine.js'
import { statementLines } from './BoundRule.jsx'

// A source part's cards, backwards before rewrite, as one row; parts that are no bound rule gather in a run.
function rowsOf(items, cards) {
  const rows = []
  for (const item of items) {
    const card = cards.get(item.type)
    if (!card) {
      if (rows.at(-1)?.parts) rows.at(-1).parts.push(item)
      else rows.push({ parts: [item] })
      continue
    }
    const row = rows.find((other) => other.source === card.source)
    if (row) row.cards.push({ item, card })
    else rows.push({ source: card.source, item, cards: [{ item, card }] })
  }
  return rows
}

// The source part's name: the card's own without the sign of its direction.
const sourceName = (item, card) => {
  const sign = `${mark(card.direction)} `
  const name = String(L(item.label))
  return name.startsWith(sign) ? name.slice(sign.length) : name
}

const Name = ({ item, label, fresh }) => (
  <span className="lg-panel-name">
    {item.icon && <i className="family-chip"><Glyph icon={item.icon} size={13} /></i>}
    <NotationLabel label={label} />
    {fresh && <em className="pb-new">{tr('新')}</em>}
  </span>
)

function Rows({ items, cards, place }) {
  const plain = usePlainProse()
  return rowsOf(items, cards).map((row) => row.cards ? (
    <div key={row.source} className="lg-panel-row" data-family={row.item.family}>
      <Name item={row.item} label={sourceName(row.item, row.cards[0].card)} fresh={row.cards.some(({ item }) => item.fresh)} />
      <span className="lg-panel-cards">
        {row.cards.map(({ item, card }) => (
          <button key={item.type} type="button" className="lg-panel-card" aria-label={plain(item.label)} onClick={() => place(item.type)}>
            <NotationLabel label={mark(card.direction)} />
            <span className="lg-rule-lines formula-row">
              {card.entries.flatMap((entry) => statementLines(entry.statements)).map((line, k) => <FormulaText key={k} text={line} />)}
            </span>
          </button>
        ))}
      </span>
    </div>
  ) : (
    <div key={row.parts[0].type} className="lg-panel-parts">
      {row.parts.map((item) => (
        <button key={item.type} type="button" className="lg-panel-card" data-family={item.family} title={plain(item.desc)} onClick={() => place(item.type)}>
          <Name item={item} label={L(item.label)} fresh={item.fresh} />
        </button>
      ))}
    </div>
  ))
}

/**
 * task     the task on view (its bound cards)        shown   the parts to list first, under no heading
 * groups   [{ key, label, items }] the folded parts by tray menu        place(type)   puts a card on the board
 */
export default function RulePanel({ task, shown, groups, place }) {
  const cards = directCardsOf(task)
  return (
    <div className="lg-panel">
      {shown.length > 0 && <section className="lg-panel-group"><Rows items={shown} cards={cards} place={place} /></section>}
      {groups.map((group) => (
        <section key={group.key} className="lg-panel-group">
          {group.label && <h3 className="lg-panel-head"><NotationLabel label={L(group.label)} /></h3>}
          <Rows items={group.items} cards={cards} place={place} />
        </section>
      ))}
    </div>
  )
}
