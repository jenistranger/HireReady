import { useLang } from '../../LangContext'
import styles from './LoginModal.module.css'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

function YandexIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="12" fill="#FC3F1D"/>
      <path d="M13.706 19H11.5V9.282H10.3c-1.842 0-2.808.952-2.808 2.36 0 1.59.684 2.332 2.093 3.264L10.9 16l-3.2 3H5.3l2.961-2.74C6.469 15.06 5.6 13.78 5.6 11.56c0-2.78 1.92-4.56 4.7-4.56h3.406V19z" fill="white"/>
    </svg>
  )
}

export function LoginModal({ isOpen, onClose }) {
  const t = useLang()
  const a = t.auth
  if (!isOpen) return null

  function loginWith(provider) {
    window.location.href = `/api/auth/${provider}/start`
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>{a.loginTitle}</span>
          <button className="expand-close" onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          <p className={styles.desc}>{a.loginDesc}</p>
          <button className={styles.providerBtn} onClick={() => loginWith('google')}>
            <GoogleIcon />
            {a.google}
          </button>
          <button className={`${styles.providerBtn} ${styles.yandexBtn}`} onClick={() => loginWith('yandex')}>
            <YandexIcon />
            {a.yandex}
          </button>
        </div>
      </div>
    </div>
  )
}
