const ENTRY_SECTIONS = new Set([
  'EXPERIENCE', 'WORK', 'WORK EXPERIENCE', 'EDUCATION', 'PROJECTS',
  'ОПЫТ', 'ОПЫТ РАБОТЫ', 'ОБРАЗОВАНИЕ', 'ПРОЕКТЫ',
])
const KV_SECTIONS = new Set([
  'SKILLS', 'TECHNOLOGIES', 'TECH STACK',
  'НАВЫКИ', 'СТЕК', 'ТЕХНОЛОГИИ',
])

function sectionType(title) {
  const t = (title || '').trim().toUpperCase()
  if (ENTRY_SECTIONS.has(t)) return 'entries'
  if (KV_SECTIONS.has(t)) return 'kv'
  return 'text'
}

function splitOnDot(line) {
  return line.split(/\s*[·•|]\s*/).map(s => s.trim()).filter(Boolean)
}

function parseEntries(buf) {
  const entries = []
  let cur = null
  for (const raw of buf) {
    const s = raw.trim()
    if (!s) continue
    if (s.startsWith('### ')) {
      if (cur) entries.push(cur)
      const titleText = s.slice(4).trim()
      const parts = titleText.split(/\s*·\s*/)
      cur = {
        title: parts[0] || '',
        subtitle: parts.slice(1).join(' · '),
        period: '',
        location: '',
        bullets: [],
        description: '',
      }
    } else if (cur) {
      if (s.startsWith('* ') || s.startsWith('- ') || s.startsWith('• ')) {
        cur.bullets.push(s.slice(2).trim())
      } else if (!cur.period && cur.bullets.length === 0) {
        const parts = s.split(/\s*·\s*/)
        cur.period = parts[0] || ''
        cur.location = parts.slice(1).join(' · ')
      } else {
        cur.description += (cur.description ? ' ' : '') + s
      }
    }
  }
  if (cur) entries.push(cur)
  return entries
}

function parseKv(buf) {
  const items = []
  const inline = []
  for (const raw of buf) {
    const s = raw.trim()
    if (!s) continue
    const m = s.match(/^\*\*\s*([^*]+?)\s*\*\*\s*:?\s*(.*)$/)
    if (m) {
      items.push({ label: m[1].trim().replace(/[:\s]+$/, ''), value: m[2].trim() })
    } else {
      inline.push(s)
    }
  }
  if (items.length === 0 && inline.length) {
    items.push({ label: '', value: inline.join(' ') })
  }
  return items
}

export function parseResume(text) {
  const lines = (text || '').split('\n')
  let i = 0

  const headerLines = []
  while (i < lines.length) {
    const s = lines[i].trim()
    if (s.startsWith('## ')) break
    if (s && !s.startsWith('```')) headerLines.push(s)
    i++
  }

  const name = headerLines[0] || ''
  const headline = headerLines[1] || ''
  const contacts = []
  for (const line of headerLines.slice(2)) {
    contacts.push(...splitOnDot(line))
  }

  const sections = []
  let currentTitle = null
  let currentBuf = []

  function flush() {
    if (currentTitle == null) return
    const type = sectionType(currentTitle)
    const section = { title: currentTitle, type }
    if (type === 'entries') {
      section.entries = parseEntries(currentBuf)
    } else if (type === 'kv') {
      section.items = parseKv(currentBuf)
    } else {
      section.content = currentBuf
        .filter(l => l.trim())
        .join('\n')
        .trim()
    }
    sections.push(section)
  }

  while (i < lines.length) {
    const s = lines[i].trim()
    if (s.startsWith('## ')) {
      flush()
      currentTitle = s.slice(3).trim()
      currentBuf = []
    } else if (currentTitle != null) {
      currentBuf.push(s)
    }
    i++
  }
  flush()

  return {
    header: { name, headline, contacts },
    sections,
  }
}
