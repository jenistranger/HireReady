import { useRef } from 'react'
import { useLang } from '../../LangContext'

const MAX_LEN = 5000

export function JobCard({ value, onChange, onExpand, onExtractPdf, onPasteLink, onGenerate, isLoading, elapsed }) {
  const t = useLang()
  const fileRef = useRef(null)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    await onExtractPdf(file, 'job')
    e.target.value = ''
  }

  return (
    <div className="card">
      <div className="card-inner-sm">
        <div className="card-label-row">
          <p className="section-label">{t.job.title}</p>
          <button className="icon-btn icon-btn-sm" onClick={onExpand}>
            <img src="/image/maximize2.png" alt="" />
          </button>
        </div>
        <div className="textarea-box">
          <textarea
            style={{ height: '130px' }}
            value={value}
            onChange={e => onChange(e.target.value)}
            maxLength={MAX_LEN}
            placeholder={t.job.placeholder}
          />
        </div>
        <div className="counter-row">
          <p className="counter">{value.length} / {MAX_LEN}</p>
          <button className="btn-clear" onClick={() => onChange('')}>{t.job.clear}</button>
        </div>
        <div className="btn-row">
          <button className="btn-outline" onClick={() => fileRef.current?.click()}>
            <img src="/image/upload.png" alt="" />
            <span>{t.job.uploadPdf}</span>
          </button>
          <button className="btn-outline" onClick={onPasteLink}>
            <img src="/image/link.png" alt="" />
            <span>{t.job.pasteLink}</span>
          </button>
        </div>
        <div className="divider"></div>
        <button className="btn-primary" onClick={onGenerate} disabled={isLoading}>
          <img src="/image/sparkles.png" alt="" />
          <span>{isLoading ? t.job.generating(elapsed) : t.job.generate}</span>
        </button>
        {isLoading && elapsed >= 30 && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted, #888)', marginTop: '6px', textAlign: 'center' }}>
            {t.job.slowWarning}
          </p>
        )}
        <input ref={fileRef} type="file" accept=".pdf" hidden onChange={handleFile} />
      </div>
    </div>
  )
}
