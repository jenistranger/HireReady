import { useState, useEffect } from 'react'
import { useLang } from '../../LangContext'
import styles from './LinkModal.module.css'

export function LinkModal({ isOpen, onClose, onFetch, isFetching }) {
  const t = useLang()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setUrl('')
      setError('')
    }
  }, [isOpen])

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleFetch()
    if (e.key === 'Escape') onClose()
  }

  async function handleFetch() {
    const trimmed = url.trim()
    if (!trimmed) return
    if (!isHhUrl(trimmed)) {
      setError(t.link.hhOnlyError ?? 'Only hh.ru vacancy links are supported')
      return
    }
    await onFetch(trimmed)
    setUrl('')
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <h3 className={styles.title}>{t.link.title}</h3>
        <input
          type="url"
          className={styles.input}
          value={url}
          onChange={e => { setUrl(e.target.value); setError('') }}
          onKeyDown={handleKeyDown}
          placeholder="https://hh.ru/vacancy/..."
          autoFocus
        />
        <p className={styles.hint}>{t.link.hhOnlyHint ?? 'Only hh.ru vacancy links are supported.'}</p>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>{t.link.cancel}</button>
          <button className={styles.fetchBtn} onClick={handleFetch} disabled={isFetching}>
            {isFetching ? t.link.fetching : t.link.fetch}
          </button>
        </div>
      </div>
    </div>
  )
}

function isHhUrl(value) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return (url.protocol === 'https:' || url.protocol === 'http:') && (host === 'hh.ru' || host.endsWith('.hh.ru'))
  } catch {
    return false
  }
}
