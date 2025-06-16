import axios from 'axios'
import toast from 'react-hot-toast'

// Create axios instance
export const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if it exists
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config

    // Handle 401 errors (token expired)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          const response = await api.post('/auth/refresh', { refreshToken })
          const { accessToken } = response.data.data
          
          localStorage.setItem('accessToken', accessToken)
          api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
          
          return api(originalRequest)
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        delete api.defaults.headers.common['Authorization']
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    // Handle other errors
    const message = error.response?.data?.message || error.message
    
    // Don't show error toast for auth requests
    if (!error.config.url.includes('/auth/')) {
      toast.error(message)
    }

    return Promise.reject(error)
  }
)

// API helper functions
export const apiHelpers = {
  // Tasks
  getTasks: (params = {}) => api.get('/tasks', { params }),
  createTask: (data) => api.post('/tasks', data),
  updateTask: (id, data) => api.put(`/tasks/${id}`, data),
  deleteTask: (id) => api.delete(`/tasks/${id}`),
  startTask: (id, deviceId) => api.post(`/tasks/${id}/start`, { deviceId }),
  pauseTask: (id) => api.post(`/tasks/${id}/pause`),
  completeTask: (id, data) => api.post(`/tasks/${id}/complete`, data),
  getTaskSuggestions: () => api.get('/tasks/suggestions'),

  // Devices
  getDevices: (params = {}) => api.get('/devices', { params }),
  createDevice: (data) => api.post('/devices', data),
  updateDevice: (id, data) => api.put(`/devices/${id}`, data),
  deleteDevice: (id) => api.delete(`/devices/${id}`),
  getDeviceStatus: (id) => api.get(`/devices/${id}/status`),
  sendDeviceCommand: (id, command, data) => api.post(`/devices/${id}/commands`, { command, data }),

  // Analytics
  getDashboardAnalytics: () => api.get('/analytics/dashboard'),
  getProductivityAnalytics: (params = {}) => api.get('/analytics/productivity', { params }),
  getHeatmapData: (params = {}) => api.get('/analytics/heatmap', { params }),
  getDeviceUsage: (params = {}) => api.get('/analytics/device-usage', { params }),
  getGoalsProgress: () => api.get('/analytics/goals-progress'),
  exportAnalytics: (params = {}) => api.get('/analytics/export', { params }),

  // AI
  getTaskSuggestionsAI: (data) => api.post('/ai/suggestions/tasks', data),
  getProductivityAnalysisAI: (data) => api.post('/ai/analysis/productivity', data),
  getOptimalSchedule: (data) => api.post('/ai/schedule/optimize', data),
  getProductivityTips: (data) => api.post('/ai/tips/productivity', data),
  estimateTask: (data) => api.post('/ai/estimate/task', data),
  getWeeklyInsights: (data) => api.post('/ai/insights/weekly', data),
  getAIStatus: () => api.get('/ai/status'),

  // Admin
  getAdminDashboard: () => api.get('/admin/dashboard'),
  getUsers: (params = {}) => api.get('/admin/users', { params }),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  getAdminDevices: (params = {}) => api.get('/admin/devices', { params }),
  sendAdminCommand: (deviceId, command, data) => api.post(`/admin/devices/${deviceId}/commands`, { command, data }),
  getSystemAnalytics: (params = {}) => api.get('/admin/analytics/system', { params }),
  getSystemLogs: (params = {}) => api.get('/admin/logs', { params }),
  performMaintenance: (operation) => api.post('/admin/maintenance', { operation, confirm: true }),
  exportSystemData: (params = {}) => api.get('/admin/export/data', { params }),

  // Profile
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
}

export default api