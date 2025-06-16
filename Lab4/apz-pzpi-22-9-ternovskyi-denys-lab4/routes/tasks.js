const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const moment = require('moment');

const Task = require('../models/Task');
const Device = require('../models/Device');
const TaskLog = require('../models/TaskLog');
const aiService = require('../services/aiService');
const mqttService = require('../services/mqttService');
const { 
  requireOwnership 
} = require('../middleware/auth');
const { 
  asyncHandler, 
  ValidationError, 
  NotFoundError,
  ConflictError,
  formatValidationError 
} = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Validation rules
const taskValidation = [
  body('title')
    .isLength({ min: 1, max: 100 })
    .trim()
    .withMessage('Task title is required and must be less than 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .trim(),
  body('category')
    .optional()
    .isIn(['work', 'personal', 'health', 'learning', 'exercise', 'break', 'other']),
  body('priority')
    .isInt({ min: 1, max: 3 })
    .withMessage('Priority must be 1 (high), 2 (medium), or 3 (low)'),
  body('timing.estimatedDuration')
    .isInt({ min: 1, max: 480 })
    .withMessage('Estimated duration must be between 1 and 480 minutes'),
  body('timing.deadline')
    .optional()
    .isISO8601()
    .custom((value) => {
      if (moment(value).isBefore(moment())) {
        throw new Error('Deadline cannot be in the past');
      }
      return true;
    }),
  body('timing.scheduledStart')
    .optional()
    .isISO8601(),
  body('tags')
    .optional()
    .isArray()
    .custom((tags) => {
      if (tags.length > 10) {
        throw new Error('Maximum 10 tags allowed');
      }
      return true;
    })
];

const updateTaskValidation = [
  body('title')
    .optional()
    .isLength({ min: 1, max: 100 })
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .trim(),
  body('priority')
    .optional()
    .isInt({ min: 1, max: 3 }),
  body('timing.estimatedDuration')
    .optional()
    .isInt({ min: 1, max: 480 }),
  body('timing.deadline')
    .optional()
    .isISO8601()
    .custom((value) => {
      if (moment(value).isBefore(moment())) {
        throw new Error('Deadline cannot be in the past');
      }
      return true;
    })
];

// @route   GET /api/tasks
// @desc    Get user tasks with filtering and pagination
// @access  Private
router.get('/', asyncHandler(async (req, res) => {
  const {
    status,
    category,
    priority,
    assignedDevice,
    search,
    tags,
    dateFrom,
    dateTo,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build query
  const query = { 
    owner: req.user._id, 
    isActive: true 
  };

  if (status) {
    if (Array.isArray(status)) {
      query.status = { $in: status };
    } else {
      query.status = status;
    }
  }

  if (category) query.category = category;
  if (priority) query.priority = parseInt(priority);
  if (assignedDevice) query.assignedDevice = assignedDevice;

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  if (tags) {
    const tagArray = Array.isArray(tags) ? tags : [tags];
    query.tags = { $in: tagArray };
  }

  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Execute query with pagination
  const tasks = await Task.find(query)
    .populate('assignedDevice', 'name deviceId status')
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

  const total = await Task.countDocuments(query);

  // Add AI insights for pending tasks
  const tasksWithInsights = await Promise.all(
    tasks.map(async (task) => {
      const taskObj = task.toObject();
      
      // Add overdue status
      taskObj.isOverdue = task.isOverdue;
      taskObj.timeRemaining = task.timeRemaining;
      
      return taskObj;
    })
  );

  res.json({
    success: true,
    data: {
      tasks: tasksWithInsights,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalTasks: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      filters: {
        status,
        category,
        priority,
        assignedDevice,
        search,
        tags
      }
    }
  });
}));

// @route   POST /api/tasks
// @desc    Create new task
// @access  Private
router.post('/', taskValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const taskData = {
    ...req.body,
    owner: req.user._id
  };

  // Get AI estimation if available
  try {
    const estimation = await aiService.estimateTask(
      taskData.title + ' ' + (taskData.description || ''),
      [] // TODO: Add user's similar tasks history
    );
    
    taskData.aiSuggestions = {
      optimalTime: estimation.optimalTime || 'morning',
      energyLevel: estimation.energyLevel,
      estimatedFocus: estimation.difficulty,
      tips: estimation.tips || [],
      generatedAt: new Date()
    };
    
    // Adjust estimated duration if AI suggests different
    if (estimation.estimatedDuration && Math.abs(estimation.estimatedDuration - taskData.timing.estimatedDuration) > 10) {
      taskData.timing.aiSuggestedDuration = estimation.estimatedDuration;
    }
  } catch (aiError) {
    logger.warn('AI estimation failed for new task:', aiError.message);
  }

  const task = new Task(taskData);
  await task.save();

  // Auto-assign to user's online device
  const Device = require('../models/Device');
  const userDevices = await Device.find({
    owner: req.user._id,
    isActive: true
  }).sort({ lastSeen: -1 });

  if (userDevices.length > 0) {
    const onlineDevice = userDevices.find(device => 
      mqttService.isDeviceOnline(device.deviceId)
    );
    
    if (onlineDevice) {
      // Assign task to device using deviceId string
      await task.assignToDevice(onlineDevice.deviceId);
      await onlineDevice.assignTask(task._id);
      
      // Send task to device via MQTT
      try {
        await mqttService.sendTaskToDevice(onlineDevice.deviceId, task);
        logger.logTaskEvent(task._id, req.user._id, 'task_auto_assigned', {
          deviceId: onlineDevice.deviceId,
          deviceName: onlineDevice.name
        });
      } catch (mqttError) {
        logger.warn(`Failed to send task to device ${onlineDevice.deviceId}: ${mqttError.message}`);
      }
    }
  }

  // Log task creation
  await TaskLog.logAction({
    taskId: task._id,
    userId: req.user._id,
    action: 'created',
    details: {
      category: task.category,
      priority: task.priority,
      estimatedDuration: task.timing.estimatedDuration,
      autoAssigned: userDevices.length > 0
    },
    sessionId: req.sessionID || `api-${Date.now()}`
  });

  logger.logTaskEvent(task._id, req.user._id, 'task_created', {
    title: task.title,
    category: task.category,
    priority: task.priority
  });

  res.status(201).json({
    success: true,
    message: 'Task created successfully',
    data: {
      task: task.toObject()
    }
  });
}));

// @route   GET /api/tasks/:taskId
// @desc    Get specific task details
// @access  Private
router.get('/:taskId', [
  param('taskId').isMongoId().withMessage('Invalid task ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const task = await Task.findOne({
    _id: req.params.taskId,
    owner: req.user._id,
    isActive: true
  }).populate('assignedDevice', 'name deviceId status lastSeen');

  if (!task) {
    throw new NotFoundError('Task not found');
  }

  // Increment view count
  task.analytics.viewCount += 1;
  await task.save();

  // Get task history/logs
  const taskLogs = await TaskLog.find({ task: task._id })
    .sort({ timestamp: -1 })
    .limit(20);

  const taskData = task.toObject();
  taskData.isOverdue = task.isOverdue;
  taskData.timeRemaining = task.timeRemaining;

  res.json({
    success: true,
    data: {
      task: taskData,
      logs: taskLogs
    }
  });
}));

// @route   PUT /api/tasks/:taskId
// @desc    Update task
// @access  Private
router.put('/:taskId', [
  param('taskId').isMongoId().withMessage('Invalid task ID'),
  ...updateTaskValidation
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const task = await Task.findOne({
    _id: req.params.taskId,
    owner: req.user._id,
    isActive: true
  });

  if (!task) {
    throw new NotFoundError('Task not found');
  }

  // Don't allow updates to completed tasks
  if (task.status === 'completed') {
    throw new ConflictError('Cannot update completed tasks');
  }

  const oldValues = {
    title: task.title,
    priority: task.priority,
    status: task.status
  };

  // Update task fields
  Object.keys(req.body).forEach(key => {
    if (key === 'timing' && req.body.timing) {
      task.timing = { ...task.timing, ...req.body.timing };
    } else if (req.body[key] !== undefined) {
      task[key] = req.body[key];
    }
  });

  task.analytics.editCount += 1;
  await task.save();

  // Log task update
  await TaskLog.logAction({
    taskId: task._id,
    userId: req.user._id,
    action: 'updated',
    details: {
      oldValues,
      newValues: req.body,
      fieldsChanged: Object.keys(req.body)
    },
    sessionId: req.sessionID || `api-${Date.now()}`
  });

  logger.logTaskEvent(task._id, req.user._id, 'task_updated', {
    fieldsChanged: Object.keys(req.body)
  });

  res.json({
    success: true,
    message: 'Task updated successfully',
    data: {
      task: task.toObject()
    }
  });
}));

// @route   POST /api/tasks/:taskId/start
// @desc    Start task
// @access  Private
router.post('/:taskId/start', [
  param('taskId').isMongoId().withMessage('Invalid task ID'),
  body('deviceId').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const task = await Task.findOne({
    _id: req.params.taskId,
    owner: req.user._id,
    isActive: true
  });

  if (!task) {
    throw new NotFoundError('Task not found');
  }

  if (!['pending', 'assigned', 'paused'].includes(task.status)) {
    throw new ConflictError('Task cannot be started in its current status');
  }

  const { deviceId } = req.body;
  let device = null;

  if (deviceId) {
    device = await Device.findOne({
      deviceId,
      owner: req.user._id,
      isActive: true
    });

    if (!device) {
      throw new NotFoundError('Device not found');
    }

    // Check if device has another active task
    if (device.currentTask.isActive && !device.currentTask.taskId.equals(task._id)) {
      throw new ConflictError('Device already has an active task');
    }
  }

  // Start the task
  await task.start(device?.deviceId);

  if (device && !task.assignedDevice) {
    await device.assignTask(task._id);
    await task.assignToDevice(device.deviceId); // Pass deviceId string
    
    // Send task to device via MQTT if online
    if (mqttService.isDeviceOnline(device.deviceId)) {
      try {
        await mqttService.sendTaskToDevice(device.deviceId, task);
      } catch (mqttError) {
        logger.warn(`Failed to send task start to device ${device.deviceId}: ${mqttError.message}`);
      }
    }
  }

  // Log task start
  await TaskLog.logAction({
    taskId: task._id,
    userId: req.user._id,
    deviceId: device?._id,
    action: 'started',
    details: {
      startMethod: deviceId ? 'device' : 'manual',
      deviceId: device?.deviceId
    },
    context: {
      timeOfDay: moment().format('HH') < 12 ? 'morning' : moment().format('HH') < 18 ? 'afternoon' : 'evening',
      dayOfWeek: moment().day()
    },
    sessionId: req.sessionID || `api-${Date.now()}`
  });

  logger.logTaskEvent(task._id, req.user._id, 'task_started', {
    deviceId: device?.deviceId
  });

  res.json({
    success: true,
    message: 'Task started successfully',
    data: {
      task: task.toObject(),
      device: device ? {
        deviceId: device.deviceId,
        name: device.name
      } : null
    }
  });
}));

// @route   POST /api/tasks/:taskId/pause
// @desc    Pause task
// @access  Private
router.post('/:taskId/pause', [
  param('taskId').isMongoId().withMessage('Invalid task ID')
], asyncHandler(async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.taskId,
    owner: req.user._id,
    isActive: true
  });

  if (!task) {
    throw new NotFoundError('Task not found');
  }

  if (task.status !== 'in_progress') {
    throw new ConflictError('Only in-progress tasks can be paused');
  }

  await task.pause();

  // Log task pause
  await TaskLog.logAction({
    taskId: task._id,
    userId: req.user._id,
    action: 'paused',
    details: {
      pausedAt: new Date(),
      timeWorked: task.timing.actualDuration
    },
    sessionId: req.sessionID || `api-${Date.now()}`
  });

  logger.logTaskEvent(task._id, req.user._id, 'task_paused');

  res.json({
    success: true,
    message: 'Task paused successfully',
    data: {
      task: task.toObject()
    }
  });
}));

// @route   POST /api/tasks/:taskId/complete
// @desc    Complete task
// @access  Private
router.post('/:taskId/complete', [
  param('taskId').isMongoId().withMessage('Invalid task ID'),
  body('rating').optional().isInt({ min: 1, max: 5 }),
  body('feedback').optional().isLength({ max: 500 }).trim(),
  body('lessons').optional().isLength({ max: 500 }).trim(),
  body('nextSteps').optional().isLength({ max: 500 }).trim()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const task = await Task.findOne({
    _id: req.params.taskId,
    owner: req.user._id,
    isActive: true
  }).populate('assignedDevice');

  if (!task) {
    throw new NotFoundError('Task not found');
  }

  if (!['in_progress', 'paused', 'assigned'].includes(task.status)) {
    throw new ConflictError('Task cannot be completed in its current status');
  }

  const { rating, feedback, lessons, nextSteps } = req.body;

  // Complete the task
  await task.complete(rating, feedback);

  // Update completion details
  if (lessons) task.completion.lessons = lessons;
  if (nextSteps) task.completion.nextSteps = nextSteps;
  await task.save();

  // Update device if assigned
  if (task.assignedDevice) {
    await Device.findByIdAndUpdate(task.assignedDevice._id, {
      'currentTask.taskId': null,
      'currentTask.isActive': false,
      $inc: { 'statistics.totalTasksCompleted': 1 }
    });
  }

  // Update user statistics
  const User = require('../models/User');
  const user = await User.findById(req.user._id);
  if (user) {
    await user.updateStatistics(task);
  }

  // Calculate performance metrics
  const efficiency = task.timing.estimatedDuration > 0 
    ? (task.timing.estimatedDuration / task.timing.actualDuration) * 100 
    : 100;

  // Log task completion
  await TaskLog.logAction({
    taskId: task._id,
    userId: req.user._id,
    deviceId: task.assignedDevice?._id,
    action: 'completed',
    details: {
      rating,
      feedback,
      actualDuration: task.timing.actualDuration,
      estimatedDuration: task.timing.estimatedDuration,
      efficiency: efficiency.toFixed(1)
    },
    performance: {
      taskEfficiency: Math.min(efficiency, 200),
      qualityScore: rating || 5,
      focusLevel: rating ? rating * 2 : 8
    },
    context: {
      timeOfDay: moment().format('HH') < 12 ? 'morning' : moment().format('HH') < 18 ? 'afternoon' : 'evening',
      dayOfWeek: moment().day()
    },
    sessionId: req.sessionID || `api-${Date.now()}`
  });

  logger.logTaskEvent(task._id, req.user._id, 'task_completed', {
    rating,
    actualDuration: task.timing.actualDuration,
    efficiency: efficiency.toFixed(1)
  });

  res.json({
    success: true,
    message: 'Task completed successfully',
    data: {
      task: task.toObject(),
      performance: {
        efficiency: efficiency.toFixed(1),
        onTime: task.timing.actualDuration <= task.timing.estimatedDuration
      }
    }
  });
}));

// @route   POST /api/tasks/:taskId/cancel
// @desc    Cancel task
// @access  Private
router.post('/:taskId/cancel', [
  param('taskId').isMongoId().withMessage('Invalid task ID'),
  body('reason').optional().isLength({ max: 200 }).trim()
], asyncHandler(async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.taskId,
    owner: req.user._id,
    isActive: true
  });

  if (!task) {
    throw new NotFoundError('Task not found');
  }

  if (task.status === 'completed') {
    throw new ConflictError('Cannot cancel completed tasks');
  }

  const { reason } = req.body;

  task.status = 'cancelled';
  await task.save();

  // Clear device assignment if any
  if (task.assignedDevice) {
    await Device.findByIdAndUpdate(task.assignedDevice, {
      'currentTask.taskId': null,
      'currentTask.isActive': false
    });
  }

  // Log task cancellation
  await TaskLog.logAction({
    taskId: task._id,
    userId: req.user._id,
    action: 'cancelled',
    details: { reason },
    sessionId: req.sessionID || `api-${Date.now()}`
  });

  logger.logTaskEvent(task._id, req.user._id, 'task_cancelled', { reason });

  res.json({
    success: true,
    message: 'Task cancelled successfully',
    data: {
      task: task.toObject()
    }
  });
}));

// @route   POST /api/tasks/:taskId/notes
// @desc    Add note to task
// @access  Private
router.post('/:taskId/notes', [
  param('taskId').isMongoId().withMessage('Invalid task ID'),
  body('content').isLength({ min: 1, max: 500 }).trim().withMessage('Note content is required and must be less than 500 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const task = await Task.findOne({
    _id: req.params.taskId,
    owner: req.user._id,
    isActive: true
  });

  if (!task) {
    throw new NotFoundError('Task not found');
  }

  const { content } = req.body;
  task.addNote(content, req.user._id);
  await task.save();

  // Log note addition
  await TaskLog.logAction({
    taskId: task._id,
    userId: req.user._id,
    action: 'note_added',
    details: { content },
    sessionId: req.sessionID || `api-${Date.now()}`
  });

  res.json({
    success: true,
    message: 'Note added successfully',
    data: {
      note: task.progress.notes[task.progress.notes.length - 1]
    }
  });
}));

// @route   GET /api/tasks/suggestions
// @desc    Get AI-generated task suggestions
// @access  Private
router.get('/suggestions', asyncHandler(async (req, res) => {
  try {
    const suggestions = await aiService.generateTaskSuggestions(req.user._id, {
      currentTime: new Date(),
      userPreferences: req.user.preferences
    });

    res.json({
      success: true,
      data: {
        suggestions,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    logger.warn('Failed to generate task suggestions:', error.message);
    
    // Return fallback suggestions
    res.json({
      success: true,
      data: {
        suggestions: aiService.getFallbackTaskSuggestions(),
        generatedAt: new Date(),
        fallback: true
      }
    });
  }
}));

// @route   GET /api/tasks/stats
// @desc    Get user task statistics
// @access  Private
router.get('/stats', asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  
  const stats = await Task.getTaskStats(req.user._id, parseInt(days));
  
  // Get additional analytics
  const categoryStats = await Task.aggregate([
    {
      $match: {
        owner: req.user._id,
        isActive: true,
        createdAt: { $gte: moment().subtract(days, 'days').toDate() }
      }
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        avgDuration: { $avg: '$timing.actualDuration' }
      }
    }
  ]);

  const priorityStats = await Task.aggregate([
    {
      $match: {
        owner: req.user._id,
        isActive: true,
        createdAt: { $gte: moment().subtract(days, 'days').toDate() }
      }
    },
    {
      $group: {
        _id: '$priority',
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      overview: stats,
      categoryBreakdown: categoryStats,
      priorityBreakdown: priorityStats,
      period: `${days} days`
    }
  });
}));

// @route   DELETE /api/tasks/:taskId
// @desc    Delete task (soft delete)
// @access  Private
router.delete('/:taskId', [
  param('taskId').isMongoId().withMessage('Invalid task ID')
], asyncHandler(async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.taskId,
    owner: req.user._id,
    isActive: true
  });

  if (!task) {
    throw new NotFoundError('Task not found');
  }

  // Don't allow deletion of in-progress tasks
  if (task.status === 'in_progress') {
    throw new ConflictError('Cannot delete task that is in progress');
  }

  // Soft delete
  task.isActive = false;
  await task.save();

  // Clear device assignment if any
  if (task.assignedDevice) {
    await Device.findByIdAndUpdate(task.assignedDevice, {
      'currentTask.taskId': null,
      'currentTask.isActive': false
    });
  }

  logger.logTaskEvent(task._id, req.user._id, 'task_deleted');

  res.json({
    success: true,
    message: 'Task deleted successfully'
  });
}));

// @route   GET /api/tasks/device-pending/:deviceId
// @desc    Get pending tasks for specific device (with auto-registration)
// @access  Public (for device access)
router.get('/device-pending/:deviceId', [
  param('deviceId').isString().withMessage('Device ID required')
], asyncHandler(async (req, res) => {
  const { deviceId } = req.params;
  
  // Find or create device
  let device = await Device.findOne({ deviceId, isActive: true });
  
  if (!device) {
    // Extract user ID from device ID format: YYYYMMDD-UserId-6RandomSymbols
    const deviceIdParts = deviceId.split('-');
    if (deviceIdParts.length !== 3) {
      return res.status(400).json({
        success: false,
        message: 'Invalid device ID format'
      });
    }
    
    const userId = deviceIdParts[1];
    
    // Check if user exists
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found for device auto-registration'
      });
    }

    // Auto-register device
    device = new Device({
      deviceId,
      name: `Smart Lamp ${deviceId.substring(-6)}`,
      description: 'Auto-registered smart lamp device',
      owner: userId,
      deviceType: 'smart_lamp'
    });

    await device.save();

    // Add device to user's devices array
    await User.findByIdAndUpdate(
      userId,
      { $push: { devices: device._id } }
    );

    logger.info(`Auto-registered device ${deviceId} for user ${userId}`);
  }

  // Get pending tasks for this user/device
  const pendingTasks = await Task.find({
    owner: device.owner,
    status: { $in: ['pending'] },
    isActive: true
  })
  .sort({ priority: 1, createdAt: 1 })
  .limit(5); // Send max 5 tasks

  // If tasks exist, assign them to device and send
  const tasksToSend = [];
  for (const task of pendingTasks) {
    if (!task.assignedDevice) {
      await task.assignToDevice(device.deviceId);
      await device.assignTask(task._id);
    }
    
    tasksToSend.push({
      id: task._id.toString(),
      title: task.title,
      description: task.description,
      priority: task.priority,
      duration: task.timing.estimatedDuration,
      category: task.category
    });
  }

  res.json({
    success: true,
    data: {
      tasks: tasksToSend,
      deviceId,
      count: tasksToSend.length
    }
  });
}));

module.exports = router;