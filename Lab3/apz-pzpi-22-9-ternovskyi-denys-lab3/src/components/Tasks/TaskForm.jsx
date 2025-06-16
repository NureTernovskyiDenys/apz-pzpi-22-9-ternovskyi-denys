import React, { useState, useEffect } from 'react'
import { Calendar, Clock, Tag, AlertCircle, Lightbulb } from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'
import { apiHelpers } from '../../utils/api'

const TaskForm = ({ task, onSubmit, onCancel }) => {
  const { t } = useLanguage()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'work',
    priority: 2,
    timing: {
      estimatedDuration: 30,
      deadline: '',
      scheduledStart: ''
    },
    tags: []
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [aiEstimation, setAiEstimation] = useState(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const [newTag, setNewTag] = useState('')

  // Initialize form with task data if editing
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        category: task.category || 'work',
        priority: task.priority || 2,
        timing: {
          estimatedDuration: task.timing?.estimatedDuration || 30,
          deadline: task.timing?.deadline ? new Date(task.timing.deadline).toISOString().slice(0, 16) : '',
          scheduledStart: task.timing?.scheduledStart ? new Date(task.timing.scheduledStart).toISOString().slice(0, 16) : ''
        },
        tags: task.tags || []
      })
    }
  }, [task])

  // Get AI estimation when title/description changes
  useEffect(() => {
    const getAIEstimation = async () => {
      if (formData.title.length > 3) {
        setLoadingAI(true)
        try {
          const response = await apiHelpers.estimateTask({
            title: formData.title,
            description: formData.description,
            category: formData.category,
            priority: formData.priority
          })
          setAiEstimation(response.data.estimation)
        } catch (error) {
          console.warn('AI estimation failed:', error)
        } finally {
          setLoadingAI(false)
        }
      }
    }

    const timeoutId = setTimeout(getAIEstimation, 1000)
    return () => clearTimeout(timeoutId)
  }, [formData.title, formData.description])

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
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }))
    }
  }

  const handleAddTag = (e) => {
    e.preventDefault()
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const applyAIEstimation = () => {
    if (aiEstimation) {
      setFormData(prev => ({
        ...prev,
        timing: {
          ...prev.timing,
          estimatedDuration: aiEstimation.estimatedDuration
        }
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }

    if (formData.timing.estimatedDuration < 1 || formData.timing.estimatedDuration > 480) {
      newErrors.estimatedDuration = 'Duration must be between 1 and 480 minutes'
    }

    if (formData.timing.deadline) {
      const deadline = new Date(formData.timing.deadline)
      if (deadline < new Date()) {
        newErrors.deadline = 'Deadline cannot be in the past'
      }
    }

    if (formData.timing.scheduledStart && formData.timing.deadline) {
      const start = new Date(formData.timing.scheduledStart)
      const deadline = new Date(formData.timing.deadline)
      if (start > deadline) {
        newErrors.scheduledStart = 'Start time cannot be after deadline'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    try {
      // Convert datetime-local to ISO string for deadline and scheduledStart
      const submitData = {
        ...formData,
        timing: {
          ...formData.timing,
          deadline: formData.timing.deadline ? new Date(formData.timing.deadline).toISOString() : null,
          scheduledStart: formData.timing.scheduledStart ? new Date(formData.timing.scheduledStart).toISOString() : null
        }
      }
      
      await onSubmit(submitData)
    } finally {
      setLoading(false)
    }
  }

  const categoryOptions = [
    { value: 'work', label: t('work') },
    { value: 'personal', label: t('personal') },
    { value: 'health', label: t('health') },
    { value: 'learning', label: t('learning') },
    { value: 'exercise', label: t('exercise') },
    { value: 'break', label: t('break') },
    { value: 'other', label: t('other') },
  ]

  const priorityOptions = [
    { value: 1, label: t('high'), color: 'text-red-600' },
    { value: 2, label: t('medium'), color: 'text-yellow-600' },
    { value: 3, label: t('low'), color: 'text-green-600' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          {t('taskTitle')} *
        </label>
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.title ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Enter task title..."
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          {t('description')}
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          value={formData.description}
          onChange={handleChange}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Describe the task in detail..."
        />
      </div>

      {/* Category and Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            {t('category')}
          </label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
            {t('priority')}
          </label>
          <select
            id="priority"
            name="priority"
            value={formData.priority}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value} className={option.color}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Timing */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Timing</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Estimated Duration */}
          <div>
            <label htmlFor="estimatedDuration" className="block text-sm font-medium text-gray-700">
              <Clock className="w-4 h-4 inline mr-1" />
              {t('estimatedDuration')} ({t('minutes')}) *
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                id="estimatedDuration"
                name="timing.estimatedDuration"
                min="1"
                max="480"
                value={formData.timing.estimatedDuration}
                onChange={handleChange}
                className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.estimatedDuration ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {aiEstimation && (
                <button
                  type="button"
                  onClick={applyAIEstimation}
                  className="mt-1 px-3 py-2 text-sm border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50"
                  title={`AI suggests: ${aiEstimation.estimatedDuration} minutes`}
                >
                  AI: {aiEstimation.estimatedDuration}m
                </button>
              )}
            </div>
            {errors.estimatedDuration && (
              <p className="mt-1 text-sm text-red-600">{errors.estimatedDuration}</p>
            )}
          </div>

          {/* Scheduled Start */}
          <div>
            <label htmlFor="scheduledStart" className="block text-sm font-medium text-gray-700">
              <Calendar className="w-4 h-4 inline mr-1" />
              Scheduled Start
            </label>
            <input
              type="datetime-local"
              id="scheduledStart"
              name="timing.scheduledStart"
              value={formData.timing.scheduledStart}
              onChange={handleChange}
              className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.scheduledStart ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.scheduledStart && (
              <p className="mt-1 text-sm text-red-600">{errors.scheduledStart}</p>
            )}
          </div>

          {/* Deadline */}
          <div>
            <label htmlFor="deadline" className="block text-sm font-medium text-gray-700">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              {t('deadline')}
            </label>
            <input
              type="datetime-local"
              id="deadline"
              name="timing.deadline"
              value={formData.timing.deadline}
              onChange={handleChange}
              className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.deadline ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.deadline && (
              <p className="mt-1 text-sm text-red-600">{errors.deadline}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Tag className="w-4 h-4 inline mr-1" />
          Tags
        </label>
        
        {/* Existing Tags */}
        <div className="flex flex-wrap gap-2 mb-2">
          {formData.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="ml-1 text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>

        {/* Add New Tag */}
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTag(e)}
            placeholder="Add tag..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleAddTag}
            className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Add
          </button>
        </div>
      </div>

      {/* AI Insights */}
      {aiEstimation && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <Lightbulb className="w-5 h-5 text-blue-600 mr-2" />
            <h4 className="font-medium text-blue-900">AI Insights</h4>
            {loadingAI && <div className="spinner ml-2"></div>}
          </div>
          <div className="text-sm text-blue-800 space-y-1">
            <p>Estimated duration: {aiEstimation.estimatedDuration} minutes</p>
            <p>Difficulty: {aiEstimation.difficulty}/10</p>
            <p>Energy level: {aiEstimation.energyLevel}</p>
            <p>Confidence: {Math.round(aiEstimation.confidence * 100)}%</p>
          </div>
          {aiEstimation.tips && aiEstimation.tips.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-blue-900">Tips:</p>
              <ul className="text-sm text-blue-800 list-disc list-inside">
                {aiEstimation.tips.map((tip, index) => (
                  <li key={index}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 border border-transparent rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center">
              <div className="spinner mr-2"></div>
              Saving...
            </div>
          ) : (
            task ? t('update') : t('create')
          )}
        </button>
      </div>
    </form>
  )
}

export default TaskForm