async function parseError(resp) {
  try {
    const data = await resp.json()
    const err = new Error(data.detail || `Server error: ${resp.status}`)
    err.status = resp.status
    return err
  } catch {
    const err = new Error(`Server error: ${resp.status}`)
    err.status = resp.status
    return err
  }
}

export async function tailorResume(resume, jobDescription) {
  const resp = await fetch('/api/tailor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resume, job_description: jobDescription }),
  })
  if (!resp.ok) throw await parseError(resp)
  const data = await resp.json()
  return data.tailored_resume
}

export async function extractPdf(file) {
  const formData = new FormData()
  formData.append('file', file)
  const resp = await fetch('/api/extract-pdf', { method: 'POST', body: formData })
  if (!resp.ok) throw await parseError(resp)
  const data = await resp.json()
  return data.text
}

export async function fetchUrl(url) {
  const resp = await fetch('/api/fetch-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!resp.ok) throw await parseError(resp)
  const data = await resp.json()
  return data.text
}

export async function downloadPdf(text, template) {
  const resp = await fetch('/api/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, template }),
  })
  if (!resp.ok) throw await parseError(resp)
  return resp.blob()
}
