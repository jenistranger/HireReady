import { useState, useEffect } from 'react'
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

export function App() {
  const [resumeText, setResumeText] = useState('')
  const [jobText, setJobText] = useState('')
  const [result, setResult] = useState('')
  const [template, setTemplate] = useState('default')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [expandOpen, setExpandOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [isFetchingUrl, setIsFetchingUrl] = useState(false)
  const [inputExpand, setInputExpand] = useState({ open: false, field: null })

  useEffect(() => {
    const handler = (e) => {
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
    const resume = resumeText.trim()
    const jobDescription = jobText.trim()
    setError(null)
    if (!resume) { setError('Please add your resume text or upload a PDF.'); return }
    if (!jobDescription) { setError('Please add the job description.'); return }
    setIsLoading(true)
    try {
      const tailored = await api.tailorResume(resume, jobDescription)
      setResult(tailored)
    } catch (e) {
      setError(e.message || 'Connection error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleExtractPdf(file, field) {
    setError(null)
    try {
      const text = await api.extractPdf(file)
      if (field === 'resume') setResumeText(text.slice(0, 3000))
      else setJobText(text.slice(0, 5000))
    } catch (e) {
      setError(e.message || 'Failed to read PDF. Check your connection.')
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
      setError(e.message || 'Failed to fetch URL. Check your connection.')
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
      setError(e.message || 'Failed to download PDF. Check your connection.')
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
    <div className={styles.wrapper}>
      <Navbar onProfileOpen={() => setProfileOpen(true)} />

      <div className={styles.main}>
        <div className={styles.leftCol}>
          <ResumeCard
            value={resumeText}
            onChange={setResumeText}
            onExpand={() => setInputExpand({ open: true, field: 'resume' })}
            onExtractPdf={handleExtractPdf}
          />
          <JobCard
            value={jobText}
            onChange={setJobText}
            onExpand={() => setInputExpand({ open: true, field: 'job' })}
            onExtractPdf={handleExtractPdf}
            onPasteLink={() => setLinkOpen(true)}
            onGenerate={handleGenerate}
            isLoading={isLoading}
          />
          <ProTip />
          <ErrorBanner message={error} />
        </div>

        <div className={styles.rightCol}>
          <PreviewCard
            result={result}
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
  )
}
