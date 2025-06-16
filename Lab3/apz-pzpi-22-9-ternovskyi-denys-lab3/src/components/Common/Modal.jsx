import React, { useEffect } from 'react'
import { X } from 'lucide-react'

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  className = ''
}) => {
  // Handle escape key press
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.keyCode === 27 && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const getSizeClasses = () => {
    switch (size) {
      case 'xs':
        return 'max-w-xs'
      case 'sm':
        return 'max-w-sm'
      case 'md':
        return 'max-w-md'
      case 'lg':
        return 'max-w-2xl'
      case 'xl':
        return 'max-w-4xl'
      case 'full':
        return 'max-w-full mx-4'
      default:
        return 'max-w-md'
    }
  }

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleOverlayClick}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`
            relative w-full ${getSizeClasses()} 
            transform rounded-lg bg-white shadow-xl transition-all
            ${className}
          `}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              {title && (
                <h3 className="text-lg font-medium text-gray-900">
                  {title}
                </h3>
              )}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-6 h-6" />
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="px-6 py-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// Confirmation Modal Component
export const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirm Action',
  message = 'Are you sure you want to continue?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'red',
  loading = false
}) => {
  const getConfirmButtonClasses = () => {
    const baseClasses = 'px-4 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
    
    switch (confirmColor) {
      case 'red':
        return `${baseClasses} text-white bg-red-600 hover:bg-red-700 focus:ring-red-500`
      case 'blue':
        return `${baseClasses} text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`
      case 'green':
        return `${baseClasses} text-white bg-green-600 hover:bg-green-700 focus:ring-green-500`
      default:
        return `${baseClasses} text-white bg-gray-600 hover:bg-gray-700 focus:ring-gray-500`
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      closeOnOverlayClick={!loading}
    >
      <div className="space-y-4">
        <p className="text-gray-600">{message}</p>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={getConfirmButtonClasses()}
          >
            {loading ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Loading...
              </div>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// Alert Modal Component
export const AlertModal = ({ 
  isOpen, 
  onClose, 
  title = 'Alert',
  message = '',
  type = 'info',
  buttonText = 'OK'
}) => {
  const getIconAndColor = () => {
    switch (type) {
      case 'success':
        return {
          icon: '✅',
          bgColor: 'bg-green-50',
          textColor: 'text-green-800',
          buttonColor: 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
        }
      case 'error':
        return {
          icon: '❌',
          bgColor: 'bg-red-50',
          textColor: 'text-red-800',
          buttonColor: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
        }
      case 'warning':
        return {
          icon: '⚠️',
          bgColor: 'bg-yellow-50',
          textColor: 'text-yellow-800',
          buttonColor: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
        }
      default:
        return {
          icon: 'ℹ️',
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-800',
          buttonColor: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
        }
    }
  }

  const { icon, bgColor, textColor, buttonColor } = getIconAndColor()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
    >
      <div className={`${bgColor} p-4 rounded-lg mb-4`}>
        <div className="flex items-center">
          <span className="text-2xl mr-3">{icon}</span>
          <p className={`${textColor} font-medium`}>{message}</p>
        </div>
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={onClose}
          className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 ${buttonColor}`}
        >
          {buttonText}
        </button>
      </div>
    </Modal>
  )
}

export default Modal