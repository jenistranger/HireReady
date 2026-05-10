import { useLang } from '../../LangContext'

export function ProTip() {
  const t = useLang()
  return (
    <div className="tip-box">
      <img src="/image/lightbulb.png" alt="" />
      <div>
        <p className="tip-label">{t.tip.label}</p>
        <p className="tip-text">{t.tip.text}</p>
      </div>
    </div>
  )
}
