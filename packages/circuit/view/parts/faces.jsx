import { applyRules, partDesc } from "../../core/parts/define.js"
import { settingsOf } from "../../core/parts.js"
import { isFixed, keepFixedSettings } from "../../core/board/presets.js"
import PartFace, { blocksOf, visibleSettings } from "./PartFace.jsx"
import { listSelectionPending } from './SettingField.jsx'
import { iconOf } from "./icons.js"

// What the shared editors and the circuit level need of defined parts (games/design/README.md 6.8): the cards' description
// for the editors (circuit/model.js), the parts to place, and the faces drawn by PartFace. A domain's level screen
// gives the circuit level `defined` = { of(type) → the part resolved or null, defaults(type), ops,
// value(node, ctx, output, face), widgets?, allowed?(type, key), frame? }; the nodes it does not define (the level's own, built parts) stay the domain's.
// A screen that draws something of its own on its parts gives `frame(drawn, { def, slot, node, ctx, set })`: it is
// handed each face as the kernel drew it (null when the face has nothing to draw) with the slot it fills ('card',
// 'thumb', 'tileExtra', 'detail'), and returns what stands there.

/** A defined part as the palette, the tray and an empty slot's sheet list it; `allowed(type, key)` the options open here. */
export const definedItem = (type, def, extra = {}, allowed = () => null) => ({ type, label: def.name, desc: partDesc(def, (key) => allowed(type, key)), icon: iconOf(def.icon), family: def.family, ...extra })

/** The settings a node is left with once the player set `patch` (changed: the key set, null for an action). */
export const nextParams = (def, node, patch, changed, ops) => {
  const params = keepFixedSettings(node, { ...node.params, ...patch })
  return applyRules(def, params, changed, ops, (key) => isFixed(node, key))
}

/**
 * The faces of defined parts over a domain's own (shell/CircuitLevel.jsx card): body (the card view), thumb and
 * tileExtra (the phone tile: its value blocks over the name, the rest under it), sheet (the detail view).
 */
export function definedFaces(faces, { defined, change, phone, tileSettings = true }) {
  const draw = (face, slot, other, blocks) => (node, ctx) => {
    const def = defined.of(node.type, face)
    if (!def) return other?.(node, ctx) ?? null
    const view = blocks?.(def, node, ctx)
    const set = ctx?.readOnly ? null : (patch, changed) => change(node, nextParams(def, node, patch, changed, defined.ops))
    const drawn = view?.length === 0 ? null : <PartFace def={def} face={face} node={node} ctx={ctx} set={set} defined={defined} phone={phone} roomy={face === 'detail'} blocks={view} />
    return defined.frame ? defined.frame(drawn, { def, slot, node, ctx, set }) : drawn
  }
  const tile = (pick) => (def) => blocksOf(def, 'tile').filter(([b]) => pick(b.show === 'value'))
  const tileExtra = (def, node, ctx) => {
    const params = node.params ?? {}
    const showSettings = tileSettings || settingsOf(def).some(setting => setting.single)
      || visibleSettings(def, params, defined, node, ctx).some(([setting]) => {
        if (!setting.formula || setting.control !== 'list') return false
        const allowed = defined.allowed?.(def.type, setting.key)
        const options = setting.options.filter(option => !allowed || allowed.includes(option.value))
        return listSelectionPending(options, params[setting.key] ?? setting.default)
      })
    return blocksOf(def, 'tile').filter(([block]) => block.show !== 'value' && (showSettings || block.show === 'text'))
  }
  return {
    ...faces,
    body: draw('card', 'card', faces.body),
    thumb: draw('tile', 'thumb', faces.thumb, tile((v) => v)),
    tileExtra: draw('tile', 'tileExtra', faces.tileExtra, tileExtra),
    detail: draw('detail', 'detail', faces.detail),
  }
}
