export async function tailorResume(resume, jobDescription) {
  const resp = await fetch('/api/tailor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resume, job_description: jobDescription }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.detail || `Server error: ${resp.status}`);
  return data.tailored_resume;
}

export async function extractPdf(file) {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await fetch('/api/extract-pdf', { method: 'POST', body: formData });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.detail || 'Failed to extract PDF text');
  return data.text;
}

export async function fetchUrl(url) {
  const resp = await fetch('/api/fetch-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.detail || 'Failed to fetch URL');
  return data.text;
}

export async function downloadPdf(text, template) {
  const resp = await fetch('/api/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, template }),
  });
  if (!resp.ok) {
    const data = await resp.json();
    throw new Error(data.detail || 'PDF generation failed');
  }
  return resp.blob();
}
