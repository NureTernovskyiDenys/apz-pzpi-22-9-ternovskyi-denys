import React, { useState } from 'react'
import { 
  Play, 
  Pause, 
  CheckCircle, 
  Clock, 
  Calendar, 
  MoreHorizontal,
  Edit,
  Trash2,
  AlertTriangle,
  Smartphone,
  Star
} from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'
import { useDevices } from '../../hooks/useApi'

const TaskCard = ({ task, onEdit, onDelete, onAction }) => {
  const { t } = useLanguage()
  const [showActions, setShowActions] = useState(false)
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const { data: devicesData } = useDevices()

  const devices = devicesData?.devices || []
  const onlineDevices = devices.filter(d => d.isOnline)

  const handleStart = () => {
    if (onlineDevices.length > 0) {
      const deviceId = selectedDeviceId || onlineDevices[0].deviceId
      onAction(task._id, 'start', { deviceId })
    } else {
      onAction(task._id, 'start')
    }
  }

  const handlePause = () => {
    onAction(task._id, 'pause')
  }

  const handleComplete = () => {
    const rating = window.prompt('Rate task completion (1-5):')
    const feedback = window.prompt('Any feedback?')
    onAction(task._id, 'complete', { 
      rating: rating ? parseInt(rating) : 5, 
      feedback 
    })
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 1: return 'text-red-600 bg-red-50 border-red-200'
      case 2: return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 3: return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100'
      case 'in_progress': return 'text-blue-600 bg-blue-100'
      case 'paused': return 'text-yellow-600 bg-yellow-100'
      case 'assigned': return 'text-purple-600 bg-purple-100'
      case 'overdue': return 'text-red-600 bg-red-100'
      case 'cancelled': return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getPriorityText = (priority) => {
    switch (priority) {
      case 1: return t('high')
      case 2: return t('medium')
      case 3: return t('low')
      default: return t('medium')
    }
  }

  const isOverdue = task.timing?.deadline && new Date(task.timing.deadline) < new Date() && task.status !== 'completed'
  const canStart = ['pending', 'assigned', 'paused'].includes(task.status)
  const canPause = task.status === 'in_progress'
  const canComplete = ['in_progress', 'paused'].includes(task.status)

  return (
    <div className="p-6 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between">
        {/* Task Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="text-lg font-medium text-gray-900 truncate">
              {task.title}
            </h3>
            
            {/* Priority Badge */}
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
              {task.priority === 1 && <Star className="w-3 h-3 mr-1" />}
              {getPriorityText(task.priority)}
            </span>

            {/* Status Badge */}
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
              {t(task.status)}
            </span>

            {/* Overdue Warning */}
            {isOverdue && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-red-600 bg-red-100">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {t('overdue')}
              </span>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Meta Info */}
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              <span>{task.timing?.estimatedDuration || 0} {t('minutes')}</span>
            </div>
            
            {task.timing?.deadline && (
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                <span>{new Date(task.timing.deadline).toLocaleDateString()}</span>
              </div>
            )}

            <div className="flex items-center">
              <span className="capitalize">{t(task.category)}</span>
            </div>

            {task.assignedDevice && (
              <div className="flex items-center">
                <Smartphone className="w-4 h-4 mr-1" />
                <span>Device assigned</span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {task.progress?.percentage > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Progress</span>
                <span>{task.progress.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full"
                  style={{ width: `${task.progress.percentage}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 ml-4">
          {/* Device Selection for Start */}
          {canStart && onlineDevices.length > 1 && (
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Auto-select device</option>
              {onlineDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.name}
                </option>
              ))}
            </select>
          )}

          {/* Action Buttons */}
          {canStart && (
            <button
              onClick={handleStart}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <Play className="w-4 h-4 mr-1" />
              {t('startTask')}
            </button>
          )}

          {canPause && (
            <button
              onClick={handlePause}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Pause className="w-4 h-4 mr-1" />
              {t('pauseTask')}
            </button>
          )}

          {canComplete && (
            <button
              onClick={handleComplete}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              {t('completeTask')}
            </button>
          )}

          {/* More Actions Menu */}
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {showActions && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                <button
                  onClick={() => {
                    onEdit(task)
                    setShowActions(false)
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Edit className="w-4 h-4 mr-3" />
                  {t('edit')}
                </button>
                
                {task.status !== 'completed' && (
                  <button
                    onClick={() => {
                      onDelete(task._id)
                      setShowActions(false)
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-3" />
                    {t('delete')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Suggestions */}
      {task.aiSuggestions && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
          <div className="text-xs font-medium text-blue-800 mb-1">AI Suggestions</div>
          <div className="text-xs text-blue-700">
            Optimal time: {task.aiSuggestions.optimalTime} • 
            Energy level: {task.aiSuggestions.energyLevel} • 
            Focus needed: {task.aiSuggestions.estimatedFocus}/10
          </div>
          {task.aiSuggestions.tips && task.aiSuggestions.tips.length > 0 && (
            <div className="text-xs text-blue-600 mt-1">
              💡 {task.aiSuggestions.tips[0]}
            </div>
          )}
        </div>
      )}

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

export default TaskCard