import React, { useState } from 'react'
import { Bell, Search, User, Settings, LogOut, Globe } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../contexts/LanguageContext'

const Navbar = () => {
  const { user, logout } = useAuth()
  const { t, language, changeLanguage, getAvailableLanguages } = useLanguage()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)

  const handleLogout = async () => {
    await logout()
    setShowProfileMenu(false)
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 fixed w-full top-0 z-50">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SL</span>
              </div>
              <span className="text-xl font-semibold text-gray-800">
                Smart Lamp
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md mx-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={t('search')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Globe className="w-5 h-5" />
              </button>
              
              {showLanguageMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  {getAvailableLanguages().map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        changeLanguage(lang.code)
                        setShowLanguageMenu(false)
                      }}
                      className={`w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-3 ${
                        language === lang.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notifications */}
            <button className="relative p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="text-left hidden md:block">
                  <p className="text-sm font-medium text-gray-800">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-600 capitalize">{user?.role}</p>
                </div>
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-800">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-gray-600">{user?.email}</p>
                  </div>
                  
                  <a
                    href="/profile"
                    className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <User className="w-4 h-4" />
                    <span>{t('profile')}</span>
                  </a>
                  
                  <a
                    href="/profile"
                    className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <Settings className="w-4 h-4" />
                    <span>{t('preferences')}</span>
                  </a>
                  
                  <div className="border-t border-gray-100 mt-1">
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{t('logout')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar