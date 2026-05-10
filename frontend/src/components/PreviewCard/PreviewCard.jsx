import { useState } from 'react'
import { ResumeRenderer } from '../ResumeRenderer/ResumeRenderer'
import styles from './PreviewCard.module.css'

const TEMPLATES = ['default', 'modern', 'corporate']

export function PreviewCard({ result, isLoading, template, onTemplateChange, onExpand, onDownloadPdf, onCopyText }) {
  const [copyLabel, setCopyLabel] = useState('Copy Text')

  const showSkeleton = !result && !isLoading
  const showLoading = isLoading
  const showResult = !!result && !isLoading

  async function handleCopy() {
    await onCopyText()
    setCopyLabel('Copied!')
    setTimeout(() => setCopyLabel('Copy Text'), 2000)
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className="section-label">PREVIEW</span>
        <div className={styles.headerRight}>
          <button className="icon-btn" onClick={onExpand} disabled={!result}>
            <img src="/image/maximize2.png" alt="" />
          </button>
          <button className="icon-btn" onClick={onDownloadPdf} disabled={!result}>
            <img src="/image/download0.png" alt="" />
          </button>
        </div>
      </div>

      <div className={styles.previewArea}>
        {showSkeleton && <SkeletonPaper />}
        {showLoading && <LoadingState />}
        {showResult && (
          <ResumeRenderer text={result} template={template} className={styles.previewResult} />
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.templateRow}>
          <span className={styles.templateLabel}>TEMPLATE</span>
          <div className={styles.templateSelector}>
            {TEMPLATES.map(t => (
              <button
                key={t}
                className={`btn-tpl${template === t ? ' active' : ''}`}
                onClick={() => onTemplateChange(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.footerActions}>
          <button className="btn-download" disabled={!result} onClick={onDownloadPdf}>
            <img src="/image/download.png" alt="" />
            <span>Download PDF</span>
          </button>
          <button className="btn-copy" disabled={!result} onClick={handleCopy}>
            <img src="/image/Vector23.png" alt="" />
            <span>{copyLabel}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function SkeletonPaper() {
  return (
    <div className={styles.paperCard}>
      <div className="skel skel-dark skel-title"></div>
      <div className="skel skel-dark skel-sub"></div>
      <div className="skel skel-body-wide"></div>
      <div className="skel-divider"></div>
      <div className="skel skel-dark" style={{ width: '80px', height: '8px' }}></div>
      <div className="skel skel-full"></div>
      <div className="skel skel-full"></div>
      <div className="skel" style={{ width: '290px', height: '8px' }}></div>
      <div className="skel-gap"></div>
      <div className="skel skel-dark" style={{ width: '100px', height: '8px' }}></div>
      <div className="skel skel-full"></div>
      <div className="skel skel-full"></div>
      <div className="skel" style={{ width: '260px', height: '8px' }}></div>
      <div className="skel-gap"></div>
      <div className="skel skel-dark" style={{ width: '70px', height: '8px' }}></div>
      <div className="skel skel-full"></div>
      <div className="skel" style={{ width: '300px', height: '8px' }}></div>
      <div className="skel" style={{ width: '200px', height: '8px' }}></div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className={styles.loadingState}>
      <div className={styles.spinnerRing}></div>
      <span>Generating resume...</span>
    </div>
  )
}
