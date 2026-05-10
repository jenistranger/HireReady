import { useRef } from 'react'
import styles from './ResumeCard.module.css'

const MAX_LEN = 3000

export function ResumeCard({ value, onChange, onExpand, onExtractPdf }) {
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
          <p className="section-label">YOUR RESUME</p>
          <button className="icon-btn icon-btn-sm" onClick={onExpand}>
            <img src="/image/maximize2.png" alt="" />
          </button>
        </div>
        <div className="textarea-box">
          <textarea
            className={styles.textarea}
            value={value}
            onChange={e => onChange(e.target.value)}
            maxLength={MAX_LEN}
            placeholder="Paste your current resume here, or type your experience, skills, and education..."
          />
        </div>
        <div className="counter-row">
          <p className="counter">{value.length} / {MAX_LEN}</p>
          <button className="btn-clear" onClick={() => onChange('')}>Clear</button>
        </div>
        <button className="btn-outline" onClick={() => fileRef.current?.click()}>
          <img src="/image/upload0.png" alt="" />
          <span>Upload PDF</span>
        </button>
        <input ref={fileRef} type="file" accept=".pdf" hidden onChange={handleFile} />
      </div>
    </div>
  )
}
