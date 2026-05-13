import { useState, useRef, useCallback, useEffect, lazy, Suspense } from 'react'
import { useLang } from '../../LangContext'
import { getCroppedImg, readFileAsDataURL } from '../../utils/cropImage'
import styles from './PhotoUpload.module.css'

// react-easy-crop весит ~50 KB. Загружаем только при открытии редактора.
const Cropper = lazy(() => import('react-easy-crop'))

const MAX_FILE_BYTES = 5 * 1024 * 1024
const ACCEPTED = 'image/jpeg,image/png,image/webp'

export function PhotoUpload({ value, onChange }) {
  const t = useLang()
  const s = t.photo
  const fileInputRef = useRef(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState(null)
  const [shape, setShape] = useState('circle')
  const [zoom, setZoom] = useState(1)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [croppedPixels, setCroppedPixels] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editorOpen) return
    const onKey = (e) => { if (e.key === 'Escape') closeEditor() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editorOpen])

  function closeEditor() {
    setEditorOpen(false)
    setImageSrc(null)
    setCroppedPixels(null)
    setError(null)
    setZoom(1)
    setCrop({ x: 0, y: 0 })
  }

  function openPicker() {
    setError(null)
    fileInputRef.current?.click()
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ACCEPTED.split(',').includes(file.type)) {
      setError(s.errorFormat)
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(s.errorSize)
      return
    }
    try {
      const dataUrl = await readFileAsDataURL(file)
      setImageSrc(dataUrl)
      setShape(value?.shape || 'circle')
      setZoom(1)
      setCrop({ x: 0, y: 0 })
      setCroppedPixels(null)
      setError(null)
      setEditorOpen(true)
    } catch (err) {
      setError(err.message || s.errorRead)
    }
  }

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedPixels(areaPixels)
  }, [])

  async function handleSave() {
    if (!croppedPixels || !imageSrc) return
    setSaving(true)
    try {
      const dataUrl = await getCroppedImg(imageSrc, croppedPixels)
      onChange({ base64: dataUrl, shape })
      closeEditor()
    } catch (err) {
      setError(err.message || s.errorRead)
    } finally {
      setSaving(false)
    }
  }

  function handleRemove() {
    onChange(null)
  }

  function handleEdit() {
    if (!value?.base64) return openPicker()
    setImageSrc(value.base64)
    setShape(value.shape || 'circle')
    setZoom(1)
    setCrop({ x: 0, y: 0 })
    setCroppedPixels(null)
    setError(null)
    setEditorOpen(true)
  }

  const hasPhoto = Boolean(value?.base64)

  return (
    <div className={styles.wrap}>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED}
        onChange={handleFileChange}
        hidden
      />

      <div className={styles.row}>
        <div
          className={`${styles.preview} ${value?.shape === 'square' ? styles.previewSquare : styles.previewCircle}`}
          onClick={hasPhoto ? handleEdit : openPicker}
          role="button"
          tabIndex={0}
        >
          {hasPhoto
            ? <img src={value.base64} alt="" />
            : <span className={styles.placeholder}>+</span>
          }
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.primaryBtn} onClick={hasPhoto ? handleEdit : openPicker}>
            {hasPhoto ? s.edit : s.upload}
          </button>
          {hasPhoto && (
            <button type="button" className={styles.ghostBtn} onClick={handleRemove}>
              {s.remove}
            </button>
          )}
          <span className={styles.hint}>{s.hint}</span>
        </div>
      </div>

      {error && !editorOpen && <div className={styles.errorLine}>{error}</div>}

      {editorOpen && (
        <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) closeEditor() }}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{s.editorTitle}</h3>
              <div className={styles.shapeToggle}>
                <button
                  type="button"
                  className={`${styles.shapeBtn} ${shape === 'circle' ? styles.shapeBtnActive : ''}`}
                  onClick={() => setShape('circle')}
                >
                  ⬤ {s.shapeCircle}
                </button>
                <button
                  type="button"
                  className={`${styles.shapeBtn} ${shape === 'square' ? styles.shapeBtnActive : ''}`}
                  onClick={() => setShape('square')}
                >
                  ▢ {s.shapeSquare}
                </button>
              </div>
            </div>

            <div className={styles.cropArea}>
              <Suspense fallback={<div className={styles.cropLoading}>…</div>}>
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape={shape === 'circle' ? 'round' : 'rect'}
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </Suspense>
            </div>

            <div className={styles.zoomRow}>
              <span className={styles.zoomLabel}>{s.zoom}</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className={styles.zoomSlider}
              />
            </div>

            {error && <div className={styles.errorLine}>{error}</div>}

            <div className={styles.modalFooter}>
              <button type="button" className={styles.cancelBtn} onClick={closeEditor}>
                {s.cancel}
              </button>
              <button
                type="button"
                className={styles.saveBtn}
                onClick={handleSave}
                disabled={saving || !croppedPixels}
              >
                {saving ? s.saving : s.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
