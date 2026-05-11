import { useRef } from 'react'
import { useLang } from '../../LangContext'
import { StructuredResumeForm } from '../StructuredResumeForm/StructuredResumeForm'
import styles from './ResumeCard.module.css'

const MAX_LEN = 3000

export function ResumeCard({
  value,
  onChange,
  onExpand,
  onExtractPdf,
  mode,
  onModeChange,
  structuredData,
  onStructuredChange,
  onImprove,
  canImprove,
  isImproving,
}) {
  const t = useLang()
  const fileRef = useRef(null)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    await onExtractPdf(file, 'resume')
    e.target.value = ''
  }

  return (
    <div className="card">
      <div className="card-inner">
        <div className="card-label-row">
          <p className="section-label">{t.resume.title}</p>
          {mode === 'text' && (
            <button className="icon-btn icon-btn-sm" onClick={onExpand}>
              <img src="/image/maximize2.png" alt="" />
            </button>
          )}
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${mode === 'text' ? styles.active : ''}`}
            onClick={() => onModeChange('text')}
          >
            {t.resume.tabText}
          </button>
          <button
            className={`${styles.tab} ${mode === 'structured' ? styles.active : ''}`}
            onClick={() => onModeChange('structured')}
          >
            {t.resume.tabFields}
          </button>
        </div>

        {mode === 'text' ? (
          <>
            <div className="textarea-box">
              <textarea
                className={styles.textarea}
                value={value}
                onChange={e => onChange(e.target.value)}
                maxLength={MAX_LEN}
                placeholder={t.resume.placeholder}
              />
            </div>
            <div className="counter-row">
              <p className="counter">{value.length} / {MAX_LEN}</p>
              <button className="btn-clear" onClick={() => onChange('')}>{t.resume.clear}</button>
            </div>
            <button className="btn-outline" onClick={() => fileRef.current?.click()}>
              <img src="/image/upload0.png" alt="" />
              <span>{t.resume.uploadPdf}</span>
            </button>
            <input ref={fileRef} type="file" accept=".pdf" hidden onChange={handleFile} />
          </>
        ) : (
          <StructuredResumeForm data={structuredData} onChange={onStructuredChange} />
        )}

        {onImprove && (
          <button
            className={styles.improveBtn}
            disabled={!canImprove || isImproving}
            onClick={onImprove}
          >
            <span className={styles.improveSparkle}>✨</span>
            <span>{isImproving ? t.improve?.running ?? 'Улучшаю…' : t.improve?.button ?? 'Улучшить резюме'}</span>
          </button>
        )}
      </div>
    </div>
  )
}
