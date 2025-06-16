import React, { useState } from 'react'
import { User, Settings, Lock, Bell, Globe, Clock, Save } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'

const Profile = () => {
  const { user, updateProfile, changePassword } = useAuth()
  const { t, language, changeLanguage, getAvailableLanguages } = useLanguage()
  const [activeTab, setActiveTab] = useState('personal')
  const [loading, setLoading] = useState(false)

  const tabs = [
    { id: 'personal', name: t('personalInfo'), icon: User },
    { id: 'preferences', name: t('preferences'), icon: Settings },
    { id: 'security', name: 'Security', icon: Lock },
    { id: 'notifications', name: t('notifications'), icon: Bell },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('profile')}</h1>
        <p className="text-gray-600">Manage your account settings and preferences</p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'personal' && (
            <PersonalInfoTab user={user} updateProfile={updateProfile} t={t} />
          )}
          {activeTab === 'preferences' && (
            <PreferencesTab 
              user={user} 
              updateProfile={updateProfile} 
              language={language}
              changeLanguage={changeLanguage}
              getAvailableLanguages={getAvailableLanguages}
              t={t} 
            />
          )}
          {activeTab === 'security' && (
            <SecurityTab changePassword={changePassword} t={t} />
          )}
          {activeTab === 'notifications' && (
            <NotificationsTab user={user} updateProfile={updateProfile} t={t} />
          )}
        </div>
      </div>
    </div>
  )
}

// Personal Info Tab
const PersonalInfoTab = ({ user, updateProfile, t }) => {
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await updateProfile(formData)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('firstName')}
          </label>
          <input
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('lastName')}
          </label>
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('email')}
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          disabled
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
        />
        <p className="mt-1 text-sm text-gray-500">Email cannot be changed</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Username
        </label>
        <input
          type="text"
          value={user?.username || ''}
          disabled
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
        />
        <p className="mt-1 text-sm text-gray-500">Username cannot be changed</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Account Type
        </label>
        <div className="mt-1">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
            user?.role === 'admin' 
              ? 'bg-red-100 text-red-800'
              : user?.role === 'moderator'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-green-100 text-green-800'
          }`}>
            {user?.role}
          </span>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-2" />
          {loading ? 'Saving...' : t('save')}
        </button>
      </div>
    </form>
  )
}

// Preferences Tab
const PreferencesTab = ({ user, updateProfile, language, changeLanguage, getAvailableLanguages, t }) => {
  const [formData, setFormData] = useState({
    timezone: user?.preferences?.timezone || 'UTC',
    language: language,
    workSchedule: {
      startTime: user?.preferences?.workSchedule?.startTime || '09:00',
      endTime: user?.preferences?.workSchedule?.endTime || '17:00',
    }
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name.includes('.')) {
      const [parent, child] = name.split('.')
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }))
    } else {
      setFormData({ ...formData, [name]: value })
    }
  }

  const handleLanguageChange = (newLanguage) => {
    changeLanguage(newLanguage)
    setFormData({ ...formData, language: newLanguage })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await updateProfile({
        preferences: {
          timezone: formData.timezone,
          workSchedule: formData.workSchedule
        }
      })
    } finally {
      setLoading(false)
    }
  }

  const timezones = [
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Kiev',
    'Asia/Tokyo',
    'Australia/Sydney'
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('language')}
        </label>
        <div className="mt-1 grid grid-cols-2 gap-3">
          {getAvailableLanguages().map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleLanguageChange(lang.code)}
              className={`flex items-center p-3 border rounded-lg ${
                language === lang.code
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="text-2xl mr-3">{lang.flag}</span>
              <span className="font-medium">{lang.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('timezone')}
        </label>
        <select
          name="timezone"
          value={formData.timezone}
          onChange={handleChange}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Work Schedule
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600">Start Time</label>
            <input
              type="time"
              name="workSchedule.startTime"
              value={formData.workSchedule.startTime}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">End Time</label>
            <input
              type="time"
              name="workSchedule.endTime"
              value={formData.workSchedule.endTime}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-2" />
          {loading ? 'Saving...' : t('save')}
        </button>
      </div>
    </form>
  )
}

// Security Tab
const SecurityTab = ({ changePassword, t }) => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: null })
    }
  }

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required'
    }
    
    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required'
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters'
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setLoading(true)
    try {
      await changePassword(formData)
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('currentPassword')}
        </label>
        <input
          type="password"
          name="currentPassword"
          value={formData.currentPassword}
          onChange={handleChange}
          className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.currentPassword ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.currentPassword && (
          <p className="mt-1 text-sm text-red-600">{errors.currentPassword}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('newPassword')}
        </label>
        <input
          type="password"
          name="newPassword"
          value={formData.newPassword}
          onChange={handleChange}
          className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.newPassword ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.newPassword && (
          <p className="mt-1 text-sm text-red-600">{errors.newPassword}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Confirm New Password
        </label>
        <input
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.confirmPassword && (
          <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          <Lock className="w-4 h-4 mr-2" />
          {loading ? 'Updating...' : t('changePassword')}
        </button>
      </div>
    </form>
  )
}

// Notifications Tab
const NotificationsTab = ({ user, updateProfile, t }) => {
  const [formData, setFormData] = useState({
    notifications: {
      email: user?.preferences?.notifications?.email ?? true,
      push: user?.preferences?.notifications?.push ?? true,
      taskReminders: user?.preferences?.notifications?.taskReminders ?? true,
    }
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, checked } = e.target
    setFormData(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [name]: checked
      }
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await updateProfile({
        preferences: {
          ...user?.preferences,
          notifications: formData.notifications
        }
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
            <p className="text-sm text-gray-600">Receive notifications via email</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="email"
              checked={formData.notifications.email}
              onChange={handleChange}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Push Notifications</h4>
            <p className="text-sm text-gray-600">Receive push notifications in browser</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="push"
              checked={formData.notifications.push}
              onChange={handleChange}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Task Reminders</h4>
            <p className="text-sm text-gray-600">Get reminders for upcoming deadlines</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="taskReminders"
              checked={formData.notifications.taskReminders}
              onChange={handleChange}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-2" />
          {loading ? 'Saving...' : t('save')}
        </button>
      </div>
    </form>
  )
}

export default Profile