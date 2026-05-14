import { Link } from 'react-router-dom'
import { useLang } from '../LangContext'
import { Navbar } from '../components/Navbar/Navbar'
import styles from './LandingPage.module.css'

const STEPS = ['step1', 'step2', 'step3', 'step4']
const WHY = ['w1', 'w2', 'w3', 'w4']

export function LandingPage() {
  const t = useLang()
  const l = t.landing

  return (
    <div className={styles.page}>
      <Navbar />

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>{l.hero}</h1>
          <p className={styles.heroSub}>{l.heroSub}</p>
          <Link to="/app" className={styles.heroCta}>{l.cta}</Link>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>{l.howTitle}</h2>
          <div className={styles.steps}>
            {STEPS.map((key, i) => (
              <div key={key} className={styles.step}>
                <div className={styles.stepNum}>{String(i + 1).padStart(2, '0')}</div>
                <div className={styles.stepContent}>
                  <div className={styles.stepTitle}>{l[`${key}title`]}</div>
                  <div className={styles.stepDesc}>{l[`${key}desc`]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>{l.whyTitle}</h2>
          <div className={styles.why}>
            {WHY.map(key => (
              <div key={key} className={styles.whyCard}>
                <div className={styles.whyTitle}>{l[`${key}title`]}</div>
                <div className={styles.whyDesc}>{l[`${key}desc`]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <Link to="/app" className={styles.heroCta}>{l.cta}</Link>
          <Link to="/pricing" className={styles.pricingLink}>{l.pricingLink}</Link>
        </div>
      </section>
    </div>
  )
}
