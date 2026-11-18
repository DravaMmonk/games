import { useEffect, useState } from 'react'
import { FileCode2 } from 'lucide-react'
import { L, tr } from '../shell/i18n.js'
import { call } from './api.js'
import ListRow from './ListRow.jsx'
import './studio.css'

const query = new URLSearchParams(window.location.search)
const symbol = query.get('symbol') ?? ''

function sourceAddress(pkg, path = '') {
  const params = new URLSearchParams({ space: 'build', package: pkg, source: path })
  return `?${params}`
}

export default function PackageSource() {
  const [packages, setPackages] = useState([])
  const [error, setError] = useState('')
  const pkg = query.get('package') || packages[0]?.id
  const info = packages.find(item => item.id === pkg)
  useEffect(() => {
    call('source_packages', {}).then(setPackages, error => setError(error.message))
  }, [])
  return (
    <div className="studio package-source">
      <header className="kit-bar studio-bar">
        <a className="kit-btn is-label" href={`?space=build&package=${encodeURIComponent(pkg ?? '')}`}>{tr('返回构建', 'Back to Build')}</a>
        <label className="package-source-picker">
          <span>{tr('包源码', 'Package source')}</span>
          <select className="studio-game" aria-label={tr('源码包', 'Source package')} title={L(info?.desc)} value={pkg ?? ''} onChange={event => window.location.assign(sourceAddress(event.target.value))}>
            {pkg && !info && <option value={pkg}>{pkg}</option>}
            {packages.map(item => <option key={item.id} value={item.id} title={L(item.desc)}>{L(item.title)} · {item.id}</option>)}
          </select>
        </label>
      </header>
      {error && <p className="field-bad" role="alert">{error}</p>}
      {pkg && <SourceWorkspace key={pkg} pkg={pkg} />}
    </div>
  )
}

function SourceWorkspace({ pkg }) {
  const [listing, setListing] = useState(null)
  const [path, setPath] = useState(query.get('source') ?? '')
  const [refresh, setRefresh] = useState(0)
  const [filter, setFilter] = useState('')
  const [newPath, setNewPath] = useState(null)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [report, setReport] = useState(null)
  const dirty = Boolean(file && (file.revision === null || file.text !== file.original))
  const target = { package: pkg }
  const existing = listing?.files.includes(path) ?? false

  useEffect(() => {
    let active = true
    call('source_list', { package: pkg, ...(symbol && { symbol }) }).then(result => {
      if (!active) return
      setListing(result)
      setPath(current => result.files.includes(current) ? current : result.matches[0] || result.files[0] || '')
    }, error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [pkg])

  useEffect(() => {
    if (!existing) return
    let active = true
    call('source_read', { package: pkg, path }).then(data => {
      if (active) setFile({ ...data, original: data.text, path })
    }, error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [pkg, path, existing, refresh])

  useEffect(() => {
    if (!dirty && !busy) return
    const leave = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', leave)
    return () => window.removeEventListener('beforeunload', leave)
  }, [dirty, busy])

  const canLeave = () => !dirty || window.confirm(tr('放弃未保存的源码修改？', 'Discard unsaved source changes?'))
  const selectPath = next => {
    setPath(next)
    const url = new URL(window.location.href)
    url.searchParams.set('source', next)
    window.history.replaceState(null, '', url)
  }
  const open = next => {
    if (busy || (next === path && file?.revision === null) || !canLeave()) return
    setError('')
    setStatus('')
    setFile(null)
    selectPath(next)
    setRefresh(value => value + 1)
  }
  const create = event => {
    event.preventDefault()
    if (busy || !canLeave()) return
    const next = newPath.trim()
    if (!/^(?:core|view|test)(?:\/[\w-][\w.-]*)*\/[\w-][\w.-]*\.(?:js|jsx|mjs)$/.test(next)) {
      setError(tr('请输入 core/、view/ 或 test/ 下的 JS、JSX 或 MJS 文件路径。', 'Enter a JS, JSX or MJS file path under core/, view/ or test/.'))
      return
    }
    if (listing.files.includes(next)) {
      setError(tr('文件已存在。', 'This file already exists.'))
      return
    }
    setError('')
    setStatus('')
    setNewPath(null)
    setFilter('')
    selectPath(next)
    setFile({ path: next, text: '', original: '', revision: null })
  }
  const save = async () => {
    if (!dirty || busy) return
    setBusy(true)
    setError('')
    setStatus('')
    setReport(null)
    try {
      const data = await call('source_save', { ...target, path, text: file.text, base: file.revision })
      setFile({ ...data, original: data.text, path })
      if (file.revision === null) setListing(current => ({ ...current, files: [...current.files, path].sort() }))
      setStatus(tr('已保存到工作区', 'Saved to workspace'))
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }
  const check = async () => {
    setBusy(true)
    setError('')
    setReport(null)
    try {
      setReport(await call('source_check', target))
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }
  const visible = listing && [...listing.matches, ...listing.files.filter(name => !listing.matches.includes(name))]
    .filter(name => name.toLowerCase().includes(filter.toLowerCase()))
  const editor = file?.path === path ? file : null

  return (
    <div className="package-source-body">
      <aside className="studio-tree package-source-files" aria-label={tr('源码文件', 'Source files')}>
        <div className="insp-source-actions">
          <input className="field-input" type="search" aria-label={tr('筛选文件', 'Filter files')} placeholder={tr('筛选文件', 'Filter files')} value={filter} onChange={event => setFilter(event.target.value)} />
          <button className="kit-btn is-label" type="button" disabled={busy || !listing} onClick={() => setNewPath('core/')}>{tr('新建', 'New')}</button>
        </div>
        {symbol && listing && <p className="package-source-hint">{tr('符号匹配', 'Symbol matches')} <code>{symbol}</code> · {listing.matches.length}</p>}
        <ul>
          {visible?.map(name => (
            <li key={name}><ListRow icon={FileCode2} on={path === name} onClick={() => open(name)} title={name} /></li>
          ))}
        </ul>
        {listing?.files.length === 0 && <p className="package-source-hint">{tr('此包没有 JS 源文件', 'This package has no JS source files')}</p>}
      </aside>
      <main className="package-source-editor">
        {newPath !== null && <form className="insp-source-actions" onSubmit={create}>
          <input className="field-input" aria-label={tr('新文件路径', 'New file path')} value={newPath} onChange={event => setNewPath(event.target.value)} />
          <button className="kit-btn is-label" type="submit">{tr('创建草稿', 'Create draft')}</button>
          <button className="kit-btn is-label" type="button" onClick={() => setNewPath(null)}>{tr('取消', 'Cancel')}</button>
        </form>}
        {listing && <div className="insp-source-actions package-source-actions">
          {path && <code>{path}{dirty && ' *'}</code>}
          {existing && <button className="kit-btn is-label" type="button" disabled={busy} onClick={() => open(path)}>{tr('重新读取', 'Reload file')}</button>}
          <button className="kit-btn is-label is-solid" type="button" disabled={!dirty || busy} onClick={save}>{tr('保存源码', 'Save source')}</button>
          <button className="kit-btn is-label" type="button" disabled={busy || dirty} onClick={check}>{tr('检查包', 'Check package')}</button>
        </div>}
        {busy && <p role="status">{tr('处理中……', 'Working…')}</p>}
        {status && <p role="status">{status}</p>}
        {error && <pre className="field-bad package-source-report" role="alert">{error}</pre>}
        {editor && <textarea className="field-area is-code" aria-label={tr('JavaScript 源码', 'JavaScript source')} spellCheck={false} autoCapitalize="off" autoComplete="off"
          wrap="off" readOnly={busy} value={editor.text} onChange={event => setFile({ ...editor, text: event.target.value })}
          onKeyDown={event => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
              event.preventDefault()
              save()
            }
          }} />}
        {report && <section>
          <h2>{report.ok ? tr('包检查通过', 'Package checks passed') : tr('包检查失败', 'Package checks failed')}</h2>
          <pre className="package-source-report">{report.output}</pre>
        </section>}
      </main>
    </div>
  )
}
