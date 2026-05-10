import { useLang } from '../../LangContext'
import styles from './StructuredResumeForm.module.css'

export function StructuredResumeForm({ data, onChange }) {
  const t = useLang()
  const s = t.structured

  function set(key, val) {
    onChange({ ...data, [key]: val })
  }

  function updateContact(i, field, val) {
    const contacts = data.contacts.map((c, idx) => idx === i ? { ...c, [field]: val } : c)
    set('contacts', contacts)
  }

  function addContact() {
    set('contacts', [...data.contacts, { type: '', value: '' }])
  }

  function removeContact(i) {
    set('contacts', data.contacts.filter((_, idx) => idx !== i))
  }

  function updateLink(i, val) {
    set('links', data.links.map((l, idx) => idx === i ? val : l))
  }

  function addLink() {
    set('links', [...data.links, ''])
  }

  function removeLink(i) {
    set('links', data.links.filter((_, idx) => idx !== i))
  }

  return (
    <div className={styles.form}>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>{s.name}</span>
        <input
          className={styles.fieldInput}
          type="text"
          placeholder={s.namePlaceholder}
          value={data.name}
          onChange={e => set('name', e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{s.headline}</span>
        <input
          className={styles.fieldInput}
          type="text"
          placeholder={s.headlinePlaceholder}
          value={data.headline}
          onChange={e => set('headline', e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{s.location}</span>
        <input
          className={styles.fieldInput}
          type="text"
          placeholder={s.locationPlaceholder}
          value={data.location}
          onChange={e => set('location', e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{s.contacts}</span>
        <div className={styles.dynamicList}>
          {data.contacts.map((c, i) => (
            <div key={i} className={styles.contactRow}>
              <input
                className={`${styles.fieldInput} ${styles.contactType}`}
                type="text"
                placeholder={s.phonePlaceholder}
                value={c.type}
                onChange={e => updateContact(i, 'type', e.target.value)}
              />
              <input
                className={`${styles.fieldInput} ${styles.contactValue}`}
                type="text"
                placeholder="+7 999 000 00 00"
                value={c.value}
                onChange={e => updateContact(i, 'value', e.target.value)}
              />
              {data.contacts.length > 1 && (
                <button className={styles.removeBtn} onClick={() => removeContact(i)}>×</button>
              )}
            </div>
          ))}
          <button className={styles.addBtn} onClick={addContact}>{s.addContact}</button>
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{s.summary}</span>
        <div className="textarea-box">
          <textarea
            className={styles.summaryTextarea}
            placeholder={s.summaryPlaceholder}
            value={data.summary}
            onChange={e => set('summary', e.target.value)}
          />
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{s.links}</span>
        <div className={styles.dynamicList}>
          {data.links.map((l, i) => (
            <div key={i} className={styles.linkRow}>
              <input
                className={`${styles.fieldInput} ${styles.linkInput}`}
                type="text"
                placeholder="https://github.com/username"
                value={l}
                onChange={e => updateLink(i, e.target.value)}
              />
              {data.links.length > 1 && (
                <button className={styles.removeBtn} onClick={() => removeLink(i)}>×</button>
              )}
            </div>
          ))}
          <button className={styles.addBtn} onClick={addLink}>{s.addLink}</button>
        </div>
      </div>
    </div>
  )
}
