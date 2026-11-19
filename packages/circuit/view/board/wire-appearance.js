import { inPort, outPort, parsePort } from '../../core/board/model.js'
import { splitSource } from '../../core/wire-source.js'

export const DEFAULT_WIRE_PATTERN = 'solid'

export function portAppearance(parts, node, input, output = null) {
  const { shape, wire } = (node && parts.portAppearance?.(node, input, output)) ?? {}
  return {
    shape: shape === 'compact' ? 'compact' : 'standard',
    wire: [DEFAULT_WIRE_PATTERN, 'dashed', 'double'].includes(wire) ? wire : undefined,
  }
}

export function appearanceAt(parts, find, port) {
  const { side, id, port: input } = parsePort(port)
  if (side === 'in') return portAppearance(parts, find(id), input)
  const [node, key] = splitSource(id)
  return portAppearance(parts, find(node), null, key)
}

export function wirePattern(parts, find, wire) {
  return appearanceAt(parts, find, inPort(wire.to, wire.port)).wire
    ?? appearanceAt(parts, find, outPort(wire.from)).wire ?? DEFAULT_WIRE_PATTERN
}

// The string renderers use the same SVG layers and CSS as the editable canvas.
export function wireMarkup(d, pattern, { family, style = {}, draft = false, casing = true } = {}) {
  const paint = Object.entries(style).map(([key, value]) => `${key}:${value}`).join(';')
  return `<g class="kw${draft ? ' is-draft' : ''}" data-wire-pattern="${pattern}" data-family="${family ?? ''}" style="${paint}">`
    + (casing ? `<path class="kw-halo" d="${d}"/>` : '')
    + `<path class="kw-line" d="${d}"/>`
    + (pattern === 'double' ? `<path class="kw-gap" d="${d}"/>` : '') + '</g>'
}
