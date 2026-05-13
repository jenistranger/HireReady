// Serialize a parsed-resume tree back to the structured-markdown format used
// by the AI and the LaTeX renderer. Mirror of backend/main.py parse_resume.

export function serializeResume(data) {
  const out = []
  const h = data.header || {}

  if (h.name) out.push(h.name.trim())
  if (h.headline) out.push(h.headline.trim())
  const salaryExpectation = (h.salaryExpectation || h.salary_expectation || '').trim()
  if (salaryExpectation) {
    const label = h.salaryLabel || h.salary_label || (/[А-Яа-яЁё]/.test(salaryExpectation) ? 'Ожидаемый доход' : 'Expected salary')
    out.push(`${label}: ${salaryExpectation}`)
  }
  if (h.contacts && h.contacts.length) {
    const contacts = h.contacts
      .map(c => (typeof c === 'string' ? c : c?.value || ''))
      .map(c => (c || '').trim())
      .filter(Boolean)
    if (contacts.length) out.push(contacts.join(' · '))
  }

  for (const sec of data.sections || []) {
    const title = (sec.title || '').trim()
    if (!title) continue

    if (sec.type === 'text') {
      const c = (sec.content || '').trim()
      if (!c) continue
      out.push('')
      out.push(`## ${title}`)
      if (c) out.push(c)
    } else if (sec.type === 'entries') {
      const sectionOut = []
      for (const e of sec.entries || []) {
        const bullets = (e.bullets || [])
          .map(b => (typeof b === 'string' ? b : b?.value || ''))
          .map(b => (b || '').trim())
          .filter(Boolean)
        const hasEntryContent = [
          e.title,
          e.subtitle,
          e.period,
          e.location,
          e.description,
          ...bullets,
        ].some(v => (v || '').trim())
        if (!hasEntryContent) continue
        sectionOut.push('')
        const head = [(e.title || '').trim(), (e.subtitle || '').trim()].filter(Boolean).join(' · ')
        sectionOut.push(`### ${head || 'Untitled'}`)
        const meta = [(e.period || '').trim(), (e.location || '').trim()].filter(Boolean).join(' · ')
        if (meta) sectionOut.push(meta)
        if (e.description && e.description.trim()) sectionOut.push(e.description.trim())
        for (const b of bullets) {
          sectionOut.push(`* ${b}`)
        }
      }
      if (!sectionOut.length) continue
      out.push('')
      out.push(`## ${title}`)
      out.push(...sectionOut)
    } else if (sec.type === 'kv') {
      const sectionOut = []
      for (const it of sec.items || []) {
        const label = (it.label || '').trim()
        const value = (it.value || '').trim()
        if (!value && !label) continue
        if (label) sectionOut.push(`**${label}:** ${value}`)
        else sectionOut.push(value)
      }
      if (!sectionOut.length) continue
      out.push('')
      out.push(`## ${title}`)
      out.push(...sectionOut)
    }
  }

  return out.join('\n').trim()
}
