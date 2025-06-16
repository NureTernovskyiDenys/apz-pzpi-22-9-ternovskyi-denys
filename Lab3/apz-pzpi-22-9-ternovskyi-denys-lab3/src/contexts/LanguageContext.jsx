import React, { createContext, useContext, useState, useEffect } from 'react'
import { translations } from '../utils/i18n'

const LanguageContext = createContext()

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Get saved language or default to English
    return localStorage.getItem('language') || 'en'
  })

  // Update localStorage when language changes
  useEffect(() => {
    localStorage.setItem('language', language)
    document.documentElement.lang = language
  }, [language])

  // Translation function
  const t = (key, variables = {}) => {
    const keys = key.split('.')
    let translation = translations[language]

    // Navigate through nested object
    for (const k of keys) {
      translation = translation?.[k]
    }

    // Fallback to English if translation not found
    if (!translation && language !== 'en') {
      let fallback = translations.en
      for (const k of keys) {
        fallback = fallback?.[k]
      }
      translation = fallback
    }

    // Return key if no translation found
    if (!translation) {
      return key
    }

    // Replace variables in translation
    let result = translation
    Object.keys(variables).forEach(variable => {
      result = result.replace(`{{${variable}}}`, variables[variable])
    })

    return result
  }

  const changeLanguage = (newLanguage) => {
    if (translations[newLanguage]) {
      setLanguage(newLanguage)
    }
  }

  const getAvailableLanguages = () => {
    return Object.keys(translations).map(lang => ({
      code: lang,
      name: lang === 'en' ? 'English' : 'Українська',
      flag: lang === 'en' ? '🇺🇸' : '🇺🇦'
    }))
  }

  const value = {
    language,
    t,
    changeLanguage,
    getAvailableLanguages,
    isRTL: false // Add RTL support if needed
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}