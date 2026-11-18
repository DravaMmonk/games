import { tr } from '../i18n.js'
import { FormulaText } from '../FormulaText.jsx'

export default function WorkGoal({ premises, goal }) {
  return (
    <section className="tm-given">
      {premises.length > 0 && <p>{tr("已知")} {premises.map(({ name, text }) => <span key={name} className="tm-premise"><code>{name}</code>：<FormulaText text={text} /></span>)}</p>}
      <p className="fo-say fo-prompt">{tr("要证")} <b><FormulaText text={goal} /></b></p>
    </section>
  )
}
