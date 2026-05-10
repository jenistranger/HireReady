import styles from './ProfileModal.module.css'

export function ProfileModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>PROFILE</span>
          <button className="expand-close" onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          <div className={styles.avatarSection}>
            <div className={styles.avatarLg}><span>AJ</span></div>
            <button className={styles.changePhotoBtn}>Change Photo</button>
          </div>
          <div className={styles.divider}></div>
          <div className={styles.fields}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>FIRST NAME</label>
                <input className={styles.input} type="text" placeholder="Alex" />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>LAST NAME</label>
                <input className={styles.input} type="text" placeholder="Johnson" />
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>EMAIL</label>
              <input className={styles.input} type="email" placeholder="alex.johnson@email.com" />
            </div>
          </div>
          <div className={styles.divider}></div>
          <div className={styles.planRow}>
            <div className={styles.planLeft}>
              <span className={styles.planBadge}>FREE PLAN</span>
              <span className={styles.planDesc}>5 AI generations per month</span>
            </div>
            <button className={styles.upgradeBtn}>Upgrade →</button>
          </div>
        </div>
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn}>Save Changes</button>
        </div>
      </div>
    </div>
  )
}
