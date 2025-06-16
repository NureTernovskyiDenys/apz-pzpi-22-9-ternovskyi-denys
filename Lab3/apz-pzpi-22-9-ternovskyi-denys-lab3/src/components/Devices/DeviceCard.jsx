import React, { useState } from 'react'
import { 
  Smartphone, 
  Wifi, 
  WifiOff, 
  Settings, 
  MoreHorizontal,
  Power,
  RefreshCw,
  Edit,
  Trash2,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  MapPin
} from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'

const DeviceCard = ({ device, onEdit, onDelete, onCommand, onView }) => {
  const { t } = useLanguage()
  const [showActions, setShowActions] = useState(false)
  const [commandLoading, setCommandLoading] = useState(null)

  const handleCommand = async (command, data = {}) => {
    setCommandLoading(command)
    try {
      await onCommand(device.deviceId, command, data)
    } finally {
      setCommandLoading(null)
      setShowActions(false)
    }
  }

  const getDeviceTypeIcon = (type) => {
    switch (type) {
      case 'smart_lamp':
        return '💡'
      case 'task_display':
        return '📺'
      case 'productivity_hub':
        return '🏠'
      default:
        return '📱'
    }
  }

  const getDeviceTypeName = (type) => {
    switch (type) {
      case 'smart_lamp':
        return 'Smart Lamp'
      case 'task_display':
        return 'Task Display'
      case 'productivity_hub':
        return 'Productivity Hub'
      default:
        return 'Unknown'
    }
  }

  const getStatusColor = (status, isOnline) => {
    if (!isOnline) return 'bg-red-100 text-red-800 border-red-200'
    
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getLastSeenText = (lastSeen) => {
    if (!lastSeen) return 'Never'
    
    const now = new Date()
    const lastSeenDate = new Date(lastSeen)
    const diffMs = now - lastSeenDate
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">{getDeviceTypeIcon(device.deviceType)}</div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">{device.name}</h3>
            <p className="text-sm text-gray-500 font-mono">{device.deviceId}</p>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            device.isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`}></div>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
            getStatusColor(device.status, device.isOnline)
          }`}>
            {device.isOnline ? t('online') : t('offline')}
          </span>
        </div>
      </div>

      {/* Device Info */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Type:</span>
          <span className="font-medium">{getDeviceTypeName(device.deviceType)}</span>
        </div>

        {device.location?.room && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 flex items-center">
              <MapPin className="w-3 h-3 mr-1" />
              Location:
            </span>
            <span className="font-medium">{device.location.room}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            Last Seen:
          </span>
          <span className="font-medium">{getLastSeenText(device.lastSeen)}</span>
        </div>
      </div>

      {/* Current Task */}
      {device.currentTask?.isActive && (
        <div className="bg-blue-50 p-3 rounded-lg mb-4">
          <div className="flex items-center space-x-2 mb-1">
            <Activity className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Current Task</span>
          </div>
          <p className="text-sm text-blue-800 truncate">
            {device.currentTask.taskId?.title || 'Active task in progress'}
          </p>
          <p className="text-xs text-blue-600">
            Started: {new Date(device.currentTask.startedAt).toLocaleTimeString()}
          </p>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-900">
            {device.statistics?.totalTasksCompleted || 0}
          </div>
          <div className="text-xs text-gray-600">Tasks</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-900">
            {Math.round((device.statistics?.totalUptime || 0) / 60)}h
          </div>
          <div className="text-xs text-gray-600">Uptime</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-900">
            {device.statistics?.averageResponseTime || 0}ms
          </div>
          <div className="text-xs text-gray-600">Response</div>
        </div>
      </div>

      {/* Configuration Preview */}
      <div className="bg-gray-50 p-3 rounded-lg mb-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-600">Brightness:</span>
            <span className="font-medium">{device.configuration?.brightness || 80}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Auto Mode:</span>
            <span className="font-medium">
              {device.configuration?.autoMode ? '✓' : '✗'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Sound:</span>
            <span className="font-medium">
              {device.configuration?.soundEnabled ? '✓' : '✗'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Notifications:</span>
            <span className="font-medium">
              {device.configuration?.taskNotifications ? '✓' : '✗'}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onView(device)}
          className="flex items-center px-3 py-1.5 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <Activity className="w-4 h-4 mr-1" />
          {t('view')}
        </button>

        <div className="flex items-center space-x-2">
          {/* Quick Actions for Online Devices */}
          {device.isOnline && (
            <>
              <button
                onClick={() => handleCommand('get_status')}
                disabled={commandLoading === 'get_status'}
                className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Get Status"
              >
                {commandLoading === 'get_status' ? (
                  <div className="w-4 h-4 spinner"></div>
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </button>

              <button
                onClick={() => handleCommand('restart')}
                disabled={commandLoading === 'restart'}
                className="p-1.5 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                title="Restart Device"
              >
                {commandLoading === 'restart' ? (
                  <div className="w-4 h-4 spinner"></div>
                ) : (
                  <Power className="w-4 h-4" />
                )}
              </button>
            </>
          )}

          {/* More Actions Menu */}
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showActions && (
              <div className="absolute right-0 bottom-full mb-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                <button
                  onClick={() => {
                    onEdit(device)
                    setShowActions(false)
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Edit className="w-4 h-4 mr-3" />
                  {t('edit')}
                </button>

                <button
                  onClick={() => {
                    onView(device)
                    setShowActions(false)
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4 mr-3" />
                  {t('deviceSettings')}
                </button>

                {device.isOnline && (
                  <>
                    <div className="border-t border-gray-100 my-1"></div>
                    
                    <button
                      onClick={() => handleCommand('test_connection')}
                      disabled={commandLoading === 'test_connection'}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Wifi className="w-4 h-4 mr-3" />
                      Test Connection
                    </button>

                    <button
                      onClick={() => handleCommand('reset_task')}
                      disabled={commandLoading === 'reset_task'}
                      className="flex items-center w-full px-4 py-2 text-sm text-yellow-700 hover:bg-yellow-50"
                    >
                      <RefreshCw className="w-4 h-4 mr-3" />
                      Reset Task
                    </button>
                  </>
                )}

                <div className="border-t border-gray-100 my-1"></div>
                
                <button
                  onClick={() => {
                    onDelete(device.deviceId)
                    setShowActions(false)
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-3" />
                  {t('delete')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Device Health Indicator */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Device Health:</span>
          <div className="flex items-center space-x-1">
            {device.isOnline ? (
              <>
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span className="text-green-600 font-medium">Healthy</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 text-red-500" />
                <span className="text-red-600 font-medium">Offline</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Click outside to close actions menu */}
      {showActions && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setShowActions(false)}
        ></div>
      )}
    </div>
  )
}

export default DeviceCard