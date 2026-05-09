const resumeTextarea      = document.getElementById('resume');
const jobTextarea         = document.getElementById('job-description');
const resumeCounter       = document.getElementById('resume-counter');
const jobCounter          = document.getElementById('job-counter');
const uploadResumeBtn     = document.getElementById('upload-resume-btn');
const resumeFile          = document.getElementById('resume-file');
const uploadJobBtn        = document.getElementById('upload-job-btn');
const jobFile             = document.getElementById('job-file');
const pasteLinkBtn        = document.getElementById('paste-link-btn');
const submitBtn           = document.getElementById('submit-btn');
const submitBtnText       = document.getElementById('submit-btn-text');
const pdfBtn              = document.getElementById('pdf-btn');
const pdfBtnText          = document.getElementById('pdf-btn-text');
const copyBtn             = document.getElementById('copy-btn');
const copyBtnText         = document.getElementById('copy-btn-text');
const errorBanner         = document.getElementById('error-banner');
const errorText           = document.getElementById('error-text');
const previewSkeleton     = document.getElementById('preview-skeleton');
const previewLoading      = document.getElementById('preview-loading');
const previewResult       = document.getElementById('preview-result');
const expandBtn           = document.getElementById('expand-btn');
const expandModal         = document.getElementById('expand-modal');
const expandContent       = document.getElementById('expand-content');
const expandClose         = document.getElementById('expand-close');
const previewDownloadIcon = document.getElementById('preview-download-icon');
const clearResumeBtn      = document.getElementById('clear-resume-btn');
const clearJobBtn         = document.getElementById('clear-job-btn');
const expandResumeBtn     = document.getElementById('expand-resume-btn');
const expandJobBtn        = document.getElementById('expand-job-btn');
const inputExpandModal    = document.getElementById('input-expand-modal');
const inputExpandTitle    = document.getElementById('input-expand-title');
const inputExpandTextarea = document.getElementById('input-expand-textarea');
const inputExpandClose    = document.getElementById('input-expand-close');
const inputExpandSave     = document.getElementById('input-expand-save');
const inputExpandCancel   = document.getElementById('input-expand-cancel');
const inputExpandCounter  = document.getElementById('input-expand-char-counter');
const linkOverlay         = document.getElementById('link-overlay');
const linkInput           = document.getElementById('link-input');
const linkCancel          = document.getElementById('link-cancel');
const linkFetch           = document.getElementById('link-fetch');

let currentResult   = '';
let currentTemplate = 'default';

// ── Template selector ─────────────────────────────────────────────
function applyTemplateToPreview() {
  previewResult.dataset.template   = currentTemplate;
  expandContent.dataset.template   = currentTemplate;
}

document.querySelectorAll('.btn-tpl').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-tpl').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTemplate = btn.dataset.tpl;
    applyTemplateToPreview();
  });
});

// ── Character counters ────────────────────────────────────────────
resumeTextarea.addEventListener('input', () => {
  resumeCounter.textContent = `${resumeTextarea.value.length} / 3000`;
});
jobTextarea.addEventListener('input', () => {
  jobCounter.textContent = `${jobTextarea.value.length} / 5000`;
});

// ── Clear buttons ─────────────────────────────────────────────────
clearResumeBtn.addEventListener('click', () => {
  resumeTextarea.value = '';
  resumeCounter.textContent = '0 / 3000';
});
clearJobBtn.addEventListener('click', () => {
  jobTextarea.value = '';
  jobCounter.textContent = '0 / 5000';
});

// ── Input expand modal ────────────────────────────────────────────
let _expandTarget = null;
let _expandMax = 0;
let _expandCounterEl = null;

function openInputExpand(textarea, counter, max, title) {
  _expandTarget    = textarea;
  _expandMax       = max;
  _expandCounterEl = counter;
  inputExpandTitle.textContent = title;
  inputExpandTextarea.value = textarea.value;
  inputExpandTextarea.maxLength = max;
  inputExpandCounter.textContent = `${textarea.value.length} / ${max}`;
  inputExpandModal.classList.add('open');
  inputExpandTextarea.focus();
}

function saveInputExpand() {
  if (!_expandTarget) return;
  _expandTarget.value = inputExpandTextarea.value.slice(0, _expandMax);
  _expandCounterEl.textContent = `${_expandTarget.value.length} / ${_expandMax}`;
  closeInputExpand();
}

function closeInputExpand() {
  inputExpandModal.classList.remove('open');
  _expandTarget = null;
}

inputExpandTextarea.addEventListener('input', () => {
  inputExpandCounter.textContent = `${inputExpandTextarea.value.length} / ${_expandMax}`;
});

expandResumeBtn.addEventListener('click', () =>
  openInputExpand(resumeTextarea, resumeCounter, 3000, 'YOUR RESUME')
);
expandJobBtn.addEventListener('click', () =>
  openInputExpand(jobTextarea, jobCounter, 5000, 'JOB VACANCY')
);
inputExpandSave.addEventListener('click', saveInputExpand);
inputExpandCancel.addEventListener('click', closeInputExpand);
inputExpandClose.addEventListener('click', closeInputExpand);
inputExpandModal.addEventListener('click', (e) => {
  if (e.target === inputExpandModal) closeInputExpand();
});

// ── PDF upload — resume ───────────────────────────────────────────
uploadResumeBtn.addEventListener('click', () => resumeFile.click());
resumeFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await extractPdf(file, resumeTextarea, resumeCounter, 3000);
  resumeFile.value = '';
});

// ── PDF upload — job ──────────────────────────────────────────────
uploadJobBtn.addEventListener('click', () => jobFile.click());
jobFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await extractPdf(file, jobTextarea, jobCounter, 5000);
  jobFile.value = '';
});

async function extractPdf(file, textarea, counter, maxLen) {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const resp = await fetch('/api/extract-pdf', { method: 'POST', body: formData });
    const data = await resp.json();
    if (resp.ok) {
      textarea.value = data.text.slice(0, maxLen);
      counter.textContent = `${textarea.value.length} / ${maxLen}`;
      hideError();
    } else {
      showError(data.detail || 'Failed to extract PDF text');
    }
  } catch {
    showError('Failed to read PDF. Check your connection.');
  }
}

// ── Paste Link modal ──────────────────────────────────────────────
pasteLinkBtn.addEventListener('click', () => {
  linkInput.value = '';
  linkOverlay.classList.add('open');
  linkInput.focus();
});
linkCancel.addEventListener('click', () => linkOverlay.classList.remove('open'));
linkOverlay.addEventListener('click', (e) => {
  if (e.target === linkOverlay) linkOverlay.classList.remove('open');
});
linkInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') linkFetch.click();
  if (e.key === 'Escape') linkOverlay.classList.remove('open');
});
linkFetch.addEventListener('click', async () => {
  const url = linkInput.value.trim();
  if (!url) return;
  linkFetch.textContent = 'Fetching...';
  linkFetch.disabled = true;
  try {
    const resp = await fetch('/api/fetch-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await resp.json();
    linkOverlay.classList.remove('open');
    if (resp.ok) {
      jobTextarea.value = data.text.slice(0, 5000);
      jobCounter.textContent = `${jobTextarea.value.length} / 5000`;
      hideError();
    } else {
      showError(data.detail || 'Failed to fetch URL');
    }
  } catch {
    linkOverlay.classList.remove('open');
    showError('Failed to fetch URL. Check your connection.');
  } finally {
    linkFetch.textContent = 'Fetch';
    linkFetch.disabled = false;
  }
});

// ── Generate Resume ───────────────────────────────────────────────
submitBtn.addEventListener('click', async () => {
  const resume = resumeTextarea.value.trim();
  const jobDescription = jobTextarea.value.trim();

  hideError();

  if (!resume) { showError('Please add your resume text or upload a PDF.'); return; }
  if (!jobDescription) { showError('Please add the job description.'); return; }

  setGenerating(true);

  try {
    const resp = await fetch('/api/tailor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume, job_description: jobDescription }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      showError(data.detail || `Server error: ${resp.status}`);
      setGenerating(false);
      return;
    }
    showResult(data.tailored_resume);
  } catch {
    showError('Connection error. Please try again.');
    setGenerating(false);
  }
});

function setGenerating(on) {
  submitBtn.disabled = on;
  submitBtnText.textContent = on ? 'Generating...' : 'Generate Resume';

  previewSkeleton.style.display = on ? 'none' : '';
  previewLoading.style.display  = on ? 'flex'  : 'none';
  if (on) previewResult.style.display = 'none';
}

function showResult(text) {
  currentResult = text;
  submitBtn.disabled = false;
  submitBtnText.textContent = 'Generate Resume';

  previewSkeleton.style.display = 'none';
  previewLoading.style.display  = 'none';
  previewResult.style.display   = 'block';
  previewResult.innerHTML = renderResumeHtml(text);
  previewResult.dataset.template = currentTemplate;

  pdfBtn.disabled  = false;
  copyBtn.disabled = false;
}

// ── Download PDF (footer button) ──────────────────────────────────
async function downloadPdf() {
  if (!currentResult) return;
  pdfBtnText.textContent = 'Generating...';
  pdfBtn.disabled = true;
  try {
    const resp = await fetch('/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: currentResult, template: currentTemplate }),
    });
    if (!resp.ok) {
      const data = await resp.json();
      showError(data.detail || 'PDF generation failed');
      return;
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'resume.pdf';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    showError('Failed to download PDF. Check your connection.');
  } finally {
    pdfBtnText.textContent = 'Download PDF';
    pdfBtn.disabled = false;
  }
}

pdfBtn.addEventListener('click', downloadPdf);

// ── Download icon in preview header ──────────────────────────────
previewDownloadIcon.addEventListener('click', downloadPdf);

// ── Copy Text ─────────────────────────────────────────────────────
copyBtn.addEventListener('click', async () => {
  if (!currentResult) return;
  try {
    await navigator.clipboard.writeText(currentResult);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = currentResult;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  copyBtnText.textContent = 'Copied!';
  setTimeout(() => { copyBtnText.textContent = 'Copy Text'; }, 2000);
});

// ── Expand (fullscreen) ───────────────────────────────────────────
expandBtn.addEventListener('click', () => {
  if (!currentResult) return;
  expandContent.innerHTML = renderResumeHtml(currentResult);
  expandContent.dataset.template = currentTemplate;
  expandModal.classList.add('open');
});
expandClose.addEventListener('click', () => expandModal.classList.remove('open'));
expandModal.addEventListener('click', (e) => {
  if (e.target === expandModal) expandModal.classList.remove('open');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    expandModal.classList.remove('open');
    closeInputExpand();
  }
});

// ── Error helpers ─────────────────────────────────────────────────
function showError(msg) {
  errorBanner.style.display = 'block';
  errorText.textContent = msg;
}
function hideError() {
  errorBanner.style.display = 'none';
}

// ── Resume HTML renderer ──────────────────────────────────────────
function esc(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderResumeHtml(text) {
  const lines = text.split('\n');
  let i = 0;
  let html = '';

  // Header block — everything before the first blank line
  const headerLines = [];
  while (i < lines.length && lines[i].trim()) {
    headerLines.push(lines[i].trim());
    i++;
  }

  if (headerLines.length) {
    html += `<div class="rv-header">`;
    html += `<div class="rv-name">${esc(headerLines[0])}</div>`;
    if (headerLines.length > 1) {
      html += `<div class="rv-subtitle">${headerLines.slice(1).map(esc).join('<br>')}</div>`;
    }
    html += `</div>`;
  }

  html += `<div class="rv-body">`;

  for (; i < lines.length; i++) {
    const s = lines[i].trim();
    if (!s) continue;

    const isSection =
      s.endsWith(':') &&
      s.length < 80 &&
      !['*', '-', '•'].includes(s[0]);

    const isBullet =
      s.length > 2 &&
      ['*', '-', '•'].includes(s[0]) &&
      s[1] === ' ';

    if (isSection) {
      html += `<div class="rv-section-title">${esc(s.slice(0, -1))}</div>`;
      html += `<div class="rv-section-line"></div>`;
    } else if (isBullet) {
      html += `<div class="rv-bullet"><span class="rv-dot">•</span><span>${esc(s.slice(2))}</span></div>`;
    } else {
      const cls = (s[0] === '—' || s[0] === '–') ? 'rv-muted' : 'rv-text';
      html += `<div class="${cls}">${esc(s)}</div>`;
    }
  }

  html += `</div>`;
  return html;
}
