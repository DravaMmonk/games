import { inPort, outPort, parsePort } from '../../core/board/model.js'
import { splitSource } from '../../core/wire-source.js'

export function portPattern(parts, node, input, output = null) {
  const pattern = node && parts.portPattern?.(node, input, output)
  return ['solid', 'dashed', 'double'].includes(pattern) ? pattern : undefined
}

export function patternAt(parts, find, port) {
  const { side, id, port: input } = parsePort(port)
  if (side === 'in') return portPattern(parts, find(id), input)
  const [node, key] = splitSource(id)
  return portPattern(parts, find(node), null, key)
}

export function wirePattern(parts, find, wire) {
  return patternAt(parts, find, inPort(wire.to, wire.port))
    ?? patternAt(parts, find, outPort(wire.from)) ?? 'solid'
}

// The string renderers use the same SVG layers and CSS as the editable canvas.
export function wireMarkup(d, pattern, { family, style = {}, draft = false, casing = true } = {}) {
  const paint = Object.entries(style).map(([key, value]) => `${key}:${value}`).join(';')
  return `<g class="kw${draft ? ' is-draft' : ''}" data-wire-pattern="${pattern}" data-family="${family ?? ''}" style="${paint}">`
    + (casing ? `<path class="kw-halo" d="${d}"/>` : '')
    + `<path class="kw-line" d="${d}"/>`
    + (pattern === 'double' ? `<path class="kw-gap" d="${d}"/>` : '') + '</g>'
}
