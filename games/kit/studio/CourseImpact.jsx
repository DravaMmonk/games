import { useEffect, useId, useRef } from 'react'
import { tr } from '../shell/i18n.js'

/** The plan stays visible until the author accepts it or closes the dialog. */
export default function CourseImpact({ plan, busy, problem, onClose, onConfirm, onChoose, closeLabel }) {
  const dialog = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])
  return (
    <dialog ref={dialog} className="course-impact" aria-labelledby={titleId}
      onKeyDown={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
      <header>
        <h2 id={titleId}>{plan.title}</h2>
        {plan.message && <p>{plan.message}</p>}
      </header>
      {plan.groups.length > 0 && <div className="course-impact-list">
        {plan.groups.map(({ title, items }, index) => (
          <section key={index}>
            {title && <h3>{title}</h3>}
            <ul>{items.map((item, k) => <li key={k}>{item}</li>)}</ul>
          </section>
        ))}
      </div>}
      {problem && <p className="is-error" role="alert">{problem}</p>}
      <footer className="review-actions">
        <button type="button" className="kit-btn is-label" disabled={busy} autoFocus onClick={onClose}>{closeLabel ?? ((plan.choices || plan.run) && !problem ? tr("取消") : tr("关闭"))}</button>
        {plan.choices?.map(choice => <button key={choice.action} type="button" className="kit-btn is-label"
          disabled={busy} onClick={() => onChoose(choice)}>{choice.action}</button>)}
        {plan.run && !problem && <button type="button" className="kit-btn is-label is-solid" disabled={busy} onClick={onConfirm}>
          {busy ? tr("检查中……") : plan.action}
        </button>}
      </footer>
    </dialog>
  )
}
