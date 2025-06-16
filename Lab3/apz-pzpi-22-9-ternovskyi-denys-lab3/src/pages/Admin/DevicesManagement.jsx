import React, { useState } from 'react'
import { 
  Search, 
  Smartphone, 
  Wifi, 
  WifiOff, 
  Settings, 
  Power, 
  RefreshCw, 
  AlertTriangle,
  MoreVertical,
  Zap,
  Activity
} from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'
import { useApi } from '../../hooks/useApi'
import { apiHelpers } from '../../utils/api'
import Modal from '../../components/Common/Modal'

const DevicesManagement = () => {
  const { t } = useLanguage()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [page, setPage] = useState(1)
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)

  // API hooks
  const { 
    data: devicesData, 
    loading: devicesLoading, 
    refetch: refetchDevices 
  } = useApi(
    () => apiHelpers.getAdminDevices({
      search: searchTerm,
      status: selectedStatus,
      deviceType: selectedType,
      page,
      limit: 20
    }),
    [searchTerm, selectedStatus, selectedType, page],
    { immediate: true }
  )

  const handleViewDevice = (device) => {
    setSelectedDevice(device)
    setShowDeviceModal(true)
  }

  const handleDeviceCommand = async (deviceId, command, data = {}) => {
    try {
      await apiHelpers.sendAdminCommand(deviceId, command, data)
      refetchDevices()
    } catch (error) {
      console.error('Device command failed:', error)
    }
  }

  const devices = devicesData?.devices || []
  const pagination = devicesData?.pagination || {}

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'online', label: 'Online' },
    { value: 'offline', label: 'Offline' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'error', label: 'Error' },
  ]

  const typeOptions = [
    { value: '', label: 'All Types' },
    { value: 'smart_lamp', label: 'Smart Lamp' },
    { value: 'task_display', label: 'Task Display' },
    { value: 'productivity_hub', label: 'Productivity Hub' },
  ]

  const onlineCount = devices.filter(d => d.isOnline).length
  const errorCount = devices.filter(d => d.status === 'error').length
  const maintenanceCount = devices.filter(d => d.status === 'maintenance').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('deviceManagement')}</h1>
          <p className="text-gray-600">Monitor and manage all system devices</p>
        </div>
        <button
          onClick={() => refetchDevices()}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Smartphone className="w-8 h-8 text-blue-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Devices</p>
              <p className="text-2xl font-semibold text-gray-900">{devices.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Wifi className="w-8 h-8 text-green-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Online</p>
              <p className="text-2xl font-semibold text-green-600">{onlineCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Errors</p>
              <p className="text-2xl font-semibold text-red-600">{errorCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Settings className="w-8 h-8 text-yellow-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Maintenance</p>
              <p className="text-2xl font-semibold text-yellow-600">{maintenanceCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search devices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Devices Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {devicesLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Device
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Owner
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Task
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Seen
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {devices.map((device) => (
                    <tr key={device._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className={`w-3 h-3 rounded-full mr-3 ${
                              device.isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                            }`}></div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {device.name}
                            </div>
                            <div className="text-sm text-gray-500 font-mono">
                              {device.deviceId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {device.owner?.firstName} {device.owner?.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {device.owner?.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          device.status === 'online' 
                            ? 'bg-green-100 text-green-800'
                            : device.status === 'offline'
                            ? 'bg-red-100 text-red-800'
                            : device.status === 'maintenance'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {device.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {device.currentTask?.isActive ? (
                          <div className="text-sm">
                            <div className="text-gray-900 font-medium">
                              {device.currentTask.taskId?.title || 'Active Task'}
                            </div>
                            <div className="text-gray-500">
                              Started: {new Date(device.currentTask.startedAt).toLocaleTimeString()}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">No active task</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {device.lastSeen 
                          ? new Date(device.lastSeen).toLocaleString()
                          : 'Never'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewDevice(device)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Details"
                          >
                            <Activity className="w-4 h-4" />
                          </button>
                          {device.isOnline && (
                            <>
                              <button
                                onClick={() => handleDeviceCommand(device.deviceId, 'restart')}
                                className="text-yellow-600 hover:text-yellow-900"
                                title="Restart"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeviceCommand(device.deviceId, 'maintenance_mode')}
                                className="text-red-600 hover:text-red-900"
                                title="Maintenance Mode"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing page {pagination.currentPage} of {pagination.totalPages} 
                    ({pagination.totalDevices} total devices)
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
          </>
        )}
      </div>

      {/* Device Details Modal */}
      <Modal
        isOpen={showDeviceModal}
        onClose={() => {
          setShowDeviceModal(false)
          setSelectedDevice(null)
        }}
        title={selectedDevice ? `${selectedDevice.name} - Device Details` : 'Device Details'}
        size="lg"
      >
        {selectedDevice && (
          <DeviceDetailsView
            device={selectedDevice}
            onCommand={handleDeviceCommand}
            onClose={() => {
              setShowDeviceModal(false)
              setSelectedDevice(null)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

// Device Details View Component
const DeviceDetailsView = ({ device, onCommand, onClose }) => {
  const { t } = useLanguage()

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-4 h-4 rounded-full ${device.isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-lg font-medium">{device.isOnline ? 'Online' : 'Offline'}</span>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            device.status === 'online' 
              ? 'bg-green-100 text-green-800'
              : device.status === 'offline'
              ? 'bg-red-100 text-red-800'
              : device.status === 'maintenance'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {device.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Device Type:</span>
            <span className="ml-2 font-medium capitalize">{device.deviceType.replace('_', ' ')}</span>
          </div>
          <div>
            <span className="text-gray-600">Location:</span>
            <span className="ml-2 font-medium">{device.location?.room || 'Not set'}</span>
          </div>
          <div>
            <span className="text-gray-600">Owner:</span>
            <span className="ml-2 font-medium">{device.owner?.firstName} {device.owner?.lastName}</span>
          </div>
          <div>
            <span className="text-gray-600">Last Seen:</span>
            <span className="ml-2 font-medium">
              {device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'Never'}
            </span>
          </div>
        </div>
      </div>

      {/* Current Task */}
      {device.currentTask?.isActive && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Current Task</h4>
          <div className="text-blue-800">
            <p className="font-medium">{device.currentTask.taskId?.title || 'Active Task'}</p>
            <p className="text-sm">Started: {new Date(device.currentTask.startedAt).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div>
        <h4 className="font-medium mb-3">Statistics</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{device.statistics?.totalTasksCompleted || 0}</p>
            <p className="text-sm text-gray-600">Tasks Completed</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">
              {Math.round((device.statistics?.totalUptime || 0) / 60)}h
            </p>
            <p className="text-sm text-gray-600">Total Uptime</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">
              {device.statistics?.averageResponseTime || 0}ms
            </p>
            <p className="text-sm text-gray-600">Avg Response</p>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div>
        <h4 className="font-medium mb-3">Configuration</h4>
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Brightness:</span>
              <span className="ml-2 font-medium">{device.configuration?.brightness || 80}%</span>
            </div>
            <div>
              <span className="text-gray-600">Auto Mode:</span>
              <span className="ml-2 font-medium">{device.configuration?.autoMode ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div>
              <span className="text-gray-600">Sound:</span>
              <span className="ml-2 font-medium">{device.configuration?.soundEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div>
              <span className="text-gray-600">Notifications:</span>
              <span className="ml-2 font-medium">{device.configuration?.taskNotifications ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Logs */}
      {device.logs && device.logs.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">Recent Logs</h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {device.logs.slice(-5).map((log, index) => (
              <div key={index} className={`text-xs p-2 rounded ${
                log.level === 'error' 
                  ? 'bg-red-50 text-red-700' 
                  : log.level === 'warning'
                  ? 'bg-yellow-50 text-yellow-700'
                  : 'bg-gray-50 text-gray-700'
              }`}>
                <span className="font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className="ml-2">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Commands */}
      {device.isOnline && (
        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Admin Commands</h4>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onCommand(device.deviceId, 'restart')}
              className="flex items-center justify-center px-3 py-2 text-sm border border-yellow-300 rounded hover:bg-yellow-50 text-yellow-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Restart
            </button>
            <button
              onClick={() => onCommand(device.deviceId, 'maintenance_mode')}
              className="flex items-center justify-center px-3 py-2 text-sm border border-orange-300 rounded hover:bg-orange-50 text-orange-700"
            >
              <Settings className="w-4 h-4 mr-2" />
              Maintenance
            </button>
            <button
              onClick={() => onCommand(device.deviceId, 'factory_reset')}
              className="flex items-center justify-center px-3 py-2 text-sm border border-red-300 rounded hover:bg-red-50 text-red-700"
            >
              <Zap className="w-4 h-4 mr-2" />
              Factory Reset
            </button>
            <button
              onClick={() => onCommand(device.deviceId, 'update_firmware')}
              className="flex items-center justify-center px-3 py-2 text-sm border border-blue-300 rounded hover:bg-blue-50 text-blue-700"
            >
              <Power className="w-4 h-4 mr-2" />
              Update Firmware
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <button
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default DevicesManagement