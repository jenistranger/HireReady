import { useState, useMemo } from 'react'
import { useLang } from '../../LangContext'
import { parseResume } from '../../utils/parseResume'
import { serializeResume } from './serialize'
import styles from './EditPanel.module.css'

// Block-level edit panel — pairs with the PDF iframe.
//
// We parse the markdown into a tree, list each editable block, and on click
// expand it inline with the right form fields. Save mutates the tree and
// re-serializes back to markdown, which triggers the PDF refresh upstream.

export function EditPanel({ result, onChange }) {
  const t = useLang()
  const [openId, setOpenId] = useState(null)
  const parsed = useMemo(() => parseResume(result), [result])

  function patch(mutator) {
    // Deep clone via structuredClone (parsed has only plain data)
    const next = structuredClone(parsed)
    mutator(next)
    onChange(serializeResume(next))
  }

  const blocks = []

  blocks.push({
    id: 'header',
    title: parsed.header.name || (t.edit?.header ?? 'Header'),
    subtitle: parsed.header.headline || '',
    render: () => <HeaderForm header={parsed.header} t={t} onPatch={patch} />,
  })

  parsed.sections.forEach((sec, sIdx) => {
    if (sec.type === 'text') {
      blocks.push({
        id: `text-${sIdx}`,
        title: sec.title,
        subtitle: (sec.content || '').slice(0, 50),
        render: () => (
          <TextForm
            value={sec.content || ''}
            onSave={v => patch(n => { n.sections[sIdx].content = v })}
          />
        ),
      })
    } else if (sec.type === 'entries') {
      sec.entries.forEach((e, eIdx) => {
        blocks.push({
          id: `entry-${sIdx}-${eIdx}`,
          title: e.title || (t.edit?.untitled ?? 'Untitled'),
          subtitle: [e.subtitle, e.period].filter(Boolean).join(' · '),
          render: () => (
            <EntryForm
              entry={e}
              t={t}
              onSave={updated => patch(n => { n.sections[sIdx].entries[eIdx] = updated })}
              onDelete={() => patch(n => { n.sections[sIdx].entries.splice(eIdx, 1) })}
            />
          ),
        })
      })
      blocks.push({
        id: `entry-add-${sIdx}`,
        title: `+ ${t.edit?.addEntry ?? 'Add entry'} (${sec.title})`,
        addEntry: true,
        onClick: () => patch(n => {
          n.sections[sIdx].entries.push({ title: '', subtitle: '', period: '', location: '', bullets: [], description: '' })
        }),
      })
    } else if (sec.type === 'kv') {
      sec.items.forEach((it, iIdx) => {
        blocks.push({
          id: `kv-${sIdx}-${iIdx}`,
          title: it.label || (t.edit?.skill ?? 'Skill'),
          subtitle: (it.value || '').slice(0, 60),
          render: () => (
            <SkillForm
              item={it}
              t={t}
              onSave={updated => patch(n => { n.sections[sIdx].items[iIdx] = updated })}
              onDelete={() => patch(n => { n.sections[sIdx].items.splice(iIdx, 1) })}
            />
          ),
        })
      })
      blocks.push({
        id: `kv-add-${sIdx}`,
        title: `+ ${t.edit?.addSkill ?? 'Add skill'} (${sec.title})`,
        addEntry: true,
        onClick: () => patch(n => {
          n.sections[sIdx].items.push({ label: '', value: '' })
        }),
      })
    }
  })

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span className="section-label">{t.edit?.title ?? 'EDIT'}</span>
      </div>
      <div className={styles.list}>
        {blocks.map(b => (
          <div key={b.id} className={`${styles.block} ${openId === b.id ? styles.open : ''}`}>
            <button
              className={styles.blockHeader}
              onClick={() => {
                if (b.onClick) b.onClick()
                else setOpenId(openId === b.id ? null : b.id)
              }}
            >
              <div className={styles.blockTitleRow}>
                <span className={styles.blockTitle}>{b.title}</span>
                {!b.addEntry && (
                  <span className={styles.editIcon}>{openId === b.id ? '▾' : '✎'}</span>
                )}
              </div>
              {b.subtitle && <span className={styles.blockSub}>{b.subtitle}</span>}
            </button>
            {openId === b.id && b.render && (
              <div className={styles.blockBody}>{b.render()}</div>
            )}
          </div>
        ))}
      </div>
    </aside>
  )
}

// ── Forms ──────────────────────────────────────────────────────────

function HeaderForm({ header, t, onPatch }) {
  const [name, setName] = useState(header.name || '')
  const [headline, setHeadline] = useState(header.headline || '')
  const [contacts, setContacts] = useState((header.contacts || []).join('\n'))

  function save() {
    onPatch(n => {
      n.header.name = name.trim()
      n.header.headline = headline.trim()
      n.header.contacts = contacts.split('\n').map(s => s.trim()).filter(Boolean)
    })
  }

  return (
    <>
      <label className={styles.label}>{t.edit?.name ?? 'Name'}</label>
      <input className={styles.input} value={name} onChange={e => setName(e.target.value)} />
      <label className={styles.label}>{t.edit?.headline ?? 'Headline'}</label>
      <input className={styles.input} value={headline} onChange={e => setHeadline(e.target.value)} />
      <label className={styles.label}>{t.edit?.contacts ?? 'Contacts (one per line)'}</label>
      <textarea
        className={styles.textarea}
        rows={4}
        value={contacts}
        onChange={e => setContacts(e.target.value)}
      />
      <SaveRow onSave={save} t={t} />
    </>
  )
}

function TextForm({ value, onSave }) {
  const [v, setV] = useState(value)
  const t = useLang()
  return (
    <>
      <textarea
        className={styles.textarea}
        rows={5}
        value={v}
        onChange={e => setV(e.target.value)}
      />
      <SaveRow onSave={() => onSave(v.trim())} t={t} />
    </>
  )
}

function EntryForm({ entry, t, onSave, onDelete }) {
  const [title, setTitle] = useState(entry.title || '')
  const [subtitle, setSubtitle] = useState(entry.subtitle || '')
  const [period, setPeriod] = useState(entry.period || '')
  const [location, setLocation] = useState(entry.location || '')
  const [bullets, setBullets] = useState((entry.bullets || []).join('\n'))
  const [description, setDescription] = useState(entry.description || '')

  function save() {
    onSave({
      title: title.trim(),
      subtitle: subtitle.trim(),
      period: period.trim(),
      location: location.trim(),
      bullets: bullets.split('\n').map(b => b.trim()).filter(Boolean),
      description: description.trim(),
    })
  }

  return (
    <>
      <div className={styles.grid2}>
        <div>
          <label className={styles.label}>{t.edit?.title2 ?? 'Title'}</label>
          <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label className={styles.label}>{t.edit?.subtitle ?? 'Subtitle'}</label>
          <input className={styles.input} value={subtitle} onChange={e => setSubtitle(e.target.value)} />
        </div>
      </div>
      <div className={styles.grid2}>
        <div>
          <label className={styles.label}>{t.edit?.period ?? 'Period'}</label>
          <input className={styles.input} value={period} onChange={e => setPeriod(e.target.value)} />
        </div>
        <div>
          <label className={styles.label}>{t.edit?.location ?? 'Location'}</label>
          <input className={styles.input} value={location} onChange={e => setLocation(e.target.value)} />
        </div>
      </div>
      <label className={styles.label}>{t.edit?.bullets ?? 'Bullets (one per line)'}</label>
      <textarea
        className={styles.textarea}
        rows={4}
        value={bullets}
        onChange={e => setBullets(e.target.value)}
      />
      {(description || '').trim() && (
        <>
          <label className={styles.label}>{t.edit?.description ?? 'Description'}</label>
          <textarea
            className={styles.textarea}
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </>
      )}
      <SaveRow onSave={save} onDelete={onDelete} t={t} />
    </>
  )
}

function SkillForm({ item, t, onSave, onDelete }) {
  const [label, setLabel] = useState(item.label || '')
  const [value, setValue] = useState(item.value || '')
  return (
    <>
      <label className={styles.label}>{t.edit?.skillLabel ?? 'Category'}</label>
      <input className={styles.input} value={label} onChange={e => setLabel(e.target.value)} />
      <label className={styles.label}>{t.edit?.skillValue ?? 'Skills'}</label>
      <textarea
        className={styles.textarea}
        rows={2}
        value={value}
        onChange={e => setValue(e.target.value)}
      />
      <SaveRow onSave={() => onSave({ label: label.trim(), value: value.trim() })} onDelete={onDelete} t={t} />
    </>
  )
}

function SaveRow({ onSave, onDelete, t }) {
  return (
    <div className={styles.actions}>
      {onDelete && (
        <button className={styles.deleteBtn} onClick={onDelete}>
          {t.edit?.delete ?? 'Удалить'}
        </button>
      )}
      <button className={styles.saveBtn} onClick={onSave}>
        {t.edit?.save ?? 'Сохранить'}
      </button>
    </div>
  )
}
