import { copyWithoutTextKeys, declarationReader } from '../engine/catalogs.js'
import { currentLang } from '../lang.js'
import { isText, textIn } from '../engine/i18n.js'

export const uiKey = (base, context) => context ? `${base} ⟦${context}⟧` : base
export const uiBase = (key) => key.replace(/ ⟦[\w-]+⟧$/, '')

export function uiWords(catalogs) {
  const render = (lang, base, values, context) => {
    const key = uiKey(base, context)
    const entries = catalogs[lang]
    const template = entries && Object.hasOwn(entries, key) ? entries[key] : base
    return template.replace(/\{([\w]+)\}/g, (part, name) => {
      if (!values || !Object.hasOwn(values, name)) return part
      const value = values[name]
      return String(isText(value) ? (Object.hasOwn(value, lang) ? textIn(value, lang) : textIn(value, 'zh')) : value)
    })
  }
  return {
    tr: (base, values, context) => render(currentLang(), base, values, context),
    T: (base, values, context) => Object.fromEntries([...new Set(['zh', ...Object.keys(catalogs)])].map(lang => [lang, render(lang, base, values, context)])),
  }
}

export function declarationWords(catalogs) {
  const read = declarationReader(catalogs)
  return value => copyWithoutTextKeys(read(value))
}
