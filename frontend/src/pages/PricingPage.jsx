import { Link } from 'react-router-dom'
import { useLang } from '../LangContext'
import { Navbar } from '../components/Navbar/Navbar'
import styles from './PricingPage.module.css'

const FREE_FEATURES = ['freeFeature1', 'freeFeature2', 'freeFeature3', 'freeFeature4', 'freeFeature5']
const PRO_FEATURES = ['proFeature1', 'proFeature2', 'proFeature3', 'proFeature4']

export function PricingPage() {
  const t = useLang()
  const p = t.pricing

  return (
    <div className={styles.page}>
      <Navbar />

      <div className={styles.body}>
        <div className={styles.header}>
          <h1 className={styles.title}>{p.title}</h1>
          <p className={styles.subtitle}>{p.subtitle}</p>
        </div>

        <div className={styles.plans}>
          <div className={styles.planCard}>
            <div className={styles.planTop}>
              <span className={styles.planName}>{p.free}</span>
              <span className={styles.planPrice}>{p.freePrice}</span>
              <span className={styles.planDesc}>{p.freeDesc}</span>
            </div>
            <ul className={styles.features}>
              {FREE_FEATURES.map(key => (
                <li key={key} className={styles.feature}>
                  <span className={styles.check}>✓</span>
                  {p[key]}
                </li>
              ))}
            </ul>
            <Link to="/app" className={styles.freeCta}>{p.freeCta}</Link>
          </div>

          <div className={`${styles.planCard} ${styles.planCardPro}`}>
            <div className={styles.planTop}>
              <div className={styles.proHeader}>
                <span className={styles.planName}>{p.pro}</span>
                <span className={styles.comingSoonBadge}>{p.proPrice}</span>
              </div>
              <span className={styles.planDesc}>{p.proDesc}</span>
            </div>
            <ul className={styles.features}>
              {PRO_FEATURES.map(key => (
                <li key={key} className={styles.feature}>
                  <span className={styles.check}>✓</span>
                  {p[key]}
                </li>
              ))}
            </ul>
            <button className={styles.proCta} disabled>{p.proCta}</button>
          </div>
        </div>

        <Link to="/app" className={styles.backLink}>{p.backToApp}</Link>
      </div>
    </div>
  )
}
