// Serialize a parsed-resume tree back to the structured-markdown format used
// by the AI and the LaTeX renderer. Mirror of backend/main.py parse_resume.

export function serializeResume(data) {
  const out = []
  const h = data.header || {}

  if (h.name) out.push(h.name.trim())
  if (h.headline) out.push(h.headline.trim())
  if (h.contacts && h.contacts.length) {
    out.push(h.contacts.map(c => (c || '').trim()).filter(Boolean).join(' · '))
  }

  for (const sec of data.sections || []) {
    const title = (sec.title || '').trim()
    if (!title) continue
    out.push('')
    out.push(`## ${title}`)

    if (sec.type === 'text') {
      const c = (sec.content || '').trim()
      if (c) out.push(c)
    } else if (sec.type === 'entries') {
      for (const e of sec.entries || []) {
        out.push('')
        const head = [(e.title || '').trim(), (e.subtitle || '').trim()].filter(Boolean).join(' · ')
        out.push(`### ${head}`)
        const meta = [(e.period || '').trim(), (e.location || '').trim()].filter(Boolean).join(' · ')
        if (meta) out.push(meta)
        if (e.description && e.description.trim()) out.push(e.description.trim())
        for (const b of e.bullets || []) {
          const bb = (b || '').trim()
          if (bb) out.push(`* ${bb}`)
        }
      }
    } else if (sec.type === 'kv') {
      for (const it of sec.items || []) {
        const label = (it.label || '').trim()
        const value = (it.value || '').trim()
        if (!value && !label) continue
        if (label) out.push(`**${label}:** ${value}`)
        else out.push(value)
      }
    }
  }

  return out.join('\n').trim()
}
