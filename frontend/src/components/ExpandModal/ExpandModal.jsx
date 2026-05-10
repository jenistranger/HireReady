import { ResumeRenderer } from '../ResumeRenderer/ResumeRenderer'
import styles from './ExpandModal.module.css'

export function ExpandModal({ isOpen, onClose, result, template }) {
  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <span>RESUME PREVIEW</span>
          <button className="expand-close" onClick={onClose}>✕</button>
        </div>
        {result && (
          <ResumeRenderer text={result} template={template} className={styles.content} />
        )}
      </div>
    </div>
  )
}
