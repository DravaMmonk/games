// The full id of what an editor has open, copied with one click (beside the id its head shows, often shortened): what
// levels, trays and tags name it by. An icon with its tooltip; it says it was copied for a moment, and stays quiet
// where the page cannot reach the clipboard.
import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { tr } from '../shell/i18n.js'

/** Copy `text` by selecting it in a field off screen: whether the page could. */
function copyBySelection(text) {
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.cssText = 'position:fixed;inset:0 auto auto -9999px;opacity:0'
  document.body.appendChild(field)
  field.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    field.remove()
  }
}

export default function CopyId({ id }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return undefined
    const timer = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copied])
  useEffect(() => setCopied(false), [id])
  if (!id) return null
  const copy = async (event) => {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
    } catch {
      // A page the clipboard API is closed to (embedded, or not focused) still copies what it selects.
      if (copyBySelection(id)) setCopied(true)
    }
  }
  const label = copied ? tr("已复制") : tr("复制 {id}", { id })
  return (
    <button type="button" className={`copy-id ${copied ? 'is-copied' : ''}`} title={label} aria-label={label} onClick={copy}>
      {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
    </button>
  )
}
