import React from 'react'
import { 
  Users, 
  Smartphone, 
  Activity, 
  Server, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Wifi
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import { useLanguage } from '../../contexts/LanguageContext'
import { useApi } from '../../hooks/useApi'
import { apiHelpers } from '../../utils/api'

const AdminDashboard = () => {
  const { t } = useLanguage()

  // API hooks for admin data
  const { 
    data: dashboardData, 
    loading: dashboardLoading, 
    error: dashboardError 
  } = useApi(() => apiHelpers.getAdminDashboard(), [], { immediate: true })

  const { 
    data: systemAnalytics, 
    loading: analyticsLoading 
  } = useApi(() => apiHelpers.getSystemAnalytics({ days: 30 }), [], { immediate: true })

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    )
  }

  if (dashboardError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Failed to load admin dashboard</p>
      </div>
    )
  }

  const stats = dashboardData?.systemStats || {}
  const serviceStatus = dashboardData?.serviceStatus || {}
  const recentActivity = dashboardData?.recentActivity || []
  const trends = dashboardData?.trends || {}

  // Transform data for charts
  const userGrowthData = trends.userGrowth?.map(item => ({
    date: new Date(item._id).toLocaleDateString(),
    users: item.count
  })) || []

  const deviceTypeData = trends.deviceDistribution?.map(item => ({
    name: item._id.replace('_', ' '),
    total: item.count,
    online: item.online
  })) || []

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600">System overview and management</p>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="w-8 h-8 text-blue-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{t('totalUsers')}</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.users?.total || 0}</p>
              <p className="text-xs text-green-600">
                +{stats.users?.new || 0} this week
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Smartphone className="w-8 h-8 text-green-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Devices</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.devices?.total || 0}</p>
              <p className="text-xs text-blue-600">
                {stats.devices?.online || 0} online
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="w-8 h-8 text-purple-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Tasks Completed</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.tasks?.completed || 0}</p>
              <p className="text-xs text-green-600">
                +{stats.tasks?.completedThisWeek || 0} this week
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Activity className="w-8 h-8 text-indigo-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Tasks</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.tasks?.active || 0}</p>
              <p className="text-xs text-gray-600">
                {stats.tasks?.total || 0} total
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Service Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{t('systemHealth')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* MQTT Status */}
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${serviceStatus.mqtt?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <div>
              <p className="font-medium">MQTT Broker</p>
              <p className="text-sm text-gray-600">
                {serviceStatus.mqtt?.connected ? 'Connected' : 'Disconnected'}
              </p>
            </div>
          </div>

          {/* AI Service Status */}
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${serviceStatus.ai?.initialized ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <div>
              <p className="font-medium">AI Service</p>
              <p className="text-sm text-gray-600">
                {serviceStatus.ai?.initialized ? 'Active' : 'Limited'}
              </p>
            </div>
          </div>

          {/* Database Status */}
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${serviceStatus.database?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <div>
              <p className="font-medium">Database</p>
              <p className="text-sm text-gray-600">
                {serviceStatus.database?.connected ? 'Connected' : 'Disconnected'}
              </p>
            </div>
          </div>
        </div>

        {/* Uptime */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-600">
              System uptime: {Math.floor((serviceStatus.uptime || 0) / 3600)}h {Math.floor(((serviceStatus.uptime || 0) % 3600) / 60)}m
            </span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">User Growth (30 days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={userGrowthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="users" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  name="New Users" 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Device Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Device Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deviceTypeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" fill="#3B82F6" name="Total" />
                <Bar dataKey="online" fill="#10B981" name="Online" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity & System Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('recentActivity')}</h3>
          <div className="space-y-4 max-h-64 overflow-y-auto">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {activity.action === 'user_registered' ? (
                      <Users className="w-5 h-5 text-blue-500" />
                    ) : activity.action === 'device_registered' ? (
                      <Smartphone className="w-5 h-5 text-green-500" />
                    ) : activity.action === 'task_completed' ? (
                      <CheckCircle className="w-5 h-5 text-purple-500" />
                    ) : (
                      <Activity className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {activity.user?.firstName} {activity.user?.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {activity.action.replace('_', ' ')} • {new Date(activity.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Activity className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* System Metrics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Metrics</h3>
          <div className="space-y-4">
            {systemAnalytics && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Active Users (7 days)</span>
                  <span className="font-medium">{systemAnalytics.systemMetrics?.activeUsers || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Online Devices</span>
                  <span className="font-medium">{systemAnalytics.systemMetrics?.onlineDevices || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Tasks This Month</span>
                  <span className="font-medium">{systemAnalytics.systemMetrics?.totalTasks || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Completion Rate</span>
                  <span className="font-medium">
                    {systemAnalytics.systemMetrics?.completedTasks && systemAnalytics.systemMetrics?.totalTasks
                      ? Math.round((systemAnalytics.systemMetrics.completedTasks / systemAnalytics.systemMetrics.totalTasks) * 100)
                      : 0}%
                  </span>
                </div>
              </>
            )}

            {/* AI Performance */}
            {systemAnalytics?.aiPerformance && (
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-900 mb-2">AI Performance</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Accuracy</span>
                    <span className="font-medium">
                      {Math.round(systemAnalytics.aiPerformance.avgOverallAccuracy || 0)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Predictions</span>
                    <span className="font-medium">{systemAnalytics.aiPerformance.totalPredictions || 0}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <a
            href="/admin/users"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Users className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <p className="font-medium text-gray-900">Manage Users</p>
              <p className="text-sm text-gray-600">{stats.users?.total || 0} total users</p>
            </div>
          </a>
          
          <a
            href="/admin/devices"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Smartphone className="w-8 h-8 text-green-500 mr-3" />
            <div>
              <p className="font-medium text-gray-900">Device Management</p>
              <p className="text-sm text-gray-600">{stats.devices?.online || 0} online devices</p>
            </div>
          </a>
          
          <a
            href="/admin/logs"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Database className="w-8 h-8 text-purple-500 mr-3" />
            <div>
              <p className="font-medium text-gray-900">System Logs</p>
              <p className="text-sm text-gray-600">View system activity</p>
            </div>
          </a>
          
          <div className="flex items-center p-4 border border-gray-200 rounded-lg">
            <Server className="w-8 h-8 text-indigo-500 mr-3" />
            <div>
              <p className="font-medium text-gray-900">System Status</p>
              <p className="text-sm text-green-600">All systems operational</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard