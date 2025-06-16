import React, { useState } from 'react'
import { Plus, Filter, Search, MoreHorizontal } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { useTasks, useCreate, useUpdate, useDelete } from '../hooks/useApi'
import { apiHelpers } from '../utils/api'
import TaskCard from '../components/Tasks/TaskCard'
import TaskForm from '../components/Tasks/TaskForm'
import Modal from '../components/Common/Modal'

const Tasks = () => {
  const { t } = useLanguage()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedPriority, setSelectedPriority] = useState('')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [page, setPage] = useState(1)

  // API hooks
  const { 
    data: tasksData, 
    loading: tasksLoading, 
    refetch: refetchTasks 
  } = useTasks({
    search: searchTerm,
    status: selectedStatus,
    category: selectedCategory,
    priority: selectedPriority,
    page,
    limit: 20
  })

  const { create: createTask } = useCreate(apiHelpers.createTask, {
    onSuccess: () => {
      setShowTaskForm(false)
      refetchTasks()
    }
  })

  const { update: updateTask } = useUpdate(apiHelpers.updateTask, {
    onSuccess: () => {
      setEditingTask(null)
      setShowTaskForm(false)
      refetchTasks()
    }
  })

  const { delete: deleteTask } = useDelete(apiHelpers.deleteTask, {
    onSuccess: () => {
      refetchTasks()
    }
  })

  const handleCreateTask = () => {
    setEditingTask(null)
    setShowTaskForm(true)
  }

  const handleEditTask = (task) => {
    setEditingTask(task)
    setShowTaskForm(true)
  }

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      await deleteTask(taskId)
    }
  }

  const handleTaskAction = async (taskId, action, data = {}) => {
    try {
      switch (action) {
        case 'start':
          await apiHelpers.startTask(taskId, data.deviceId)
          break
        case 'pause':
          await apiHelpers.pauseTask(taskId)
          break
        case 'complete':
          await apiHelpers.completeTask(taskId, data)
          break
        default:
          break
      }
      refetchTasks()
    } catch (error) {
      console.error('Task action failed:', error)
    }
  }

  const statusOptions = [
    { value: '', label: t('filter') + ' ' + t('status') },
    { value: 'pending', label: t('pending') },
    { value: 'assigned', label: t('assigned') },
    { value: 'in_progress', label: t('inProgress') },
    { value: 'paused', label: t('paused') },
    { value: 'completed', label: t('completed') },
    { value: 'cancelled', label: t('cancelled') },
  ]

  const categoryOptions = [
    { value: '', label: t('filter') + ' ' + t('category') },
    { value: 'work', label: t('work') },
    { value: 'personal', label: t('personal') },
    { value: 'health', label: t('health') },
    { value: 'learning', label: t('learning') },
    { value: 'exercise', label: t('exercise') },
    { value: 'break', label: t('break') },
    { value: 'other', label: t('other') },
  ]

  const priorityOptions = [
    { value: '', label: t('filter') + ' ' + t('priority') },
    { value: '1', label: t('high') },
    { value: '2', label: t('medium') },
    { value: '3', label: t('low') },
  ]

  const tasks = tasksData?.tasks || []
  const pagination = tasksData?.pagination || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('tasks')}</h1>
          <p className="text-gray-600">Manage your tasks and track progress</p>
        </div>
        <button
          onClick={handleCreateTask}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('newTask')}
        </button>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="bg-white rounded-lg shadow">
        {tasksLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : tasks.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {tasks.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
                onAction={handleTaskAction}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Plus className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || selectedStatus || selectedCategory || selectedPriority
                ? 'Try adjusting your filters'
                : 'Get started by creating your first task'
              }
            </p>
            {!searchTerm && !selectedStatus && !selectedCategory && !selectedPriority && (
              <button
                onClick={handleCreateTask}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('newTask')}
              </button>
            )}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing page {pagination.currentPage} of {pagination.totalPages}
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

      {/* Task Form Modal */}
      <Modal
        isOpen={showTaskForm}
        onClose={() => {
          setShowTaskForm(false)
          setEditingTask(null)
        }}
        title={editingTask ? t('edit') + ' ' + t('taskTitle') : t('newTask')}
      >
        <TaskForm
          task={editingTask}
          onSubmit={async (data) => {
            if (editingTask) {
              await updateTask(editingTask._id, data)
            } else {
              await createTask(data)
            }
          }}
          onCancel={() => {
            setShowTaskForm(false)
            setEditingTask(null)
          }}
        />
      </Modal>
    </div>
  )
}

export default Tasks