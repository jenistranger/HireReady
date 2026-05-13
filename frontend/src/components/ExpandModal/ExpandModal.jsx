import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import * as api from '../../api'
import styles from './ExpandModal.module.css'

export function ExpandModal({ isOpen, onClose, result, template, avatar }) {
  const t = useLang()
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(null)
  const lastUrl = useRef(null)

  useEffect(() => {
    if (!isOpen || !result) return
    let cancelled = false
    setError(null)
    api.previewPdf(result, template, { avatar }).then(blob => {
      if (cancelled) return
      const u = URL.createObjectURL(blob)
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current)
      lastUrl.current = u
      setUrl(u)
    }).catch(e => {
      if (!cancelled) setError(e.message || 'PDF render failed')
    })
    return () => { cancelled = true }
  }, [isOpen, result, template, avatar])

  useEffect(() => () => {
    if (lastUrl.current) URL.revokeObjectURL(lastUrl.current)
  }, [])

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <span>{t.expand.resumeTitle}</span>
          <button className="expand-close" onClick={onClose}>✕</button>
        </div>
        {error && <div className={styles.error}>{error}</div>}
        {url && !error && (
          <iframe className={styles.frame} src={`${url}#toolbar=0&navpanes=0`} title="resume" />
        )}
        {!url && !error && <div className={styles.loading}>{t.preview.rendering}</div>}
      </div>
    </div>
  )
}
