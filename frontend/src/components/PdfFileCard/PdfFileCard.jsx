import styles from './PdfFileCard.module.css'

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PdfFileCard({ file, labels, onReplace, onClear }) {
  return (
    <div className={styles.card}>
      <div className={styles.preview}>
        {file?.previewUrl ? (
          <iframe className={styles.frame} src={`${file.previewUrl}#toolbar=0&navpanes=0&view=FitH`} title={file.name} />
        ) : (
          <div className={styles.fallback}>PDF</div>
        )}
      </div>
      <div className={styles.meta}>
        <div>
          <p className={styles.name}>{file?.name || labels?.untitled || 'PDF'}</p>
          <p className={styles.size}>{formatBytes(file?.size)}</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.actionBtn} onClick={onReplace}>
            {labels?.replace || 'Replace PDF'}
          </button>
          <button type="button" className={styles.clearBtn} onClick={onClear}>
            {labels?.clear || 'Clear'}
          </button>
        </div>
      </div>
    </div>
  )
}
