import { parseResume } from './parseResume'

const TAG_TEMPLATES = new Set(['technical', 'creative'])

function esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderEntry(e) {
  const title = esc(e.title)
  const subtitle = e.subtitle
    ? `<span class="rv-entry-subtitle"> · ${esc(e.subtitle)}</span>`
    : ''
  const period = e.period ? `<span class="rv-entry-period">${esc(e.period)}</span>` : ''
  const location = e.location ? `<div class="rv-entry-location">${esc(e.location)}</div>` : ''
  const description = e.description ? `<div class="rv-entry-description">${esc(e.description)}</div>` : ''
  let bullets = ''
  if (e.bullets && e.bullets.length) {
    const items = e.bullets.map(b => `<li>${esc(b)}</li>`).join('')
    bullets = `<ul class="rv-entry-bullets">${items}</ul>`
  }
  return (
    `<div class="rv-entry">` +
    `<div class="rv-entry-header">` +
    `<span class="rv-entry-title">${title}${subtitle}</span>` +
    period +
    `</div>` +
    location +
    description +
    bullets +
    `</div>`
  )
}

function renderKvInline(items) {
  const rows = items.map(it => {
    if (it.label) {
      return (
        `<div class="rv-skill-row">` +
        `<span class="rv-skill-label">${esc(it.label)}:</span>` +
        `<span class="rv-skill-value">${esc(it.value)}</span>` +
        `</div>`
      )
    }
    return `<div class="rv-skill-row"><span class="rv-skill-value">${esc(it.value)}</span></div>`
  })
  return `<div class="rv-skill-list">${rows.join('')}</div>`
}

function renderKvTags(items) {
  const rows = items.map(it => {
    const tags = (it.value || '')
      .split(',')
      .map(v => v.trim())
      .filter(Boolean)
      .map(v => `<span class="rv-skill-tag">${esc(v)}</span>`)
      .join('')
    if (it.label) {
      return (
        `<div class="rv-skill-tag-row">` +
        `<span class="rv-skill-tag-label">${esc(it.label)}</span>` +
        tags +
        `</div>`
      )
    }
    return `<div class="rv-skill-tag-row">${tags}</div>`
  })
  return `<div class="rv-skill-tags">${rows.join('')}</div>`
}

export function renderResumeHtml(text, template = 'default') {
  const data = parseResume(text)
  const h = data.header

  const nameHtml = `<div class="rv-name">${esc(h.name)}</div>`
  const headlineHtml = h.headline ? `<div class="rv-headline">${esc(h.headline)}</div>` : ''
  let contactsHtml = ''
  if (h.contacts && h.contacts.length) {
    contactsHtml = `<div class="rv-contacts">${h.contacts.map(esc).join(' · ')}</div>`
  }

  const parts = []
  for (const sec of data.sections) {
    const title = esc(sec.title)
    let inner = ''
    if (sec.type === 'entries') {
      inner = (sec.entries || []).map(renderEntry).join('')
    } else if (sec.type === 'kv') {
      inner = TAG_TEMPLATES.has(template)
        ? renderKvTags(sec.items || [])
        : renderKvInline(sec.items || [])
    } else {
      inner = `<div class="rv-section-text">${esc(sec.content || '')}</div>`
    }
    const id = sec.title.toLowerCase().replace(/\s+/g, '-')
    parts.push(
      `<section class="rv-section" data-section="${id}">` +
      `<h2 class="rv-section-title">${title}</h2>` +
      inner +
      `</section>`
    )
  }

  return (
    `<div class="rv-resume" data-template="${esc(template)}">` +
    `<header class="rv-header">${nameHtml}${headlineHtml}${contactsHtml}</header>` +
    `<main class="rv-body">${parts.join('')}</main>` +
    `</div>`
  )
}
