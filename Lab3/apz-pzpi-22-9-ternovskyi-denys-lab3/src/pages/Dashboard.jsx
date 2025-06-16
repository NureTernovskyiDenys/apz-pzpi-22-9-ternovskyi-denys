import React from 'react'
import { 
  CheckCircle, 
  Clock, 
  Smartphone, 
  TrendingUp,
  Play,
  Calendar,
  AlertCircle
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useDashboardAnalytics } from '../hooks/useApi'

const Dashboard = () => {
  const { user } = useAuth()
  const { t } = useLanguage()
  const { data: analytics, loading, error } = useDashboardAnalytics()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Failed to load dashboard data</p>
      </div>
    )
  }

  const stats = [
    {
      name: t('todaysTasks'),
      value: analytics?.overview?.todaysTasks || 0,
      icon: Calendar,
      color: 'bg-blue-500',
      change: '+2.1%',
      changeType: 'increase'
    },
    {
      name: t('completedTasks'),
      value: analytics?.overview?.totalTasksCompleted || 0,
      icon: CheckCircle,
      color: 'bg-green-500',
      change: '+4.3%',
      changeType: 'increase'
    },
    {
      name: t('totalWorkTime'),
      value: `${Math.round((analytics?.overview?.totalWorkingTime || 0) / 60)}h`,
      icon: Clock,
      color: 'bg-purple-500',
      change: '+1.8%',
      changeType: 'increase'
    },
    {
      name: t('onlineDevices'),
      value: analytics?.devices?.onlineDevices || 0,
      icon: Smartphone,
      color: 'bg-indigo-500',
      change: analytics?.devices?.totalDevices > 0 ? 'All online' : 'No devices',
      changeType: analytics?.devices?.onlineDevices === analytics?.devices?.totalDevices ? 'increase' : 'decrease'
    }
  ]

  const recentTasks = analytics?.recentActivity?.slice(0, 5) || []
  const upcomingDeadlines = analytics?.upcomingDeadlines || []

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold">
          {t('welcome', { name: user?.firstName })}
        </h1>
        <p className="mt-2 text-blue-100">
          Here's what's happening with your tasks today
        </p>
        <div className="mt-4 flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm">
              {analytics?.overview?.productivityScore || 75}% {t('productivity')}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">
              {analytics?.trends?.weeklyComparison?.change || 0}% vs last week
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`${stat.color} rounded-lg p-3`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              </div>
            </div>
            <div className="mt-4">
              <span className={`inline-flex items-center text-sm ${
                stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
              }`}>
                {stat.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">{t('recentActivity')}</h3>
          </div>
          <div className="p-6">
            {recentTasks.length > 0 ? (
              <div className="space-y-4">
                {recentTasks.map((activity, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {activity.action === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : activity.action === 'started' ? (
                        <Play className="w-5 h-5 text-blue-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.task?.title || 'Task'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {activity.action} • {new Date(activity.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Upcoming Deadlines</h3>
          </div>
          <div className="p-6">
            {upcomingDeadlines.length > 0 ? (
              <div className="space-y-4">
                {upcomingDeadlines.map((task) => (
                  <div key={task._id} className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <AlertCircle className={`w-5 h-5 ${
                        new Date(task.timing.deadline) < new Date(Date.now() + 24 * 60 * 60 * 1000)
                          ? 'text-red-500' 
                          : 'text-yellow-500'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {task.title}
                      </p>
                      <p className="text-sm text-gray-500">
                        Due: {new Date(task.timing.deadline).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        task.priority === 1 
                          ? 'bg-red-100 text-red-800'
                          : task.priority === 2
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {task.priority === 1 ? t('high') : task.priority === 2 ? t('medium') : t('low')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">No upcoming deadlines</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/tasks"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <CheckCircle className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <p className="font-medium text-gray-900">{t('newTask')}</p>
              <p className="text-sm text-gray-600">Create a new task</p>
            </div>
          </a>
          
          <a
            href="/devices"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Smartphone className="w-8 h-8 text-green-500 mr-3" />
            <div>
              <p className="font-medium text-gray-900">{t('devices')}</p>
              <p className="text-sm text-gray-600">Manage your devices</p>
            </div>
          </a>
          
          <a
            href="/analytics"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <TrendingUp className="w-8 h-8 text-purple-500 mr-3" />
            <div>
              <p className="font-medium text-gray-900">{t('analytics')}</p>
              <p className="text-sm text-gray-600">View your productivity</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}

export default Dashboard