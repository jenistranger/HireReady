import styles from './Navbar.module.css'

export function Navbar({ onProfileOpen }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.navbar}>
        <div className={styles.content}>
          <div className={styles.logo}>
            <div className={styles.logoSquare}></div>
            <div className={styles.logoBar}></div>
          </div>
          <div className={styles.spacer}></div>
          <button className="btn-lang">En</button>
          <button className={styles.profileBtn} onClick={onProfileOpen}>
            <div className={styles.avatarCircle}>
              <span className={styles.avatarInitials}>AJ</span>
            </div>
            <span className={styles.profileLabel}>Profile</span>
          </button>
        </div>
      </div>
      <div className={styles.border}></div>
    </div>
  )
}
