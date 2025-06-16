import React, { useState } from 'react'
import { Plus, Smartphone, Wifi, WifiOff, Settings, Search } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { useDevices, useCreate, useUpdate, useDelete } from '../hooks/useApi'
import { apiHelpers } from '../utils/api'
import DeviceCard from '../components/Devices/DeviceCard'
import Modal from '../components/Common/Modal'

const Devices = () => {
  const { t } = useLanguage()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [showDeviceForm, setShowDeviceForm] = useState(false)
  const [editingDevice, setEditingDevice] = useState(null)
  const [showDeviceDetails, setShowDeviceDetails] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)

  // API hooks
  const { 
    data: devicesData, 
    loading: devicesLoading, 
    refetch: refetchDevices 
  } = useDevices({
    search: searchTerm,
    status: selectedStatus,
    deviceType: selectedType
  })

  const { create: createDevice } = useCreate(apiHelpers.createDevice, {
    onSuccess: () => {
      setShowDeviceForm(false)
      refetchDevices()
    }
  })

  const { update: updateDevice } = useUpdate(apiHelpers.updateDevice, {
    onSuccess: () => {
      setEditingDevice(null)
      setShowDeviceForm(false)
      refetchDevices()
    }
  })

  const { delete: deleteDevice } = useDelete(apiHelpers.deleteDevice, {
    onSuccess: () => {
      refetchDevices()
    }
  })

  const handleCreateDevice = () => {
    setEditingDevice(null)
    setShowDeviceForm(true)
  }

  const handleEditDevice = (device) => {
    setEditingDevice(device)
    setShowDeviceForm(true)
  }

  const handleDeleteDevice = async (deviceId) => {
    if (window.confirm('Are you sure you want to delete this device?')) {
      await deleteDevice(deviceId)
    }
  }

  const handleDeviceCommand = async (deviceId, command, data = {}) => {
    try {
      await apiHelpers.sendDeviceCommand(deviceId, command, data)
      refetchDevices()
    } catch (error) {
      console.error('Device command failed:', error)
    }
  }

  const handleViewDevice = (device) => {
    setSelectedDevice(device)
    setShowDeviceDetails(true)
  }

  const statusOptions = [
    { value: '', label: t('filter') + ' ' + t('status') },
    { value: 'online', label: t('online') },
    { value: 'offline', label: t('offline') },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'error', label: 'Error' },
  ]

  const typeOptions = [
    { value: '', label: t('filter') + ' ' + t('deviceType') },
    { value: 'smart_lamp', label: 'Smart Lamp' },
    { value: 'task_display', label: 'Task Display' },
    { value: 'productivity_hub', label: 'Productivity Hub' },
  ]

  const devices = devicesData?.devices || []
  const onlineCount = devices.filter(d => d.isOnline).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('devices')}</h1>
          <p className="text-gray-600">
            Manage your smart devices ({onlineCount}/{devices.length} online)
          </p>
        </div>
        <button
          onClick={handleCreateDevice}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('addDevice')}
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
              <p className="text-sm font-medium text-gray-600">{t('online')}</p>
              <p className="text-2xl font-semibold text-green-600">{onlineCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <WifiOff className="w-8 h-8 text-red-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{t('offline')}</p>
              <p className="text-2xl font-semibold text-red-600">{devices.length - onlineCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Settings className="w-8 h-8 text-purple-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Tasks</p>
              <p className="text-2xl font-semibold text-purple-600">
                {devices.filter(d => d.currentTask?.isActive).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={t('search')}
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

      {/* Devices Grid */}
      <div className="bg-white rounded-lg shadow">
        {devicesLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : devices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {devices.map((device) => (
              <DeviceCard
                key={device._id}
                device={device}
                onEdit={handleEditDevice}
                onDelete={handleDeleteDevice}
                onCommand={handleDeviceCommand}
                onView={handleViewDevice}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Smartphone className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No devices found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || selectedStatus || selectedType
                ? 'Try adjusting your filters'
                : 'Get started by adding your first device'
              }
            </p>
            {!searchTerm && !selectedStatus && !selectedType && (
              <button
                onClick={handleCreateDevice}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('addDevice')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Device Form Modal */}
      <Modal
        isOpen={showDeviceForm}
        onClose={() => {
          setShowDeviceForm(false)
          setEditingDevice(null)
        }}
        title={editingDevice ? t('edit') + ' ' + t('deviceName') : t('addDevice')}
      >
        <DeviceForm
          device={editingDevice}
          onSubmit={async (data) => {
            if (editingDevice) {
              await updateDevice(editingDevice.deviceId, data)
            } else {
              await createDevice(data)
            }
          }}
          onCancel={() => {
            setShowDeviceForm(false)
            setEditingDevice(null)
          }}
        />
      </Modal>

      {/* Device Details Modal */}
      <Modal
        isOpen={showDeviceDetails}
        onClose={() => {
          setShowDeviceDetails(false)
          setSelectedDevice(null)
        }}
        title={selectedDevice?.name || 'Device Details'}
        size="lg"
      >
        {selectedDevice && (
          <DeviceDetails
            device={selectedDevice}
            onCommand={handleDeviceCommand}
            onEdit={() => {
              setShowDeviceDetails(false)
              handleEditDevice(selectedDevice)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

// Device Form Component
const DeviceForm = ({ device, onSubmit, onCancel }) => {
  const { t } = useLanguage()
  const [formData, setFormData] = useState({
    name: device?.name || '',
    description: device?.description || '',
    deviceType: device?.deviceType || 'smart_lamp',
    location: {
      room: device?.location?.room || '',
      building: device?.location?.building || ''
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
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit(formData)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('deviceName')}
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('description')}
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('deviceType')}
        </label>
        <select
          name="deviceType"
          value={formData.deviceType}
          onChange={handleChange}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="smart_lamp">Smart Lamp</option>
          <option value="task_display">Task Display</option>
          <option value="productivity_hub">Productivity Hub</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Room
          </label>
          <input
            type="text"
            name="location.room"
            value={formData.location.room}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Building
          </label>
          <input
            type="text"
            name="location.building"
            value={formData.location.building}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? t('loading') : t('save')}
        </button>
      </div>
    </form>
  )
}

// Device Details Component
const DeviceDetails = ({ device, onCommand, onEdit }) => {
  const { t } = useLanguage()

  return (
    <div className="space-y-6">
      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${device.isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-lg font-medium">{device.isOnline ? t('online') : t('offline')}</span>
        </div>
        <button
          onClick={onEdit}
          className="text-blue-600 hover:text-blue-800"
        >
          {t('edit')}
        </button>
      </div>

      {/* Device Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-600">Device ID</p>
          <p className="font-mono text-sm">{device.deviceId}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">{t('deviceType')}</p>
          <p className="capitalize">{device.deviceType.replace('_', ' ')}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">{t('location')}</p>
          <p>{device.location?.room || 'Not set'}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">{t('lastSeen')}</p>
          <p>{new Date(device.lastSeen).toLocaleString()}</p>
        </div>
      </div>

      {/* Current Task */}
      {device.currentTask?.isActive && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900">Current Task</h4>
          <p className="text-blue-700">{device.currentTask.taskId?.title || 'Active task'}</p>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{device.statistics?.totalTasksCompleted || 0}</p>
          <p className="text-sm text-gray-600">Tasks Completed</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{Math.round((device.statistics?.totalUptime || 0) / 60)}h</p>
          <p className="text-sm text-gray-600">Total Uptime</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{device.statistics?.averageResponseTime || 0}ms</p>
          <p className="text-sm text-gray-600">Avg Response</p>
        </div>
      </div>

      {/* Quick Actions */}
      {device.isOnline && (
        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Quick Actions</h4>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onCommand(device.deviceId, 'get_status')}
              className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Get Status
            </button>
            <button
              onClick={() => onCommand(device.deviceId, 'restart')}
              className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Restart
            </button>
            <button
              onClick={() => onCommand(device.deviceId, 'reset_task')}
              className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Reset Task
            </button>
            <button
              onClick={() => onCommand(device.deviceId, 'test_connection')}
              className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Test Connection
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Devices