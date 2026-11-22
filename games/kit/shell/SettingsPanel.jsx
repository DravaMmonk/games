import { useId, useState, useSyncExternalStore } from 'react'
import { Info } from 'lucide-react'
import { applyLang, currentLang, languageOptions } from '../lang.js'
import { applyTheme, THEMES } from '../theme.js'
import { L, tr } from './i18n.js'
import { PHONE, useMedia } from './useMedia.js'
import Popover from './Popover.jsx'
import { optionsFor, settings, settingsFor } from './settings.js'

function SettingTip({ id, text }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className="setting-tip-trigger" aria-label={tr('提示')} aria-describedby={id}
      aria-expanded={open} onClick={() => setOpen(!open)} onBlur={() => setOpen(false)}>
      <Info size={14} aria-hidden="true" />
    </button>
    <span className="setting-tip" id={id} role="tooltip">{L(text)}</span>
  </>
}

export default function SettingsPanel({ game, theme, onTheme, anchor, onClose }) {
  useSyncExternalStore(settings.subscribe, settings.snapshot, settings.snapshot)
  const panelId = useId()
  const phone = useMedia(PHONE)
  const entries = game ? settingsFor(game, { phone }) : []
  const chooseTheme = (id) => { applyTheme(id); onTheme(id); window.dispatchEvent(new CustomEvent('themechange', { detail: id })) }
  return <Popover className="player-settings-popover" anchor={anchor} title={tr('设置')} onClose={onClose}>
    <div className="player-settings">
      <section aria-label={tr('语言和主题')}>
        <div className="player-setting"><span>{tr('语言')}</span><span className="setting-options">{languageOptions().map(([id, label]) => <button type="button" key={id} lang={id === 'zh' ? 'zh-CN' : id} aria-pressed={currentLang() === id} onClick={() => applyLang(id)}>{label}</button>)}</span></div>
        <div className="player-setting"><span>{tr('主题')}</span><span className="setting-options">{THEMES.map(([id, label]) => <button type="button" key={id} aria-pressed={theme === id} onClick={() => chooseTheme(id)}>{L(label)}</button>)}</span></div>
      </section>
      {['display', 'edit'].map((group) => {
        const rows = entries.filter((s) => s.group === group)
        return rows.length > 0 && <section key={group} aria-label={group === 'display' ? tr('显示') : tr("编辑")}>
          {rows.map((setting) => {
            const value = settings.get(game, setting.key, { phone })
            const tipId = setting.tip ? `${panelId}-${setting.key}` : undefined
            return <div className="player-setting" key={setting.key}>
              <span className="setting-label">{L(setting.label)}{tipId && <SettingTip id={tipId} text={setting.tip} />}</span>
              {setting.kind === 'toggle' ? <button type="button" role="switch" aria-checked={value} aria-label={L(setting.label)} aria-describedby={tipId} onClick={() => settings.set(game, setting.key, !value)}><i /></button> : <span className="setting-options">{optionsFor(setting, game).map((option) => <button type="button" key={option.value} aria-pressed={value === option.value} onClick={() => settings.set(game, setting.key, option.value)}>{L(option.label)}</button>)}</span>}
            </div>
          })}
        </section>
      })}
      <button type="button" className="settings-reset" onClick={() => { if (game) settings.reset(game); applyLang(/^zh\b/i.test(navigator.language || '') ? 'zh' : 'en'); chooseTheme('paper') }}>{tr("恢复默认")}</button>
    </div>
  </Popover>
}
