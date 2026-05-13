import { useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { parseResume } from '../../utils/parseResume'
import { serializeResume } from './serialize'
import styles from './EditPanel.module.css'

let nextId = 1

function uid(prefix) {
  nextId += 1
  return `${prefix}-${nextId}`
}

function withIds(doc) {
  return {
    header: {
      _id: doc.header?._id || uid('header'),
      name: doc.header?.name || '',
      headline: doc.header?.headline || '',
      salaryExpectation: doc.header?.salaryExpectation || doc.header?.salary_expectation || '',
      salaryLabel: doc.header?.salaryLabel || doc.header?.salary_label || '',
      contacts: (doc.header?.contacts || []).map(c => (
        typeof c === 'string' ? { _id: uid('contact'), value: c } : { _id: c._id || uid('contact'), value: c.value || '' }
      )),
    },
    sections: (doc.sections || []).map(sec => ({
      ...sec,
      _id: sec._id || uid('section'),
      entries: (sec.entries || []).map(entry => ({
        ...entry,
        _id: entry._id || uid('entry'),
        bullets: (entry.bullets || []).map(b => (
          typeof b === 'string' ? { _id: uid('bullet'), value: b } : { _id: b._id || uid('bullet'), value: b.value || '' }
        )),
      })),
      items: (sec.items || []).map(item => ({ ...item, _id: item._id || uid('item') })),
    })),
  }
}

function plainDoc(doc) {
  return {
    header: {
      name: doc.header?.name || '',
      headline: doc.header?.headline || '',
      salaryExpectation: doc.header?.salaryExpectation || '',
      salaryLabel: doc.header?.salaryLabel || '',
      contacts: (doc.header?.contacts || []).map(c => c.value ?? c).filter(c => (c || '').trim()),
    },
    sections: (doc.sections || []).map(sec => ({
      title: sec.title || '',
      type: sec.type || 'text',
      content: sec.content || '',
      entries: (sec.entries || []).map(entry => ({
        title: entry.title || '',
        subtitle: entry.subtitle || '',
        period: entry.period || '',
        location: entry.location || '',
        description: entry.description || '',
        bullets: (entry.bullets || []).map(b => b.value ?? b).filter(b => (b || '').trim()),
      })),
      items: (sec.items || []).map(item => ({
        label: item.label || '',
        value: item.value || '',
      })),
    })),
  }
}

function moveItem(list, from, to) {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function docHasCyrillic(doc) {
  const text = JSON.stringify(doc || '')
  return /[А-Яа-яЁё]/.test(text)
}

function emptySection(type, t, isRu = false) {
  if (type === 'entries') {
    return { _id: uid('section'), title: isRu ? 'ОПЫТ РАБОТЫ' : (t.edit?.newEntriesSection ?? 'Experience'), type, entries: [] }
  }
  if (type === 'kv') {
    return { _id: uid('section'), title: isRu ? 'НАВЫКИ' : (t.edit?.newKvSection ?? 'Skills'), type, items: [] }
  }
  return { _id: uid('section'), title: isRu ? 'О СЕБЕ' : (t.edit?.newTextSection ?? 'Summary'), type: 'text', content: '' }
}

function emptyEntry() {
  return { _id: uid('entry'), title: '', subtitle: '', period: '', location: '', description: '', bullets: [] }
}

function emptyBullet() {
  return { _id: uid('bullet'), value: '' }
}

function emptyContact() {
  return { _id: uid('contact'), value: '' }
}

function emptyItem() {
  return { _id: uid('item'), label: '', value: '' }
}

export function EditPanel({ result, onChange, renderError, refreshing }) {
  const t = useLang()
  const [resumeDoc, setResumeDoc] = useState(() => withIds(parseResume(result)))
  const [open, setOpen] = useState(() => new Set(['header']))
  const [newSectionType, setNewSectionType] = useState('text')
  const [saveState, setSaveState] = useState('saved')
  const lastSentRef = useRef(serializeResume(parseResume(result)))
  const skipAutosaveRef = useRef(true)

  useEffect(() => {
    if ((result || '').trim() === (lastSentRef.current || '').trim()) return
    skipAutosaveRef.current = true
    setResumeDoc(withIds(parseResume(result)))
    lastSentRef.current = serializeResume(parseResume(result))
    setSaveState('saved')
  }, [result])

  useEffect(() => {
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false
      return
    }
    const serialized = serializeResume(plainDoc(resumeDoc))
    if (serialized.trim() === (lastSentRef.current || '').trim()) {
      setSaveState('saved')
      return
    }
    setSaveState('saving')
    const handle = setTimeout(() => {
      lastSentRef.current = serialized
      onChange(serialized)
      setSaveState('saved')
    }, 300)
    return () => clearTimeout(handle)
  }, [resumeDoc, onChange])

  function update(mutator) {
    setResumeDoc(prev => {
      const next = structuredClone(prev)
      mutator(next)
      return next
    })
  }

  function toggle(id) {
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function addSection() {
    const section = emptySection(newSectionType, t, docHasCyrillic(resumeDoc))
    update(doc => { doc.sections.push(section) })
    setOpen(prev => new Set(prev).add(section._id))
  }

  const status = useMemo(() => {
    if (renderError) return t.edit?.renderError ?? 'Ошибка рендера'
    if (saveState === 'saving' || refreshing) return t.edit?.saving ?? 'Обновляю...'
    return t.edit?.saved ?? 'Сохранено'
  }, [renderError, refreshing, saveState, t])

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span className="section-label">{t.edit?.title ?? 'EDIT'}</span>
        <span className={`${styles.status} ${renderError ? styles.statusError : ''}`}>{status}</span>
      </div>

      <div className={styles.list}>
        <EditorBlock
          title={resumeDoc.header.name || (t.edit?.header ?? 'Header')}
          subtitle={resumeDoc.header.headline}
          open={open.has('header')}
          onToggle={() => toggle('header')}
        >
          <HeaderEditor doc={resumeDoc} update={update} t={t} />
        </EditorBlock>

        {resumeDoc.sections.map((section, sIdx) => (
          <EditorBlock
            key={section._id}
            title={section.title || (t.edit?.untitledSection ?? 'Untitled section')}
            subtitle={section.type}
            open={open.has(section._id)}
            onToggle={() => toggle(section._id)}
            actions={
              <ReorderDelete
                t={t}
                canUp={sIdx > 0}
                canDown={sIdx < resumeDoc.sections.length - 1}
                onUp={() => update(doc => { doc.sections = moveItem(doc.sections, sIdx, sIdx - 1) })}
                onDown={() => update(doc => { doc.sections = moveItem(doc.sections, sIdx, sIdx + 1) })}
                onDelete={() => update(doc => { doc.sections.splice(sIdx, 1) })}
              />
            }
          >
            <SectionEditor section={section} sectionIndex={sIdx} doc={resumeDoc} update={update} t={t} />
          </EditorBlock>
        ))}

        <div className={styles.addSection}>
          <select
            className={styles.select}
            value={newSectionType}
            onChange={e => setNewSectionType(e.target.value)}
            aria-label={t.edit?.sectionType ?? 'Section type'}
          >
            <option value="text">{t.edit?.typeText ?? 'Text'}</option>
            <option value="entries">{t.edit?.typeEntries ?? 'Entries'}</option>
            <option value="kv">{t.edit?.typeKv ?? 'Categories'}</option>
          </select>
          <button className={styles.addBtn} type="button" onClick={addSection}>
            {t.edit?.addSection ?? '+ Add section'}
          </button>
        </div>
      </div>
    </aside>
  )
}

function EditorBlock({ title, subtitle, open, onToggle, actions, children }) {
  return (
    <section className={`${styles.block} ${open ? styles.open : ''}`}>
      <div className={styles.blockTop}>
        <button className={styles.blockHeader} type="button" onClick={onToggle}>
          <span className={styles.blockTitleRow}>
            <span className={styles.blockTitle}>{title}</span>
            <span className={styles.editIcon}>{open ? 'v' : '>'}</span>
          </span>
          {subtitle && <span className={styles.blockSub}>{subtitle}</span>}
        </button>
        {actions}
      </div>
      {open && <div className={styles.blockBody}>{children}</div>}
    </section>
  )
}

function HeaderEditor({ doc, update, t }) {
  const contacts = doc.header.contacts || []
  return (
    <>
      <Field label={t.edit?.name ?? 'Name'} value={doc.header.name} onChange={value => update(d => { d.header.name = value })} />
      <Field label={t.edit?.headline ?? 'Headline'} value={doc.header.headline} onChange={value => update(d => { d.header.headline = value })} />
      <Field label={t.edit?.salaryExpectation ?? 'Expected monthly income'} value={doc.header.salaryExpectation} onChange={value => update(d => { d.header.salaryExpectation = value })} />
      <ListHeader label={t.edit?.contacts ?? 'Contacts'} onAdd={() => update(d => { d.header.contacts.push(emptyContact()) })} addLabel={t.edit?.addContact ?? '+ Add'} />
      {contacts.map((contact, idx) => (
        <InlineRow key={contact._id}>
          <input
            className={styles.input}
            value={contact.value}
            onChange={e => update(d => { d.header.contacts[idx].value = e.target.value })}
          />
          <ReorderDelete
            t={t}
            compact
            canUp={idx > 0}
            canDown={idx < contacts.length - 1}
            onUp={() => update(d => { d.header.contacts = moveItem(d.header.contacts, idx, idx - 1) })}
            onDown={() => update(d => { d.header.contacts = moveItem(d.header.contacts, idx, idx + 1) })}
            onDelete={() => update(d => { d.header.contacts.splice(idx, 1) })}
          />
        </InlineRow>
      ))}
    </>
  )
}

function SectionEditor({ section, sectionIndex, doc, update, t }) {
  return (
    <>
      <Field label={t.edit?.sectionTitle ?? 'Section title'} value={section.title} onChange={value => update(d => { d.sections[sectionIndex].title = value })} />
      {section.type === 'text' && (
        <TextArea label={t.edit?.content ?? 'Content'} value={section.content || ''} rows={5} onChange={value => update(d => { d.sections[sectionIndex].content = value })} />
      )}
      {section.type === 'entries' && (
        <EntriesEditor section={section} sectionIndex={sectionIndex} doc={doc} update={update} t={t} />
      )}
      {section.type === 'kv' && (
        <KvEditor section={section} sectionIndex={sectionIndex} update={update} t={t} />
      )}
    </>
  )
}

function EntriesEditor({ section, sectionIndex, doc, update, t }) {
  return (
    <div className={styles.subList}>
      <ListHeader
        label={t.edit?.entries ?? 'Entries'}
        addLabel={t.edit?.addEntry ?? '+ Add entry'}
        onAdd={() => update(d => { d.sections[sectionIndex].entries.push(emptyEntry()) })}
      />
      {(section.entries || []).map((entry, eIdx) => (
        <div key={entry._id} className={styles.subBlock}>
          <div className={styles.subHeader}>
            <span>{entry.title || (t.edit?.untitled ?? 'Untitled')}</span>
            <ReorderDelete
              t={t}
              compact
              canUp={eIdx > 0}
              canDown={eIdx < section.entries.length - 1}
              onUp={() => update(d => { d.sections[sectionIndex].entries = moveItem(d.sections[sectionIndex].entries, eIdx, eIdx - 1) })}
              onDown={() => update(d => { d.sections[sectionIndex].entries = moveItem(d.sections[sectionIndex].entries, eIdx, eIdx + 1) })}
              onDelete={() => update(d => { d.sections[sectionIndex].entries.splice(eIdx, 1) })}
            />
          </div>
          <div className={styles.grid2}>
            <Field label={t.edit?.title2 ?? 'Title'} value={entry.title} onChange={value => update(d => { d.sections[sectionIndex].entries[eIdx].title = value })} />
            <Field label={t.edit?.subtitle ?? 'Subtitle'} value={entry.subtitle} onChange={value => update(d => { d.sections[sectionIndex].entries[eIdx].subtitle = value })} />
          </div>
          <div className={styles.grid2}>
            <Field label={t.edit?.period ?? 'Period'} value={entry.period} onChange={value => update(d => { d.sections[sectionIndex].entries[eIdx].period = value })} />
            <Field label={t.edit?.location ?? 'Location'} value={entry.location} onChange={value => update(d => { d.sections[sectionIndex].entries[eIdx].location = value })} />
          </div>
          <TextArea label={t.edit?.description ?? 'Description'} value={entry.description || ''} rows={2} onChange={value => update(d => { d.sections[sectionIndex].entries[eIdx].description = value })} />
          <BulletsEditor
            bullets={entry.bullets || []}
            t={t}
            onAdd={() => update(d => { d.sections[sectionIndex].entries[eIdx].bullets.push(emptyBullet()) })}
            onChange={(bIdx, value) => update(d => { d.sections[sectionIndex].entries[eIdx].bullets[bIdx].value = value })}
            onMove={(bIdx, to) => update(d => { d.sections[sectionIndex].entries[eIdx].bullets = moveItem(d.sections[sectionIndex].entries[eIdx].bullets, bIdx, to) })}
            onDelete={bIdx => update(d => { d.sections[sectionIndex].entries[eIdx].bullets.splice(bIdx, 1) })}
          />
        </div>
      ))}
    </div>
  )
}

function BulletsEditor({ bullets, t, onAdd, onChange, onMove, onDelete }) {
  return (
    <div className={styles.subList}>
      <ListHeader label={t.edit?.bullets ?? 'Bullets'} addLabel={t.edit?.addBullet ?? '+ Add bullet'} onAdd={onAdd} />
      {bullets.map((bullet, idx) => (
        <InlineRow key={bullet._id}>
          <textarea
            className={styles.textarea}
            rows={2}
            value={bullet.value}
            onChange={e => onChange(idx, e.target.value)}
          />
          <ReorderDelete
            t={t}
            compact
            canUp={idx > 0}
            canDown={idx < bullets.length - 1}
            onUp={() => onMove(idx, idx - 1)}
            onDown={() => onMove(idx, idx + 1)}
            onDelete={() => onDelete(idx)}
          />
        </InlineRow>
      ))}
    </div>
  )
}

function KvEditor({ section, sectionIndex, update, t }) {
  const items = section.items || []
  return (
    <div className={styles.subList}>
      <ListHeader
        label={t.edit?.categories ?? 'Categories'}
        addLabel={t.edit?.addSkill ?? '+ Add category'}
        onAdd={() => update(d => { d.sections[sectionIndex].items.push(emptyItem()) })}
      />
      {items.map((item, idx) => (
        <div key={item._id} className={styles.subBlock}>
          <div className={styles.subHeader}>
            <span>{item.label || (t.edit?.skill ?? 'Skill')}</span>
            <ReorderDelete
              t={t}
              compact
              canUp={idx > 0}
              canDown={idx < items.length - 1}
              onUp={() => update(d => { d.sections[sectionIndex].items = moveItem(d.sections[sectionIndex].items, idx, idx - 1) })}
              onDown={() => update(d => { d.sections[sectionIndex].items = moveItem(d.sections[sectionIndex].items, idx, idx + 1) })}
              onDelete={() => update(d => { d.sections[sectionIndex].items.splice(idx, 1) })}
            />
          </div>
          <Field label={t.edit?.skillLabel ?? 'Category'} value={item.label} onChange={value => update(d => { d.sections[sectionIndex].items[idx].label = value })} />
          <TextArea label={t.edit?.skillValue ?? 'Skills'} value={item.value} rows={2} onChange={value => update(d => { d.sections[sectionIndex].items[idx].value = value })} />
        </div>
      ))}
    </div>
  )
}

function Field({ label, value, onChange }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input className={styles.input} value={value || ''} onChange={e => onChange(e.target.value)} />
    </label>
  )
}

function TextArea({ label, value, rows, onChange }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <textarea className={styles.textarea} rows={rows} value={value || ''} onChange={e => onChange(e.target.value)} />
    </label>
  )
}

function ListHeader({ label, addLabel, onAdd }) {
  return (
    <div className={styles.listHeader}>
      <span className={styles.label}>{label}</span>
      <button className={styles.addMiniBtn} type="button" onClick={onAdd}>{addLabel}</button>
    </div>
  )
}

function InlineRow({ children }) {
  return <div className={styles.inlineRow}>{children}</div>
}

function ReorderDelete({ t, canUp, canDown, onUp, onDown, onDelete, compact }) {
  return (
    <div className={`${styles.rowActions} ${compact ? styles.compactActions : ''}`} onClick={e => e.stopPropagation()}>
      <button type="button" className={styles.iconBtn} onClick={onUp} disabled={!canUp} aria-label={t.edit?.moveUp ?? 'Move up'} title={t.edit?.moveUp ?? 'Move up'}>↑</button>
      <button type="button" className={styles.iconBtn} onClick={onDown} disabled={!canDown} aria-label={t.edit?.moveDown ?? 'Move down'} title={t.edit?.moveDown ?? 'Move down'}>↓</button>
      <button type="button" className={styles.deleteBtn} onClick={onDelete}>{t.edit?.delete ?? 'Delete'}</button>
    </div>
  )
}
