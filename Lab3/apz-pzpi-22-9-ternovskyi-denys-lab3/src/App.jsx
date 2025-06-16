import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useLanguage } from './contexts/LanguageContext'

// Layout Components
import Navbar from './components/Layout/Navbar'
import Sidebar from './components/Layout/Sidebar'

// Auth Components
import LoginForm from './components/Auth/LoginForm'
import RegisterForm from './components/Auth/RegisterForm'

// Pages
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Devices from './pages/Devices'
import Analytics from './pages/Analytics'
import Profile from './pages/Profile'

// Admin Pages
import AdminDashboard from './pages/Admin/AdminDashboard'
import UsersManagement from './pages/Admin/UsersManagement'
import DevicesManagement from './pages/Admin/DevicesManagement'
import SystemLogs from './pages/Admin/SystemLogs'

function App() {
  const { user, loading } = useAuth()
  const { t } = useLanguage()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/login" element={<LoginForm />} />
          <Route path="/register" element={<RegisterForm />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 ml-64 p-6">
          <Routes>
            {/* User Routes */}
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/profile" element={<Profile />} />

            {/* Admin Routes */}
            {user.role === 'admin' && (
              <>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<UsersManagement />} />
                <Route path="/admin/devices" element={<DevicesManagement />} />
                <Route path="/admin/logs" element={<SystemLogs />} />
              </>
            )}

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App