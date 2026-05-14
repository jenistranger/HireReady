import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { useAuth } from '../context/AuthContext'
import { Navbar } from '../components/Navbar/Navbar'
import { ResumeCard } from '../components/ResumeCard/ResumeCard'
import { JobCard } from '../components/JobCard/JobCard'
import { ProTip } from '../components/ProTip/ProTip'
import { ErrorBanner } from '../components/ErrorBanner/ErrorBanner'
import { PreviewCard, TEMPLATE_KEYS } from '../components/PreviewCard/PreviewCard'
import { ExpandModal } from '../components/ExpandModal/ExpandModal'
import { InputExpandModal } from '../components/InputExpandModal/InputExpandModal'
import { LinkModal } from '../components/LinkModal/LinkModal'
import * as api from '../api'
import styles from '../App.module.css'

const RESUME_MAX_LEN = 4000
const JOB_MAX_LEN = 6000

function hasCyrillic(value) {
  return /[А-Яа-яЁё]/.test(String(value || ''))
}

function structuredHasCyrillic(data) {
  const chunks = [
    data.name,
    data.headline,
    data.location,
    data.salaryExpectation,
    data.summary,
    ...(data.contacts || []).flatMap(c => [c.type, c.value]),
    ...(data.links || []),
    ...(data.experience || []).flatMap(e => [e.role, e.company, e.period, e.location, e.bullets]),
    ...(data.education || []).flatMap(e => [e.degree, e.institution, e.period]),
    ...(data.skills || []).flatMap(s => [s.label, s.value]),
  ]
  return chunks.some(hasCyrillic)
}

function serializeStructuredData(data) {
  const out = []
  const isRu = structuredHasCyrillic(data)
  const headings = isRu
    ? { summary: 'О СЕБЕ', experience: 'ОПЫТ РАБОТЫ', education: 'ОБРАЗОВАНИЕ', skills: 'НАВЫКИ' }
    : { summary: 'SUMMARY', experience: 'EXPERIENCE', education: 'EDUCATION', skills: 'SKILLS' }

  if (data.name) out.push(data.name)
  if (data.headline) out.push(data.headline)
  if (data.salaryExpectation && data.salaryExpectation.trim()) {
    out.push(`${isRu ? 'Ожидаемый доход' : 'Expected salary'}: ${data.salaryExpectation.trim()}`)
  }

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
    out.push(`## ${headings.summary}`)
    out.push(data.summary.trim())
  }

  const experience = (data.experience || []).filter(e => e.role || e.company)
  if (experience.length) {
    out.push('')
    out.push(`## ${headings.experience}`)
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
    out.push(`## ${headings.education}`)
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
    out.push(`## ${headings.skills}`)
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

export function AppPage() {
  const t = useLang()
  const { user, openLogin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Show auth error if redirected back from failed OAuth
  useEffect(() => {
    if (searchParams.get('auth_error')) {
      setError(t.auth.authError)
      setSearchParams({}, { replace: true })
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const [resumeText, setResumeText] = useState('')
  const [resumeMode, setResumeMode] = useState('text')
  const [structuredData, setStructuredData] = useState({
    name: '', headline: '', location: '',
    salaryExpectation: '',
    contacts: [{ type: '', value: '' }],
    summary: '',
    links: [''],
    experience: [],
    education: [],
    skills: [],
  })
  const [avatar, setAvatar] = useState(null)
  const [jobText, setJobText] = useState('')
  const [resumePdfFile, setResumePdfFile] = useState(null)
  const [jobPdfFile, setJobPdfFile] = useState(null)
  const [jobUrlSource, setJobUrlSource] = useState(null)
  const [result, setResult] = useState('')
  const [template, setTemplate] = useState(() =>
    TEMPLATE_KEYS.includes('awesome') ? 'awesome' : TEMPLATE_KEYS[0]
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isImproving, setIsImproving] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState(null)
  const [expandOpen, setExpandOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [isFetchingUrl, setIsFetchingUrl] = useState(false)
  const [inputExpand, setInputExpand] = useState({ open: false, field: null })

  useEffect(() => {
    if (!isLoading && !isImproving) { setElapsed(0); return }
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [isLoading, isImproving])

  useEffect(() => {
    return () => {
      if (resumePdfFile?.previewUrl) URL.revokeObjectURL(resumePdfFile.previewUrl)
    }
  }, [resumePdfFile])

  useEffect(() => {
    return () => {
      if (jobPdfFile?.previewUrl) URL.revokeObjectURL(jobPdfFile.previewUrl)
    }
  }, [jobPdfFile])

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
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  async function handleGenerate() {
    setError(null)
    if (!user) { openLogin(); return }
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

  handleGenerateRef.current = handleGenerate

  async function handleImprove() {
    setError(null)
    if (!user) { openLogin(); return }
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
      const fileState = { name: file.name, size: file.size, previewUrl: URL.createObjectURL(file) }
      if (field === 'resume') {
        setResumeText(text.slice(0, RESUME_MAX_LEN))
        setResumePdfFile(prev => {
          if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
          return fileState
        })
      } else {
        setJobText(text.slice(0, JOB_MAX_LEN))
        setJobUrlSource(null)
        setJobPdfFile(prev => {
          if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
          return fileState
        })
      }
    } catch (e) {
      setError(t.errors.pdfReadError)
    }
  }

  async function handleFetchUrl(url) {
    setIsFetchingUrl(true)
    try {
      const data = await api.fetchUrl(url)
      if (jobPdfFile?.previewUrl) URL.revokeObjectURL(jobPdfFile.previewUrl)
      setJobPdfFile(null)
      setJobText((data.text || '').slice(0, JOB_MAX_LEN))
      setJobUrlSource({
        title: data.title || t.urlSource?.untitled || 'Вакансия hh.ru',
        url: data.url || url,
      })
      setLinkOpen(false)
      setError(null)
    } catch (e) {
      setLinkOpen(false)
      setError(t.errors.urlFetchError)
    } finally {
      setIsFetchingUrl(false)
    }
  }

  function clearResumePdf() {
    setResumePdfFile(prev => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
    setResumeText('')
  }

  function clearJobPdf() {
    setJobPdfFile(prev => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
    setJobText('')
  }

  function clearJobUrlSource() {
    setJobUrlSource(null)
    setJobText('')
  }

  async function handleDownloadPdf() {
    if (!result) return
    try {
      const blob = await api.downloadPdf(result, template, avatar)
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
    <div className={styles.wrapper}>
      <Navbar />

      <div className={styles.main}>
        <div className={styles.leftCol}>
          <ResumeCard
            value={resumeText}
            onChange={setResumeText}
            onExpand={() => setInputExpand({ open: true, field: 'resume' })}
            onExtractPdf={handleExtractPdf}
            pdfFile={resumePdfFile}
            onClearPdf={clearResumePdf}
            mode={resumeMode}
            onModeChange={setResumeMode}
            structuredData={structuredData}
            onStructuredChange={setStructuredData}
            onImprove={handleImprove}
            canImprove={resumeNonEmpty}
            isImproving={isImproving}
            elapsed={elapsed}
            avatar={avatar}
            onAvatarChange={setAvatar}
          />
          <JobCard
            value={jobText}
            onChange={setJobText}
            onExpand={() => setInputExpand({ open: true, field: 'job' })}
            onExtractPdf={handleExtractPdf}
            pdfFile={jobPdfFile}
            onClearPdf={clearJobPdf}
            urlSource={jobUrlSource}
            onClearUrlSource={clearJobUrlSource}
            onPasteLink={() => setLinkOpen(true)}
            onGenerate={handleGenerate}
            isLoading={isLoading}
            isBusy={isLoading || isImproving}
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
            avatar={avatar}
          />
        </div>
      </div>

      <ExpandModal
        isOpen={expandOpen}
        onClose={() => setExpandOpen(false)}
        result={result}
        template={template}
        avatar={avatar}
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
