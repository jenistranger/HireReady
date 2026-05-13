import { useLang } from '../../LangContext'
import styles from './Navbar.module.css'

export function Navbar({ onProfileOpen, lang, onLangToggle }) {
  const t = useLang()
  const langLabel = lang === 'ru' ? '🇬🇧 EN' : '🇷🇺 RU'

  return (
    <div className={styles.wrapper}>
      <div className={styles.navbar}>
        <div className={styles.content}>
          <div className={styles.logo}>
            <img className={styles.logoSquare} src="/icon.svg" alt="hireslop.xyz" />
            <div className={styles.logoBar}>hireslop.xyz</div>
          </div>
          <div className={styles.spacer}></div>
          <button className="btn-lang" onClick={onLangToggle}>{langLabel}</button>
          <button className={styles.profileBtn} onClick={onProfileOpen}>
            <div className={styles.avatarCircle}>
              <span className={styles.avatarInitials}>AJ</span>
            </div>
            <span className={styles.profileLabel}>{t.navbar.profile}</span>
          </button>
        </div>
      </div>
      <div className={styles.border}></div>
    </div>
  )
}
