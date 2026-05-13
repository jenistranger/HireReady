import { useState, useEffect, useRef, useMemo } from 'react'
import { useLang } from '../../LangContext'
import { EditPanel } from './EditPanel'
import { TemplateDropdown } from '../TemplateDropdown/TemplateDropdown'
import * as api from '../../api'
import styles from './PreviewCard.module.css'

export const TEMPLATE_KEYS = ['awesome', 'two_column', 'vivid', 'classic', 'engineer', 'academic', 'personal', 'hipster']

export function PreviewCard({
  result,
  onResultChange,
  isLoading,
  template,
  onTemplateChange,
  onExpand,
  onDownloadPdf,
  onCopyText,
  avatar,
}) {
  const t = useLang()
  const [copyLabel, setCopyLabel] = useState(null)
  const [pendingTemplate, setPendingTemplate] = useState(template)
  const [pdfUrl, setPdfUrl] = useState(null)

  useEffect(() => { setPendingTemplate(template) }, [template])

  const templateOptions = useMemo(() => TEMPLATE_KEYS.map(key => ({
    key,
    label: t.templates[key]?.label ?? key,
    description: t.templates[key]?.description ?? '',
  })), [t])
  const [pdfError, setPdfError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const abortRef = useRef(null)
  const lastUrlRef = useRef(null)

  // Debounced PDF refresh whenever result or template changes
  useEffect(() => {
    if (!result || !result.trim()) {
      // Clean up any stale preview
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current)
        lastUrlRef.current = null
      }
      setPdfUrl(null)
      setPdfError(null)
      return
    }
    const handle = setTimeout(async () => {
      // Cancel any in-flight request
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setRefreshing(true)
      setPdfError(null)
      try {
        const blob = await api.previewPdf(result, template, { signal: controller.signal, avatar })
        const url = URL.createObjectURL(blob)
        if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current)
        lastUrlRef.current = url
        setPdfUrl(url)
      } catch (e) {
        if (e.name === 'AbortError') return
        setPdfError(e.message || 'PDF render failed')
      } finally {
        if (abortRef.current === controller) {
          setRefreshing(false)
          abortRef.current = null
        }
      }
    }, 800)
    return () => clearTimeout(handle)
  }, [result, template, avatar])

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (abortRef.current) abortRef.current.abort()
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current)
    }
  }, [])

  const showEmpty = !result && !isLoading
  const showAiLoading = isLoading
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

      <div className={styles.templateRow}>
        <span className={styles.templateLabel}>{t.preview.template}</span>
        <TemplateDropdown
          value={template}
          pending={pendingTemplate}
          onPendingChange={setPendingTemplate}
          onApply={() => onTemplateChange(pendingTemplate)}
          options={templateOptions}
        />
      </div>

      <div className={styles.previewBody}>
        <div className={styles.previewArea}>
          {showEmpty && <SkeletonPaper />}
          {showAiLoading && <LoadingState label={t.preview.generating} />}
          {showResult && pdfError && (
            <div className={styles.errorState}>
              <strong>{t.preview.previewError ?? 'Не удалось отобразить превью'}</strong>
              <span>{pdfError}</span>
            </div>
          )}
          {showResult && !pdfError && pdfUrl && (
            <iframe
              key={template}
              className={styles.pdfFrame}
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
              title="resume-preview"
            />
          )}
          {showResult && !pdfError && !pdfUrl && (
            <LoadingState label={t.preview.rendering ?? 'Рендерю PDF…'} />
          )}
          {showResult && refreshing && pdfUrl && (
            <div className={styles.refreshBadge}>{t.preview.refreshing ?? 'Обновляю'}</div>
          )}
        </div>

        {showResult && onResultChange && (
          <EditPanel result={result} onChange={onResultChange} />
        )}
      </div>

      <div className={styles.footer}>
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
