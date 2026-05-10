import { useLang } from '../../LangContext'
import styles from './ProfileModal.module.css'

export function ProfileModal({ isOpen, onClose }) {
  const t = useLang()
  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>{t.profile.title}</span>
          <button className="expand-close" onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          <div className={styles.avatarSection}>
            <div className={styles.avatarLg}><span>AJ</span></div>
            <button className={styles.changePhotoBtn}>{t.profile.changePhoto}</button>
          </div>
          <div className={styles.divider}></div>
          <div className={styles.fields}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>{t.profile.firstName}</label>
                <input className={styles.input} type="text" placeholder="Alex" />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>{t.profile.lastName}</label>
                <input className={styles.input} type="text" placeholder="Johnson" />
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>{t.profile.email}</label>
              <input className={styles.input} type="email" placeholder="alex@email.com" />
            </div>
          </div>
          <div className={styles.divider}></div>
          <div className={styles.planRow}>
            <div className={styles.planLeft}>
              <span className={styles.planBadge}>{t.profile.plan}</span>
              <span className={styles.planDesc}>{t.profile.planDesc}</span>
            </div>
            <button className={styles.upgradeBtn}>{t.profile.upgrade}</button>
          </div>
        </div>
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>{t.profile.cancel}</button>
          <button className={styles.saveBtn}>{t.profile.save}</button>
        </div>
      </div>
    </div>
  )
}
