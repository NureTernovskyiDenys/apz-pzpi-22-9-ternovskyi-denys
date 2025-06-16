import React, { useState } from 'react'
import { Calendar, TrendingUp, Clock, Target, Download, RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import { useLanguage } from '../contexts/LanguageContext'
import { useProductivityAnalytics, useApi } from '../hooks/useApi'
import { apiHelpers } from '../utils/api'

const Analytics = () => {
  const { t } = useLanguage()
  const [selectedPeriod, setSelectedPeriod] = useState(30)
  const [selectedView, setSelectedView] = useState('overview')

  // API hooks
  const { 
    data: analytics, 
    loading: analyticsLoading, 
    refetch: refetchAnalytics 
  } = useProductivityAnalytics({ days: selectedPeriod })

  const { 
    data: heatmapData, 
    loading: heatmapLoading 
  } = useApi(
    () => apiHelpers.getHeatmapData({ days: selectedPeriod }),
    [selectedPeriod]
  )

  const { 
    data: goalsData, 
    loading: goalsLoading 
  } = useApi(
    () => apiHelpers.getGoalsProgress(),
    []
  )

  const periodOptions = [
    { value: 7, label: '7 Days' },
    { value: 30, label: '30 Days' },
    { value: 90, label: '90 Days' },
    { value: 365, label: '1 Year' },
  ]

  const viewOptions = [
    { value: 'overview', label: 'Overview' },
    { value: 'productivity', label: t('productivity') },
    { value: 'time', label: t('timeTracking') },
    { value: 'goals', label: 'Goals' },
  ]

  const handleExportData = async () => {
    try {
      const response = await apiHelpers.exportAnalytics({ 
        days: selectedPeriod, 
        format: 'json' 
      })
      
      // Create download link
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { 
        type: 'application/json' 
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `analytics-${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  // Sample data transformation for charts
  const productivityTrends = analytics?.hourlyProductivity?.map(item => ({
    hour: `${item._id}:00`,
    efficiency: item.avgEfficiency || 0,
    focus: item.avgFocus || 0,
    tasks: item.count || 0
  })) || []

  const categoryData = analytics?.categoryPerformance?.map(item => ({
    name: item._id,
    tasks: item.totalTasks,
    efficiency: item.efficiency * 100,
    time: item.totalTime
  })) || []

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

  if (analyticsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('analytics')}</h1>
          <p className="text-gray-600">Track your productivity and performance</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={refetchAnalytics}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('refresh')}
          </button>
          <button
            onClick={handleExportData}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="w-4 h-4 mr-2" />
            {t('export')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Period
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(Number(e.target.value))}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              View
            </label>
            <select
              value={selectedView}
              onChange={(e) => setSelectedView(e.target.value)}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {viewOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedView === 'overview' && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Target className="w-8 h-8 text-blue-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {analytics?.insights?.averageCompletionRate || 0}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg Efficiency</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {Math.round(analytics?.insights?.averageEfficiency || 0)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Clock className="w-8 h-8 text-purple-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Focus Time</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {Math.round((analytics?.focusAnalysis?.totalFocusTime || 0) / 60000 / 60)}h
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Calendar className="w-8 h-8 text-indigo-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Streak Days</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {analytics?.streakAnalysis?.currentStreak || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Productivity Trends Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Hourly Productivity</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={productivityTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="efficiency" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    name="Efficiency %" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="focus" 
                    stroke="#10B981" 
                    strokeWidth={2}
                    name="Focus Level" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Category Performance</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="tasks" fill="#3B82F6" name="Tasks" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Task Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="tasks"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedView === 'goals' && !goalsLoading && goalsData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Daily Goals */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Daily Goals</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Tasks ({goalsData.progress.daily.completedToday}/{goalsData.goals.daily.tasks})</span>
                  <span>{goalsData.progressPercentages.daily.tasks.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${Math.min(goalsData.progressPercentages.daily.tasks, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Time ({Math.round(goalsData.progress.daily.totalTimeToday / 60)}h/{Math.round(goalsData.goals.daily.time / 60)}h)</span>
                  <span>{goalsData.progressPercentages.daily.time.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${Math.min(goalsData.progressPercentages.daily.time, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Goals */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Weekly Goals</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Tasks ({goalsData.progress.weekly.completedThisWeek}/{goalsData.goals.weekly.tasks})</span>
                  <span>{goalsData.progressPercentages.weekly.tasks.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${Math.min(goalsData.progressPercentages.weekly.tasks, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Time ({Math.round(goalsData.progress.weekly.totalTimeThisWeek / 60)}h/{Math.round(goalsData.goals.weekly.time / 60)}h)</span>
                  <span>{goalsData.progressPercentages.weekly.time.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${Math.min(goalsData.progressPercentages.weekly.time, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Goals */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Goals</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Tasks ({goalsData.progress.monthly.completedThisMonth}/{goalsData.goals.monthly.tasks})</span>
                  <span>{goalsData.progressPercentages.monthly.tasks.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${Math.min(goalsData.progressPercentages.monthly.tasks, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Time ({Math.round(goalsData.progress.monthly.totalTimeThisMonth / 60)}h/{Math.round(goalsData.goals.monthly.time / 60)}h)</span>
                  <span>{goalsData.progressPercentages.monthly.time.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${Math.min(goalsData.progressPercentages.monthly.time, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {analytics?.recommendations && analytics.recommendations.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recommendations</h3>
          <div className="space-y-3">
            {analytics.recommendations.map((rec, index) => (
              <div key={index} className={`p-3 rounded-lg border-l-4 ${
                rec.priority === 'high' 
                  ? 'bg-red-50 border-red-400' 
                  : rec.priority === 'medium'
                  ? 'bg-yellow-50 border-yellow-400'
                  : 'bg-blue-50 border-blue-400'
              }`}>
                <p className="text-sm font-medium">{rec.message}</p>
                <p className="text-xs text-gray-600 mt-1">
                  Priority: {rec.priority} • Category: {rec.type}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Analytics