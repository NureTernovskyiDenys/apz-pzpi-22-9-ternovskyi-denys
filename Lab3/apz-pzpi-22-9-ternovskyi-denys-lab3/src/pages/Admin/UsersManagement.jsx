import React, { useState } from 'react'
import { Search, Filter, MoreHorizontal, Edit, Trash2, Shield, User, UserX } from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'
import { useApi, useUpdate } from '../../hooks/useApi'
import { apiHelpers } from '../../utils/api'
import Modal from '../../components/Common/Modal'

const UsersManagement = () => {
  const { t } = useLanguage()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [page, setPage] = useState(1)
  const [showUserModal, setShowUserModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)

  // API hooks
  const { 
    data: usersData, 
    loading: usersLoading, 
    refetch: refetchUsers 
  } = useApi(
    () => apiHelpers.getUsers(),
    [],
    { immediate: true }
  )

  const { update: updateUser } = useUpdate(apiHelpers.updateUser, {
    onSuccess: () => {
      setShowUserModal(false)
      setSelectedUser(null)
      refetchUsers()
    }
  })

  const handleViewUser = (user) => {
    setSelectedUser(user)
    setShowUserModal(true)
  }

  const handleUpdateUser = async (userId, data) => {
    await updateUser(userId, data)
  }

  const users = usersData?.users || []
  const pagination = usersData?.pagination || {}

  const roleOptions = [
    { value: '', label: 'All Roles' },
    { value: 'user', label: 'User' },
    { value: 'moderator', label: 'Moderator' },
    { value: 'admin', label: 'Admin' },
  ]

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('userManagement')}</h1>
          <p className="text-gray-600">Manage user accounts and permissions</p>
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
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {usersLoading ? (
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
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Devices
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                              <span className="text-sm font-medium text-white">
                                {user.firstName[0]}{user.lastName[0]}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                          user.role === 'admin' 
                            ? 'bg-red-100 text-red-800'
                            : user.role === 'moderator'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {user.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.isActive 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.devices?.length || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.lastLogin 
                          ? new Date(user.lastLogin).toLocaleDateString()
                          : 'Never'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleViewUser(user)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
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
                    ({pagination.totalUsers} total users)
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

      {/* User Details Modal */}
      <Modal
        isOpen={showUserModal}
        onClose={() => {
          setShowUserModal(false)
          setSelectedUser(null)
        }}
        title={selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : 'User Details'}
        size="lg"
      >
        {selectedUser && (
          <UserDetailsForm
            user={selectedUser}
            onUpdate={handleUpdateUser}
            onClose={() => {
              setShowUserModal(false)
              setSelectedUser(null)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

// User Details Form Component
const UserDetailsForm = ({ user, onUpdate, onClose }) => {
  const { t } = useLanguage()
  const [formData, setFormData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onUpdate(user._id, formData)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* User Info */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Username:</span>
            <span className="ml-2 font-medium">{user.username}</span>
          </div>
          <div>
            <span className="text-gray-600">Email:</span>
            <span className="ml-2 font-medium">{user.email}</span>
          </div>
          <div>
            <span className="text-gray-600">Created:</span>
            <span className="ml-2 font-medium">{new Date(user.createdAt).toLocaleDateString()}</span>
          </div>
          <div>
            <span className="text-gray-600">Last Login:</span>
            <span className="ml-2 font-medium">
              {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
            </span>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{user.statistics?.totalTasksCompleted || 0}</p>
          <p className="text-sm text-gray-600">Tasks Completed</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{user.devices?.length || 0}</p>
          <p className="text-sm text-gray-600">Devices</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">
            {Math.round((user.statistics?.totalWorkingTime || 0) / 60)}h
          </p>
          <p className="text-sm text-gray-600">Work Time</p>
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
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
            Role
          </label>
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="user">User</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            name="isActive"
            checked={formData.isActive}
            onChange={handleChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label className="ml-2 block text-sm text-gray-900">
            Account Active
          </label>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
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

      {/* User Devices */}
      {user.devices && user.devices.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">User Devices</h4>
          <div className="space-y-2">
            {user.devices.map((device) => (
              <div key={device._id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div>
                  <span className="font-medium">{device.name}</span>
                  <span className="text-sm text-gray-600 ml-2">({device.deviceId})</span>
                </div>
                <span className={`px-2 py-1 text-xs rounded ${
                  device.status === 'online' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {device.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default UsersManagement