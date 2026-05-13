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

  function updateExperience(i, field, val) {
    const arr = (data.experience || []).map((e, idx) => idx === i ? { ...e, [field]: val } : e)
    set('experience', arr)
  }

  function addExperience() {
    set('experience', [...(data.experience || []), { role: '', company: '', period: '', location: '', bullets: '' }])
  }

  function removeExperience(i) {
    set('experience', (data.experience || []).filter((_, idx) => idx !== i))
  }

  function updateEducation(i, field, val) {
    const arr = (data.education || []).map((e, idx) => idx === i ? { ...e, [field]: val } : e)
    set('education', arr)
  }

  function addEducation() {
    set('education', [...(data.education || []), { degree: '', institution: '', period: '' }])
  }

  function removeEducation(i) {
    set('education', (data.education || []).filter((_, idx) => idx !== i))
  }

  function updateSkill(i, field, val) {
    const arr = (data.skills || []).map((sk, idx) => idx === i ? { ...sk, [field]: val } : sk)
    set('skills', arr)
  }

  function addSkill() {
    set('skills', [...(data.skills || []), { label: '', value: '' }])
  }

  function removeSkill(i) {
    set('skills', (data.skills || []).filter((_, idx) => idx !== i))
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
        <span className={styles.fieldLabel}>{s.salaryExpectation}</span>
        <input
          className={styles.fieldInput}
          type="text"
          placeholder={s.salaryExpectationPlaceholder}
          value={data.salaryExpectation || ''}
          onChange={e => set('salaryExpectation', e.target.value)}
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
        <span className={styles.fieldLabel}>{s.experienceTitle}</span>
        <div className={styles.dynamicList}>
          {(data.experience || []).map((e, i) => (
            <div key={i} className={styles.entryBox}>
              <button className={`${styles.removeBtn} ${styles.entryRemove}`} onClick={() => removeExperience(i)}>×</button>
              <div className={styles.entryGrid}>
                <input
                  className={styles.fieldInput}
                  type="text"
                  placeholder={s.rolePlaceholder}
                  value={e.role}
                  onChange={ev => updateExperience(i, 'role', ev.target.value)}
                />
                <input
                  className={styles.fieldInput}
                  type="text"
                  placeholder={s.companyPlaceholder}
                  value={e.company}
                  onChange={ev => updateExperience(i, 'company', ev.target.value)}
                />
                <input
                  className={styles.fieldInput}
                  type="text"
                  placeholder={s.periodPlaceholder}
                  value={e.period}
                  onChange={ev => updateExperience(i, 'period', ev.target.value)}
                />
                <input
                  className={styles.fieldInput}
                  type="text"
                  placeholder={s.locationFieldPlaceholder}
                  value={e.location}
                  onChange={ev => updateExperience(i, 'location', ev.target.value)}
                />
              </div>
              <span className={styles.subLabel}>{s.bullets}</span>
              <textarea
                className={styles.bulletsTextarea}
                placeholder={s.bulletsPlaceholder}
                value={e.bullets}
                onChange={ev => updateExperience(i, 'bullets', ev.target.value)}
              />
            </div>
          ))}
          <button className={styles.addBtn} onClick={addExperience}>{s.addExperience}</button>
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{s.educationTitle}</span>
        <div className={styles.dynamicList}>
          {(data.education || []).map((e, i) => (
            <div key={i} className={styles.entryBox}>
              <button className={`${styles.removeBtn} ${styles.entryRemove}`} onClick={() => removeEducation(i)}>×</button>
              <div className={styles.entryGrid}>
                <input
                  className={styles.fieldInput}
                  type="text"
                  placeholder={s.degreePlaceholder}
                  value={e.degree}
                  onChange={ev => updateEducation(i, 'degree', ev.target.value)}
                />
                <input
                  className={styles.fieldInput}
                  type="text"
                  placeholder={s.institutionPlaceholder}
                  value={e.institution}
                  onChange={ev => updateEducation(i, 'institution', ev.target.value)}
                />
              </div>
              <input
                className={styles.fieldInput}
                type="text"
                placeholder={s.periodPlaceholder}
                value={e.period}
                onChange={ev => updateEducation(i, 'period', ev.target.value)}
              />
            </div>
          ))}
          <button className={styles.addBtn} onClick={addEducation}>{s.addEducation}</button>
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{s.skillsTitle}</span>
        <div className={styles.dynamicList}>
          {(data.skills || []).map((sk, i) => (
            <div key={i} className={styles.contactRow}>
              <input
                className={`${styles.fieldInput} ${styles.contactType}`}
                type="text"
                placeholder={s.skillLabelPlaceholder}
                value={sk.label}
                onChange={ev => updateSkill(i, 'label', ev.target.value)}
                style={{ width: 140 }}
              />
              <input
                className={`${styles.fieldInput} ${styles.contactValue}`}
                type="text"
                placeholder={s.skillValuePlaceholder}
                value={sk.value}
                onChange={ev => updateSkill(i, 'value', ev.target.value)}
              />
              <button className={styles.removeBtn} onClick={() => removeSkill(i)}>×</button>
            </div>
          ))}
          <button className={styles.addBtn} onClick={addSkill}>{s.addSkill}</button>
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
