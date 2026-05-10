import { useRef } from 'react'

const MAX_LEN = 5000

export function JobCard({ value, onChange, onExpand, onExtractPdf, onPasteLink, onGenerate, isLoading }) {
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
          <p className="section-label">JOB VACANCY</p>
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
            placeholder="Paste job description here..."
          />
        </div>
        <div className="counter-row">
          <p className="counter">{value.length} / {MAX_LEN}</p>
          <button className="btn-clear" onClick={() => onChange('')}>Clear</button>
        </div>
        <div className="btn-row">
          <button className="btn-outline" onClick={() => fileRef.current?.click()}>
            <img src="/image/upload.png" alt="" />
            <span>Upload PDF</span>
          </button>
          <button className="btn-outline" onClick={onPasteLink}>
            <img src="/image/link.png" alt="" />
            <span>Paste Link</span>
          </button>
        </div>
        <div className="divider"></div>
        <button className="btn-primary" onClick={onGenerate} disabled={isLoading}>
          <img src="/image/sparkles.png" alt="" />
          <span>{isLoading ? 'Generating...' : 'Generate Resume'}</span>
        </button>
        <input ref={fileRef} type="file" accept=".pdf" hidden onChange={handleFile} />
      </div>
    </div>
  )
}
