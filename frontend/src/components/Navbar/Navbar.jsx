import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useLang, useLangControl } from '../../LangContext'
import { useAuth } from '../../context/AuthContext'
import { ProfileModal } from '../ProfileModal/ProfileModal'
import styles from './Navbar.module.css'

function UserAvatar({ user }) {
  if (user?.avatar_url) {
    return <img className={styles.avatarImg} src={user.avatar_url} alt="" referrerPolicy="no-referrer" />
  }
  const init = user?.name
    ? user.name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : (user?.email?.[0]?.toUpperCase() || '?')
  return (
    <div className={styles.avatarCircle}>
      <span className={styles.avatarInitials}>{init}</span>
    </div>
  )
}

export function Navbar() {
  const t = useLang()
  const { lang, toggleLang } = useLangControl()
  const { user, openLogin } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)
  const langLabel = lang === 'ru' ? '🇬🇧 EN' : '🇷🇺 RU'

  return (
    <>
      <div className={styles.wrapper}>
        <div className={styles.navbar}>
          <div className={styles.content}>
            <Link to="/" className={styles.logo}>
              <img className={styles.logoSquare} src="/icon.svg" alt="HireReady" />
              <div className={styles.logoBar}>hireslop.xyz</div>
            </Link>
            <nav className={styles.nav}>
              <NavLink
                to="/app"
                className={({ isActive }) => isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
              >
                {t.navbar.app}
              </NavLink>
              <NavLink
                to="/pricing"
                className={({ isActive }) => isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
              >
                {t.navbar.pricing}
              </NavLink>
            </nav>
            <div className={styles.spacer}></div>
            <button className="btn-lang" onClick={toggleLang}>{langLabel}</button>
            {user ? (
              <button className={styles.profileBtn} onClick={() => setProfileOpen(true)}>
                <UserAvatar user={user} />
                <span className={styles.profileLabel}>{user.name || user.email}</span>
              </button>
            ) : (
              <button className={styles.loginBtn} onClick={openLogin}>{t.navbar.login}</button>
            )}
          </div>
        </div>
        <div className={styles.border}></div>
      </div>
      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  )
}
