import { portAppearance } from './wire-appearance.js'
import { Fragment, useMemo } from 'react'
import SlotBoard from "./SlotBoard.jsx"
import { L } from "kernel/view"
import { tr } from 'kernel/words'

import { circuitBoard, primitivesOnly } from "../../core/board-cards.js"
import { definitionPorts, evalSettings } from "../../core/parts/define.js"
import PartFace, { blocksOf } from "../parts/PartFace.jsx"
import { nextParams } from "../parts/faces.jsx"
import { withPartLabels } from "./board-parts.js"
import PartSheet, { Fact, Facts, Implementations, Ports, ROWS, Settings, marker } from "../parts/PartSheet.jsx"
import { cardPorts, namesPorts } from "../../core/board/card-ports.js"
import Glyph from "./Glyph.jsx"

// The circuit editor's parts drawn (games/design/README.md 6.7, 6.8). A primitive's scenes are its three faces — the desktop
// card as the canvas draws it (CanvasCard), the phone tile on a fixed slot board, and the detail both share — drawn from the game's definitions
// (game.defined), so its icons, colours and controls are the player's; its settings move as a player would move them
// (rules followed, readouts and actions live) and the three scenes share them (`state`); nothing is wired to it, so
// its value shows as a placeholder. The parts box and Studio previews take the same example circuits, simulations
// and inside boards from game.parts.preview; the editor decides how to present them.
// The Sheet is the fields no scene draws: a primitive's revisions, ports, every setting, what it computes and its
// interaction as parts.json writes them; a built part's own fields (../shell/parts/PartSheet.jsx).
//
//   preview(part, { game, defined?, scene, edit?, state?, entry?, phone?, progress? })   part: parts.json's entry with its
//     `type`; defined the cards drawn from (game.defined unless a stage's are shown); state [params, set] the settings
//     the scenes share; entry the parts box's entry it is shown in

import SampleCircuit from './SampleCircuit.jsx'
import PartExperiment from './PartExperiment.jsx'
import BuiltBoard from './BuiltBoard.jsx'

const NONE = { values: new Map(), errors: new Map() }
const at = (path) => JSON.stringify(path)
const previewBoard = circuitBoard({ cards: [] })
const ignore = () => {}

function Code({ path, label, text, picked, ok = null }) {
  return (
    <div className={`pp-code ${picked === at(path) ? 'is-picked' : ''}`} data-pf={at(path)}>
      {label && <span className="pp-code-label">{label}</span>}
      <code>{text}</code>
      {ok !== null && <i className={`pp-code-now ${ok ? 'is-ok' : 'is-no'}`} aria-label={ok ? tr('此刻成立') : tr('此刻不成立')} />}
    </div>
  )
}

/** A part's settings as the scenes share them: its defaults until one is moved. */
const paramsOf = (type, defined, [params]) => params ?? defined.defaults(type)

// One unwired card as the desktop canvas draws it (CanvasEditor's card): its head, the port rails flanking its body, and
// a frame's regions under it, each with the dots its region opens and closes. Nothing sits inside a region, so its
// field is a short empty strip rather than the canvas's room to drop cards.
function CanvasCard({ node, parts, body }) {
  const { inputs, outputs, regions } = cardPorts(parts, node)
  const named = namesPorts(parts, node, (label) => String(L(label)))
  const plain = outputs.length === 1 && outputs[0].key === null && !named
  const icon = parts.icon?.(node)
  const dot = (side, extra = '', input = null, output = null) => (
    <i className={`port port-${side} ${extra}`} data-port-shape={portAppearance(parts, node, input, output).shape}><i /></i>
  )
  return (
    <div data-family={parts.family(node)} className={`node is-${parts.role(node)} ${parts.packed?.(node) ? 'is-packed' : ''} ${regions.length ? 'is-frame' : ''}`} style={parts.cardStyle?.(node)}>
      {regions.length > 0 && <div className="frame-back" />}
      <div className="node-head">
        <div className="node-heading">
          {icon && <i className="family-chip"><Glyph icon={icon} size={12} /></i>}
          <span className="node-title">{L(parts.label(node))}</span>
        </div>
      </div>
      <div className="node-ports">
        <div className="node-inputs">
          {inputs.map((port) => <span key={port} className="node-port-label">{dot('in', parts.portClass?.(node, port) ?? '', port)}{L(parts.portLabel?.(node, port)) ?? ''}</span>)}
        </div>
        <div className="node-body">{body()}</div>
        <div className="node-outputs">
          {!plain && outputs.map((o) => (
            <span key={o.key} className="node-port-out">
              {o.glyph ? <span className="node-out-name is-glyph" title={L(o.label)} dangerouslySetInnerHTML={{ __html: o.glyph }} /> : <span className="node-out-name" title={L(o.label)}>{L(o.short ?? o.label)}</span>}
              {dot('out', parts.portClass?.(node, null, o.key) ?? '', null, o.key)}
            </span>
          ))}
        </div>
        {plain && dot('out', parts.portClass?.(node, null) ?? '')}
      </div>
      {regions.length > 0 && (
        <div className="frame-regions">
          {regions.map((r) => (
            <section key={r.name} className="frame-region">
              <header className="frame-region-head">
                {r.opens && dot('out', 'frame-open', null, r.name)}
                <span className="frame-region-name">{L(r.label)}</span>
                <span className="frame-region-result">{L(parts.portLabel?.(node, r.name)) ?? ''}{dot('in', 'frame-close', r.name)}</span>
              </header>
              <div className="frame-field" />
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function Face({ part, defined, scene, edit, state }) {
  const { type } = part
  const def = defined.of(type)
  const params = paramsOf(type, defined, state)
  const setParams = state[1]
  const parts = useMemo(() => {
    const circuit = primitivesOnly(previewBoard, { [type]: definitionPorts(def, defined.ops) })
    return withPartLabels(previewBoard.wiring(null, circuit), defined.of)
  }, [type, def, defined])
  const node = { id: 'p', type, params }
  const graph = { nodes: [node], wires: [] }
  const set = (patch, changed) => setParams((p) => nextParams(def, { params: p ?? defined.defaults(type) }, patch, changed, defined.ops))
  const ctx = { view: NONE, board: { circuit: graph, parts }, path: [], readOnly: false }
  const value = () => <span className="pp-value">{tr("值")}</span>
  const shown = { ...defined, value }
  const { mark } = marker(edit)
  const face = (name, extra = {}) => <PartFace def={def} face={name} node={node} ctx={ctx} set={set} defined={shown} mark={mark} {...extra} />
  if (scene === 'card') return <div className="pp-card"><CanvasCard node={node} parts={parts} body={() => face('card')} /></div>
  if (scene === 'tile') {
    const tile = blocksOf(def, 'tile')
    return (
      <div className="pp-slots">
        <SlotBoard fixed graph={graph} parts={parts} nameOf={() => L(def.name)}
          thumb={() => face('tile', { blocks: tile.filter(([block]) => block.show === 'value') })}
          tileExtra={() => face('tile', { blocks: tile.filter(([block]) => block.show !== 'value') })} onPort={ignore} onNode={ignore} />
      </div>
    )
  }
  return (
    <div className="pp-detail">
      <h3 {...mark(['name'])}>{L(def.name)}</h3>
      {face('detail', { roomy: true })}
    </div>
  )
}

// A part the game defines (its primitives, and in some games built parts with a card of their own) has faces; any
// other built part shows the board it runs.
const faced = (part, game) => Boolean(game.defined?.of(part.type))

export function preview(part, { game, defined = game.defined, scene, edit = null, state = [undefined, () => {}], entry = null, phone = false, progress = {} }) {
  if (!entry && faced(part, game)) return <Face part={part} defined={defined} scene={scene} edit={edit} state={state} />
  // In the parts box (`entry`), and for a built part without faces, the detail is what the game draws to try the
  // part on: a built part's board, a bench.
  if (scene !== 'detail' || (!entry && !part.inside)) return null
  const shown = entry ?? game.parts?.all.find((p) => p.part === part.type) ?? { key: part.type, part: part.type }
  const { sample, experiment, inside, structureOnly } = game.parts?.preview?.(shown, { progress }) ?? {}
  if (entry && structureOnly) return inside ? <BuiltBoard key={shown.key} type={shown.part} defined={defined} {...inside} /> : null
  if (sample || experiment || inside) return <Fragment key={shown.key}>
    {sample && <SampleCircuit example={sample} defined={defined} phone={phone} />}
    {experiment && <PartExperiment spec={experiment} phone={phone} />}
    {inside && <BuiltBoard type={shown.part} defined={defined} {...inside} />}
  </Fragment>
  return faced(part, game) ? <Face part={part} defined={defined} scene={scene} edit={edit} state={state} /> : null
}

/** The fields no scene draws: a faced part's rows of fields and what it computes, or a built part's sheet. */
export function Sheet({ part, game, defined = game.defined, edit, state = [undefined, () => {}] }) {
  if (!faced(part, game)) return <PartSheet def={part} edit={edit} />
  const def = defined.of(part.type)
  const params = paramsOf(part.type, defined, state)
  const { add } = marker(edit)
  // What it computes, one expression an output; a part that keeps an input computes nothing.
  const operations = typeof def.op === 'string' ? [['', def.op]] : Object.entries(def.op ?? {})
  const rules = def.rules ?? []
  const checks = def.checks ?? []
  return (
    <div className="pp-logic">
      <Facts>
        {part.inside ? <Implementations def={part} edit={edit} /> : <Ports def={part} card={def} edit={edit} />}
        <Settings def={part} card={def} edit={edit} />
        {operations.length > 0 && (
          <Fact row="op" list={operations.length > 1}>
            {operations.map(([o, text]) => <Code key={o || 'out'} path={['op', ...(o ? [o] : [])]} label={o || null} text={text} picked={edit?.picked} />)}
          </Fact>
        )}
        {(rules.length > 0 || edit) && (
          <Fact row="rules" list empty={!rules.length} add={add(['rules'], L(ROWS.rules[2]))}>
            {rules.map((r, k) => <Code key={k} path={['rules', k]} label={r.on ? `on ${r.on}` : 'on *'} picked={edit?.picked} text={`${r.when ? `when ${r.when} → ` : ''}${Object.entries(r.set).map(([key, text]) => `${key} = ${text}`).join('; ')}`} />)}
          </Fact>
        )}
        {(checks.length > 0 || edit) && (
          <Fact row="checks" list empty={!checks.length} add={add(['checks'], L(ROWS.checks[2]))}>
            {checks.map((c, k) => <Code key={k} path={['checks', k]} picked={edit?.picked} text={c.holds} ok={Boolean(evalSettings(c.holds, def, params, defined.ops))} />)}
          </Fact>
        )}
      </Facts>
    </div>
  )
}

export default { preview, Sheet }
