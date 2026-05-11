import { useState } from 'react'
import { useLang } from '../../LangContext'
import { ResumeRenderer } from '../ResumeRenderer/ResumeRenderer'
import styles from './PreviewCard.module.css'

const TEMPLATES = ['default', 'modern', 'corporate', 'minimal', 'technical', 'creative']

export function PreviewCard({ result, isLoading, template, onTemplateChange, onExpand, onDownloadPdf, onCopyText }) {
  const t = useLang()
  const [copyLabel, setCopyLabel] = useState(null)

  const showSkeleton = !result && !isLoading
  const showLoading = isLoading
  const showResult = !!result && !isLoading

  async function handleCopy() {
    await onCopyText()
    setCopyLabel(t.preview.copied)
    setTimeout(() => setCopyLabel(null), 2000)
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className="section-label">{t.preview.title}</span>
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
        {showLoading && <LoadingState label={t.preview.generating} />}
        {showResult && (
          <ResumeRenderer text={result} template={template} className={styles.previewResult} />
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.templateRow}>
          <span className={styles.templateLabel}>{t.preview.template}</span>
          <div className={styles.templateSelector}>
            {TEMPLATES.map(tpl => (
              <button
                key={tpl}
                className={`btn-tpl${template === tpl ? ' active' : ''}`}
                onClick={() => onTemplateChange(tpl)}
              >
                {tpl.charAt(0).toUpperCase() + tpl.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.footerActions}>
          <button className="btn-download" disabled={!result} onClick={onDownloadPdf}>
            <img src="/image/download.png" alt="" />
            <span>{t.preview.download}</span>
          </button>
          <button className="btn-copy" disabled={!result} onClick={handleCopy}>
            <img src="/image/Vector23.png" alt="" />
            <span>{copyLabel ?? t.preview.copy}</span>
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

function LoadingState({ label }) {
  return (
    <div className={styles.loadingState}>
      <div className={styles.spinnerRing}></div>
      <span>{label}</span>
    </div>
  )
}
