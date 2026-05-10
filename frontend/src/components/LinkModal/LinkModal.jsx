import { useState, useEffect } from 'react'
import styles from './LinkModal.module.css'

export function LinkModal({ isOpen, onClose, onFetch, isFetching }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (isOpen) setUrl('')
  }, [isOpen])

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleFetch()
    if (e.key === 'Escape') onClose()
  }

  async function handleFetch() {
    const trimmed = url.trim()
    if (!trimmed) return
    await onFetch(trimmed)
    setUrl('')
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <h3 className={styles.title}>Paste job posting URL</h3>
        <input
          type="url"
          className={styles.input}
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://..."
          autoFocus
        />
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.fetchBtn} onClick={handleFetch} disabled={isFetching}>
            {isFetching ? 'Fetching...' : 'Fetch'}
          </button>
        </div>
      </div>
    </div>
  )
}
