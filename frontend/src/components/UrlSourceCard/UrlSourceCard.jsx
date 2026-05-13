import styles from './UrlSourceCard.module.css'

export function UrlSourceCard({ source, labels, onReplace, onClear }) {
  return (
    <div className={styles.card}>
      <div className={styles.icon}>hh</div>
      <div className={styles.meta}>
        <div>
          <p className={styles.title}>{source?.title || labels?.untitled || 'hh.ru vacancy'}</p>
          <p className={styles.url}>{source?.url || ''}</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.actionBtn} onClick={onReplace}>
            {labels?.replace || 'Replace link'}
          </button>
          <button type="button" className={styles.clearBtn} onClick={onClear}>
            {labels?.clear || 'Clear'}
          </button>
        </div>
      </div>
    </div>
  )
}
