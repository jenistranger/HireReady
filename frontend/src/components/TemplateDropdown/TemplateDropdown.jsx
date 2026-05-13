import { useState, useRef, useEffect } from 'react'
import { useLang } from '../../LangContext'
import styles from './TemplateDropdown.module.css'

export function TemplateDropdown({ value, pending, onPendingChange, onApply, options, disabled }) {
  const t = useLang()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = options.find(o => o.key === pending) || options[0]
  const dirty = pending !== value

  function pick(key) {
    onPendingChange(key)
    setOpen(false)
  }

  return (
    <div className={styles.wrap} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        aria-expanded={open}
      >
        <span className={styles.triggerInner}>
          <span className={styles.triggerLabel}>{current?.label ?? pending}</span>
          <span className={styles.triggerDesc}>{current?.description}</span>
        </span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} aria-hidden>▾</span>
      </button>

      <button
        type="button"
        className={styles.applyBtn}
        onClick={onApply}
        disabled={!dirty || disabled}
      >
        {t.templates.apply}
      </button>

      {open && (
        <div className={styles.menu} role="listbox">
          {options.map(opt => {
            const isPending = opt.key === pending
            const isApplied = opt.key === value
            return (
              <button
                key={opt.key}
                type="button"
                role="option"
                aria-selected={isPending}
                className={`${styles.item} ${isPending ? styles.itemActive : ''}`}
                onClick={() => pick(opt.key)}
              >
                <span className={styles.itemMain}>
                  <span className={styles.itemLabel}>{opt.label}</span>
                  {isApplied && <span className={styles.itemBadge}>{t.templates.current}</span>}
                </span>
                <span className={styles.itemDesc}>{opt.description}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
