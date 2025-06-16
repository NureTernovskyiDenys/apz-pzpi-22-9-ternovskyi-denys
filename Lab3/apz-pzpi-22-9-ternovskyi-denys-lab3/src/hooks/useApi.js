import { useState, useEffect } from 'react'
import { apiHelpers } from '../utils/api'
import toast from 'react-hot-toast'

// Generic hook for API calls
export const useApi = (apiFunction, dependencies = [], options = {}) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const {
    immediate = true,
    onSuccess,
    onError,
    showSuccessToast = false,
    showErrorToast = true
  } = options

  const execute = async (...args) => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await apiFunction(...args)
      const responseData = response.data?.data || response.data
      
      setData(responseData)
      
      if (onSuccess) {
        onSuccess(responseData)
      }
      
      if (showSuccessToast) {
        toast.success('Operation completed successfully')
      }
      
      return responseData
    } catch (err) {
      setError(err)
      
      if (onError) {
        onError(err)
      }
      
      if (showErrorToast) {
        const message = err.response?.data?.message || err.message
        toast.error(message)
      }
      
      throw err
    } finally {
      setLoading(false)
    }
  }

  const refetch = () => execute(...dependencies)

  useEffect(() => {
    if (immediate && apiFunction) {
      execute(...dependencies)
    }
  }, dependencies)

  return {
    data,
    loading,
    error,
    execute,
    refetch
  }
}

// Specific hooks for common operations
export const useTasks = (params = {}) => {
  return useApi(
    () => apiHelpers.getTasks(params),
    [JSON.stringify(params)],
    { immediate: true }
  )
}

export const useDevices = (params = {}) => {
  return useApi(
    () => apiHelpers.getDevices(params),
    [JSON.stringify(params)],
    { immediate: true }
  )
}

export const useDashboardAnalytics = () => {
  return useApi(
    () => apiHelpers.getDashboardAnalytics(),
    [],
    { immediate: true }
  )
}

export const useProductivityAnalytics = (params = {}) => {
  return useApi(
    () => apiHelpers.getProductivityAnalytics(params),
    [JSON.stringify(params)],
    { immediate: true }
  )
}

// Hook for creating resources
export const useCreate = (apiFunction, options = {}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const create = async (data) => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await apiFunction(data)
      const responseData = response.data?.data || response.data
      
      if (options.onSuccess) {
        options.onSuccess(responseData)
      }
      
      if (options.showSuccessToast !== false) {
        toast.success(options.successMessage || 'Created successfully')
      }
      
      return responseData
    } catch (err) {
      setError(err)
      
      if (options.onError) {
        options.onError(err)
      }
      
      if (options.showErrorToast !== false) {
        const message = err.response?.data?.message || err.message
        toast.error(message)
      }
      
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    create,
    loading,
    error
  }
}

// Hook for updating resources
export const useUpdate = (apiFunction, options = {}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const update = async (id, data) => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await apiFunction(id, data)
      const responseData = response.data?.data || response.data
      
      if (options.onSuccess) {
        options.onSuccess(responseData)
      }
      
      if (options.showSuccessToast !== false) {
        toast.success(options.successMessage || 'Updated successfully')
      }
      
      return responseData
    } catch (err) {
      setError(err)
      
      if (options.onError) {
        options.onError(err)
      }
      
      if (options.showErrorToast !== false) {
        const message = err.response?.data?.message || err.message
        toast.error(message)
      }
      
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    update,
    loading,
    error
  }
}

// Hook for deleting resources
export const useDelete = (apiFunction, options = {}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const deleteResource = async (id) => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await apiFunction(id)
      const responseData = response.data?.data || response.data
      
      if (options.onSuccess) {
        options.onSuccess(responseData)
      }
      
      if (options.showSuccessToast !== false) {
        toast.success(options.successMessage || 'Deleted successfully')
      }
      
      return responseData
    } catch (err) {
      setError(err)
      
      if (options.onError) {
        options.onError(err)
      }
      
      if (options.showErrorToast !== false) {
        const message = err.response?.data?.message || err.message
        toast.error(message)
      }
      
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    delete: deleteResource,
    loading,
    error
  }
}

// Hook for real-time data updates
export const useRealTime = (apiFunction, interval = 30000) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiFunction()
        setData(response.data?.data || response.data)
        setError(null)
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    }

    // Initial fetch
    fetchData()

    // Set up interval
    const intervalId = setInterval(fetchData, interval)

    // Cleanup
    return () => clearInterval(intervalId)
  }, [apiFunction, interval])

  return { data, loading, error }
}