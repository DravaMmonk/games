import { readTag } from 'kernel'

export const PRIMITIVE_TAG = 'circuit/primitives'

/** The game's starting parts, ordered as authored for displays that list them. */
export const primitiveParts = content => content.standalone
  ? Object.keys(content.partDefs?.parts ?? content.registries?.['circuit/part'] ?? {})
  : readTag(content.registries, 'circuit/part', PRIMITIVE_TAG)
