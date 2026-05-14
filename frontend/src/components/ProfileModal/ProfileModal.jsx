import { useLang } from '../../LangContext'
import { useAuth } from '../../context/AuthContext'
import styles from './ProfileModal.module.css'

function initials(name, email) {
  if (name) return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  if (email) return email[0].toUpperCase()
  return '?'
}

export function ProfileModal({ isOpen, onClose }) {
  const t = useLang()
  const { user, logout } = useAuth()
  if (!isOpen) return null

  async function handleLogout() {
    onClose()
    await logout()
  }

  const init = initials(user?.name, user?.email)

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>{t.profile.title}</span>
          <button className="expand-close" onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          <div className={styles.avatarSection}>
            {user?.avatar_url ? (
              <img className={styles.avatarLgImg} src={user.avatar_url} alt="" referrerPolicy="no-referrer" />
            ) : (
              <div className={styles.avatarLg}><span>{init}</span></div>
            )}
          </div>
          <div className={styles.divider}></div>
          <div className={styles.fields}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>{t.profile.firstName}</label>
              <div className={styles.fieldValue}>{user?.name || '—'}</div>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>{t.profile.email}</label>
              <div className={styles.fieldValue}>{user?.email || '—'}</div>
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
          <button className={styles.logoutBtn} onClick={handleLogout}>{t.auth.logout}</button>
          <button className={styles.cancelBtn} onClick={onClose}>{t.profile.cancel}</button>
        </div>
      </div>
    </div>
  )
}
