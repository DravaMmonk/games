import { L, tr } from '../i18n.js'

export default function WorkGoal({ premises, goal }) {
  return (
    <section className="tm-given">
      {premises.length > 0 && <p>{tr("已知")} {premises.map(({ name, text }) => <span key={name} className="tm-premise"><code>{name}</code>：{L(text)}</span>)}</p>}
      <p className="fo-say fo-prompt">{tr("要证")} <b>{L(goal)}</b></p>
    </section>
  )
}
