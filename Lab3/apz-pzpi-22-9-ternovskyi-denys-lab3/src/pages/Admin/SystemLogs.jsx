import React, { useState } from 'react'
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  Info, 
  AlertCircle,
  CheckCircle,
  Calendar,
  Clock
} from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'
import { useApi } from '../../hooks/useApi'
import { apiHelpers } from '../../utils/api'

const SystemLogs = () => {
  const { t } = useLanguage()
  const [selectedLevel, setSelectedLevel] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [autoRefresh, setAutoRefresh] = useState(false)

  // API hooks
  const { 
    data: logsData, 
    loading: logsLoading, 
    refetch: refetchLogs 
  } = useApi(
    () => apiHelpers.getSystemLogs({
      level: selectedLevel,
      search: searchTerm,
      page,
      limit: 50
    }),
    [selectedLevel, searchTerm, page],
    { immediate: true }
  )

  // Auto-refresh every 30 seconds when enabled
  React.useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      refetchLogs()
    }, 30000)

    return () => clearInterval(interval)
  }, [autoRefresh, refetchLogs])

  const handleExportLogs = async () => {
    try {
      const response = await apiHelpers.getSystemLogs({
        level: selectedLevel,
        search: searchTerm,
        format: 'csv',
        limit: 1000
      })
      
      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const logs = logsData?.logs || []
  const pagination = logsData?.pagination || {}

  const levelOptions = [
    { value: '', label: 'All Levels' },
    { value: 'error', label: 'Error', icon: AlertTriangle, color: 'text-red-500' },
    { value: 'warn', label: 'Warning', icon: AlertCircle, color: 'text-yellow-500' },
    { value: 'info', label: 'Info', icon: Info, color: 'text-blue-500' },
    { value: 'debug', label: 'Debug', icon: CheckCircle, color: 'text-gray-500' },
  ]

  const getLogIcon = (level) => {
    const levelOption = levelOptions.find(opt => opt.value === level)
    if (levelOption && levelOption.icon) {
      const IconComponent = levelOption.icon
      return <IconComponent className={`w-4 h-4 ${levelOption.color}`} />
    }
    return <Info className="w-4 h-4 text-gray-500" />
  }

  const getLogRowClass = (level) => {
    switch (level) {
      case 'error':
        return 'bg-red-50 border-l-4 border-red-400'
      case 'warn':
        return 'bg-yellow-50 border-l-4 border-yellow-400'
      case 'info':
        return 'bg-blue-50 border-l-4 border-blue-400'
      default:
        return 'bg-gray-50 border-l-4 border-gray-400'
    }
  }

  const formatLogEntry = (log) => {
    // Handle different log formats
    if (log.task) {
      return `Task: ${log.task.title || 'Unknown'} - ${log.action}`
    }
    if (log.device) {
      return `Device: ${log.device.name || log.device.deviceId} - ${log.action}`
    }
    if (log.user) {
      return `User: ${log.user.firstName} ${log.user.lastName} - ${log.action}`
    }
    return log.action || 'System event'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('systemLogs')}</h1>
          <p className="text-gray-600">Monitor system activity and troubleshoot issues</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-lg ${
              autoRefresh 
                ? 'border-green-300 text-green-700 bg-green-50' 
                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            }`}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </button>
          <button
            onClick={refetchLogs}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={handleExportLogs}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Level Filter */}
          <div>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {levelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-lg shadow">
        {logsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : logs.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {logs.map((log, index) => (
              <div key={index} className={`p-4 ${getLogRowClass(log.level || 'info')}`}>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getLogIcon(log.level || 'info')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900">
                        {formatLogEntry(log)}
                      </p>
                      <div className="flex items-center text-xs text-gray-500">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </div>
                    
                    {/* Log Details */}
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="mt-2 p-2 bg-white bg-opacity-50 rounded text-xs">
                        <details>
                          <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                            View Details
                          </summary>
                          <pre className="mt-2 whitespace-pre-wrap text-gray-700">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}

                    {/* User Info */}
                    {log.user && (
                      <div className="flex items-center mt-1 text-xs text-gray-600">
                        <span>User: {log.user.firstName} {log.user.lastName} ({log.user.email})</span>
                      </div>
                    )}

                    {/* Performance Info */}
                    {log.performance && (
                      <div className="flex items-center mt-1 text-xs text-gray-600">
                        <span>Performance: Efficiency {log.performance.taskEfficiency}%, Focus {log.performance.focusLevel}/10</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Info className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No logs found</h3>
            <p className="text-gray-600">
              {searchTerm || selectedLevel
                ? 'Try adjusting your filters'
                : 'No system logs available'
              }
            </p>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing page {pagination.currentPage} of {pagination.totalPages} 
                ({pagination.totalLogs} total logs)
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={!pagination.hasPrev}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasNext}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Log Level Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {levelOptions.slice(1).map((level) => {
          const count = logs.filter(log => log.level === level.value).length
          const IconComponent = level.icon
          
          return (
            <div key={level.value} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <IconComponent className={`w-6 h-6 ${level.color}`} />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">{level.label}</p>
                  <p className="text-lg font-semibold text-gray-900">{count}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Filters</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setSelectedLevel('error')
              setSearchTerm('')
            }}
            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800 hover:bg-red-200"
          >
            <AlertTriangle className="w-3 h-3 mr-1" />
            Errors Only
          </button>
          <button
            onClick={() => {
              setSelectedLevel('')
              setSearchTerm('user')
            }}
            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 hover:bg-blue-200"
          >
            User Actions
          </button>
          <button
            onClick={() => {
              setSelectedLevel('')
              setSearchTerm('device')
            }}
            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800 hover:bg-green-200"
          >
            Device Events
          </button>
          <button
            onClick={() => {
              setSelectedLevel('')
              setSearchTerm('task')
            }}
            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800 hover:bg-purple-200"
          >
            Task Events
          </button>
          <button
            onClick={() => {
              setSelectedLevel('')
              setSearchTerm('')
              setPage(1)
            }}
            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800 hover:bg-gray-200"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  )
}

export default SystemLogs