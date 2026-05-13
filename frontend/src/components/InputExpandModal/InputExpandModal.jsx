import { useState, useEffect } from 'react'
import { useLang } from '../../LangContext'
import styles from './InputExpandModal.module.css'

export function InputExpandModal({ isOpen, field, value, onSave, onClose }) {
  const t = useLang()
  const [draft, setDraft] = useState(value)
  const maxLen = field === 'resume' ? 4000 : 6000
  const title = field === 'resume' ? t.inputExpand.resumeTitle : t.inputExpand.jobTitle

  useEffect(() => {
    if (isOpen) setDraft(value)
  }, [isOpen, value])

  function handleSave() {
    onSave(draft.slice(0, maxLen))
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          <button className="expand-close" onClick={onClose}>✕</button>
        </div>
        <textarea
          className={styles.textarea}
          value={draft}
          onChange={e => setDraft(e.target.value.slice(0, maxLen))}
          autoFocus
        />
        <div className={styles.footer}>
          <span className={styles.counter}>{draft.length} / {maxLen}</span>
          <button className={styles.cancelBtn} onClick={onClose}>{t.inputExpand.cancel}</button>
          <button className={styles.saveBtn} onClick={handleSave}>{t.inputExpand.save}</button>
        </div>
      </div>
    </div>
  )
}
