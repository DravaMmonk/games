import { LoaderCircle } from 'lucide-react'
import { tr } from '../shell/i18n.js'
import './loading.css'

export default function Loading({ label = tr('读取中……') }) {
  return <div className="studio-loading" role="status">
    <LoaderCircle size={16} className="studio-spin" aria-hidden="true" />
    {label}
  </div>
}
