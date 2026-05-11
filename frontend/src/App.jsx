import { useState, useEffect, useRef } from 'react'
import { LangContext } from './LangContext'
import { RU, EN } from './i18n'
import { Navbar } from './components/Navbar/Navbar'
import { ResumeCard } from './components/ResumeCard/ResumeCard'
import { JobCard } from './components/JobCard/JobCard'
import { ProTip } from './components/ProTip/ProTip'
import { ErrorBanner } from './components/ErrorBanner/ErrorBanner'
import { PreviewCard } from './components/PreviewCard/PreviewCard'
import { ProfileModal } from './components/ProfileModal/ProfileModal'
import { ExpandModal } from './components/ExpandModal/ExpandModal'
import { InputExpandModal } from './components/InputExpandModal/InputExpandModal'
import { LinkModal } from './components/LinkModal/LinkModal'
import * as api from './api'
import styles from './App.module.css'

function serializeStructuredData(data) {
  const out = []

  if (data.name) out.push(data.name)
  if (data.headline) out.push(data.headline)

  const contactParts = []
  if (data.location) contactParts.push(data.location)
  for (const c of data.contacts || []) {
    if (c.value) contactParts.push(c.value.trim())
  }
  for (const l of data.links || []) {
    if (l && l.trim()) contactParts.push(l.trim())
  }
  if (contactParts.length) out.push(contactParts.join(' · '))

  if (data.summary && data.summary.trim()) {
    out.push('')
    out.push('## SUMMARY')
    out.push(data.summary.trim())
  }

  const experience = (data.experience || []).filter(e => e.role || e.company)
  if (experience.length) {
    out.push('')
    out.push('## EXPERIENCE')
    for (const e of experience) {
      out.push('')
      const headerParts = []
      if (e.role) headerParts.push(e.role)
      if (e.company) headerParts.push(e.company)
      out.push('### ' + headerParts.join(' · '))
      const meta = []
      if (e.period) meta.push(e.period)
      if (e.location) meta.push(e.location)
      if (meta.length) out.push(meta.join(' · '))
      const bullets = (e.bullets || '').split('\n').map(b => b.trim()).filter(Boolean)
      for (const b of bullets) out.push('* ' + b)
    }
  }

  const education = (data.education || []).filter(e => e.degree || e.institution)
  if (education.length) {
    out.push('')
    out.push('## EDUCATION')
    for (const e of education) {
      out.push('')
      const headerParts = []
      if (e.degree) headerParts.push(e.degree)
      if (e.institution) headerParts.push(e.institution)
      out.push('### ' + headerParts.join(' · '))
      if (e.period) out.push(e.period)
    }
  }

  const skills = (data.skills || []).filter(sk => sk.value)
  if (skills.length) {
    out.push('')
    out.push('## SKILLS')
    for (const sk of skills) {
      if (sk.label) {
        out.push(`**${sk.label}:** ${sk.value}`)
      } else {
        out.push(sk.value)
      }
    }
  }

  return out.join('\n').trim()
}

function resolveError(e, t) {
  const msg = e.message || ''
  if (e.status === 429 || msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
    return t.errors.rateLimit
  }
  if (e.status === 504 || msg.includes('504') || msg.toLowerCase().includes('timeout')) {
    return t.errors.timeout
  }
  return msg || t.errors.connectionError
}

export function App() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('lang') || 'ru' } catch { return 'ru' }
  })
  const t = lang === 'ru' ? RU : EN

  useEffect(() => {
    try { localStorage.setItem('lang', lang) } catch {}
    document.documentElement.lang = lang
  }, [lang])

  const [resumeText, setResumeText] = useState('')
  const [resumeMode, setResumeMode] = useState('text')
  const [structuredData, setStructuredData] = useState({
    name: '', headline: '', location: '',
    contacts: [{ type: '', value: '' }],
    summary: '',
    links: [''],
    experience: [],
    education: [],
    skills: [],
  })
  const [jobText, setJobText] = useState('')
  const [result, setResult] = useState('')
  const [template, setTemplate] = useState('awesome')
  const [isLoading, setIsLoading] = useState(false)
  const [isImproving, setIsImproving] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [expandOpen, setExpandOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [isFetchingUrl, setIsFetchingUrl] = useState(false)
  const [inputExpand, setInputExpand] = useState({ open: false, field: null })

  useEffect(() => {
    if (!isLoading) { setElapsed(0); return }
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [isLoading])

  // Keep a stable ref to handleGenerate for use in the keyboard effect
  const handleGenerateRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        handleGenerateRef.current?.()
        return
      }
      if (e.key === 'Escape') {
        setExpandOpen(false)
        setInputExpand({ open: false, field: null })
        setLinkOpen(false)
        setProfileOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  async function handleGenerate() {
    setError(null)
    let resume
    if (resumeMode === 'structured') {
      resume = serializeStructuredData(structuredData)
      if (!resume) { setError(t.errors.noStructured); return }
    } else {
      resume = resumeText.trim()
      if (!resume) { setError(t.errors.noResume); return }
    }
    const jobDescription = jobText.trim()
    if (!jobDescription) { setError(t.errors.noJob); return }
    setIsLoading(true)
    try {
      const tailored = await api.tailorResume(resume, jobDescription)
      setResult(tailored)
    } catch (e) {
      setError(resolveError(e, t))
    } finally {
      setIsLoading(false)
    }
  }

  // Update ref after every render so the keyboard handler always has latest version
  handleGenerateRef.current = handleGenerate

  async function handleImprove() {
    setError(null)
    let resume
    if (resumeMode === 'structured') {
      resume = serializeStructuredData(structuredData)
      if (!resume) { setError(t.errors.noStructured); return }
    } else {
      resume = resumeText.trim()
      if (!resume) { setError(t.errors.noResume); return }
    }
    setIsImproving(true)
    try {
      const improved = await api.improveResume(resume)
      setResult(improved)
    } catch (e) {
      setError(resolveError(e, t))
    } finally {
      setIsImproving(false)
    }
  }

  const resumeNonEmpty = resumeMode === 'structured'
    ? Boolean(serializeStructuredData(structuredData))
    : Boolean(resumeText.trim())
  const canGenerate = resumeNonEmpty && Boolean(jobText.trim())

  async function handleExtractPdf(file, field) {
    setError(null)
    try {
      const text = await api.extractPdf(file)
      if (field === 'resume') setResumeText(text.slice(0, 3000))
      else setJobText(text.slice(0, 5000))
    } catch (e) {
      setError(t.errors.pdfReadError)
    }
  }

  async function handleFetchUrl(url) {
    setIsFetchingUrl(true)
    try {
      const text = await api.fetchUrl(url)
      setJobText(text.slice(0, 5000))
      setLinkOpen(false)
      setError(null)
    } catch (e) {
      setLinkOpen(false)
      setError(t.errors.urlFetchError)
    } finally {
      setIsFetchingUrl(false)
    }
  }

  async function handleDownloadPdf() {
    if (!result) return
    try {
      const blob = await api.downloadPdf(result, template)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'resume.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(resolveError(e, t))
    }
  }

  async function handleCopyText() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = result
      ta.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
  }

  function handleInputExpandSave(newValue) {
    if (inputExpand.field === 'resume') setResumeText(newValue)
    else setJobText(newValue)
  }

  return (
    <LangContext.Provider value={t}>
      <div className={styles.wrapper}>
        <Navbar
          onProfileOpen={() => setProfileOpen(true)}
          lang={lang}
          onLangToggle={() => setLang(l => l === 'ru' ? 'en' : 'ru')}
        />

        <div className={styles.main}>
          <div className={styles.leftCol}>
            <ResumeCard
              value={resumeText}
              onChange={setResumeText}
              onExpand={() => setInputExpand({ open: true, field: 'resume' })}
              onExtractPdf={handleExtractPdf}
              mode={resumeMode}
              onModeChange={setResumeMode}
              structuredData={structuredData}
              onStructuredChange={setStructuredData}
              onImprove={handleImprove}
              canImprove={resumeNonEmpty}
              isImproving={isImproving}
            />
            <JobCard
              value={jobText}
              onChange={setJobText}
              onExpand={() => setInputExpand({ open: true, field: 'job' })}
              onExtractPdf={handleExtractPdf}
              onPasteLink={() => setLinkOpen(true)}
              onGenerate={handleGenerate}
              isLoading={isLoading || isImproving}
              elapsed={elapsed}
              canGenerate={canGenerate}
            />
            <ProTip />
            <ErrorBanner message={error} />
          </div>

          <div className={styles.rightCol}>
            <PreviewCard
              result={result}
              onResultChange={setResult}
              isLoading={isLoading}
              template={template}
              onTemplateChange={setTemplate}
              onExpand={() => result && setExpandOpen(true)}
              onDownloadPdf={handleDownloadPdf}
              onCopyText={handleCopyText}
            />
          </div>
        </div>

        <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
        <ExpandModal
          isOpen={expandOpen}
          onClose={() => setExpandOpen(false)}
          result={result}
          template={template}
        />
        <InputExpandModal
          isOpen={inputExpand.open}
          field={inputExpand.field}
          value={inputExpand.field === 'resume' ? resumeText : jobText}
          onSave={handleInputExpandSave}
          onClose={() => setInputExpand({ open: false, field: null })}
        />
        <LinkModal
          isOpen={linkOpen}
          onClose={() => setLinkOpen(false)}
          onFetch={handleFetchUrl}
          isFetching={isFetchingUrl}
        />
      </div>
    </LangContext.Provider>
  )
}
