import { createContext, useContext } from 'react'
import { RU } from './i18n'

export const LangContext = createContext(RU)
export const useLang = () => useContext(LangContext)

export const LangControlContext = createContext({ lang: 'ru', toggleLang: () => {} })
export const useLangControl = () => useContext(LangControlContext)
