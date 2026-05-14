import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { LangContext, LangControlContext } from './LangContext'
import { RU, EN } from './i18n'
import { AuthProvider } from './context/AuthContext'
import { LandingPage } from './pages/LandingPage'
import { AppPage } from './pages/AppPage'
import { PricingPage } from './pages/PricingPage'

export function App() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('lang') || 'ru' } catch { return 'ru' }
  })
  const t = lang === 'ru' ? RU : EN

  useEffect(() => {
    try { localStorage.setItem('lang', lang) } catch {}
    document.documentElement.lang = lang
  }, [lang])

  function toggleLang() { setLang(l => l === 'ru' ? 'en' : 'ru') }

  return (
    <AuthProvider>
      <LangControlContext.Provider value={{ lang, toggleLang }}>
        <LangContext.Provider value={t}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/app" element={<AppPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </LangContext.Provider>
      </LangControlContext.Provider>
    </AuthProvider>
  )
}
