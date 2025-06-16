import React, { createContext, useContext, useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { api } from '../utils/api'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Check if user is authenticated on app start
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken')
      if (token) {
        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          const response = await api.get('/auth/me')
          setUser(response.data.data.user)
        } catch (error) {
          // Token is invalid, remove it
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          delete api.defaults.headers.common['Authorization']
        }
      }
      setLoading(false)
    }

    checkAuth()
  }, [])

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password })
      const { user: userData, accessToken, refreshToken } = response.data.data

      // Store tokens
      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      
      // Set auth header
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
      
      setUser(userData)
      toast.success('Successfully logged in!')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register', userData)
      const { user: newUser, accessToken, refreshToken } = response.data.data

      // Store tokens
      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      
      // Set auth header
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
      
      setUser(newUser)
      toast.success('Account created successfully!')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      // Ignore logout errors
    } finally {
      // Clear local state and storage
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      delete api.defaults.headers.common['Authorization']
      setUser(null)
      toast.success('Logged out successfully')
    }
  }

  const updateProfile = async (profileData) => {
    try {
      const response = await api.put('/auth/profile', profileData)
      setUser(response.data.data.user)
      toast.success('Profile updated successfully!')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || 'Profile update failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const changePassword = async (passwordData) => {
    try {
      await api.put('/auth/change-password', passwordData)
      toast.success('Password changed successfully!')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || 'Password change failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const refreshToken = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) throw new Error('No refresh token')

      const response = await api.post('/auth/refresh', { refreshToken })
      const { accessToken } = response.data.data

      localStorage.setItem('accessToken', accessToken)
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
      
      return accessToken
    } catch (error) {
      logout()
      throw error
    }
  }

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    refreshToken
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}