function esc(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function renderResumeHtml(text) {
  const lines = text.split('\n')
  let i = 0
  let html = ''

  const headerLines = []
  while (i < lines.length && lines[i].trim()) {
    headerLines.push(lines[i].trim())
    i++
  }

  if (headerLines.length) {
    html += `<div class="rv-header">`
    html += `<div class="rv-name">${esc(headerLines[0])}</div>`
    if (headerLines.length > 1) {
      html += `<div class="rv-subtitle">${headerLines.slice(1).map(esc).join('<br>')}</div>`
    }
    html += `</div>`
  }

  html += `<div class="rv-body">`

  for (; i < lines.length; i++) {
    const s = lines[i].trim()
    if (!s) continue

    const isSection =
      s.endsWith(':') &&
      s.length < 80 &&
      !['*', '-', '•'].includes(s[0])

    const isBullet =
      s.length > 2 &&
      ['*', '-', '•'].includes(s[0]) &&
      s[1] === ' '

    if (isSection) {
      html += `<div class="rv-section-title">${esc(s.slice(0, -1))}</div>`
      html += `<div class="rv-section-line"></div>`
    } else if (isBullet) {
      html += `<div class="rv-bullet"><span class="rv-dot">•</span><span>${esc(s.slice(2))}</span></div>`
    } else {
      const cls = (s[0] === '—' || s[0] === '–') ? 'rv-muted' : 'rv-text'
      html += `<div class="${cls}">${esc(s)}</div>`
    }
  }

  html += `</div>`
  return html
}
