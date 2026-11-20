import { defaultOf } from '../core/parts/define.js'

/**
 * The game's definitions (`defined`: of, defaults, ops…) with a part's card as `definitionOf(type, base)` gives it
 * (nullish: the base), its defaults following that card's settings: a level's stages in play (CircuitScreen.jsx), the
 * stage picked on the studio's part page (studio/PartView.jsx).
 */
export function withDefinitions(defined, definitionOf) {
  return { ...defined,
    of: type => definitionOf(type, defined.of(type)) ?? defined.of(type),
    defaults: type => {
      const definition = definitionOf(type, defined.of(type))
      return definition ? Object.fromEntries(definition.settings.map(setting => [setting.key, defaultOf(setting)])) : defined.defaults(type)
    } }
}
