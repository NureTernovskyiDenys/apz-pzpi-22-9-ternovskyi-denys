const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const Device = require('../models/Device');
const Task = require('../models/Task');
const User = require('../models/User');
const mqttService = require('../services/mqttService');
const { 
  requireDeviceAccess, 
  requireAdmin, 
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
const deviceValidation = [
  body('name')
    .isLength({ min: 1, max: 50 })
    .trim()
    .withMessage('Device name is required and must be less than 50 characters'),
  body('description')
    .optional()
    .isLength({ max: 200 })
    .trim(),
  body('location.room')
    .optional()
    .isLength({ max: 50 })
    .trim(),
  body('location.building')
    .optional()
    .isLength({ max: 50 })
    .trim(),
  body('deviceType')
    .optional()
    .isIn(['smart_lamp', 'task_display', 'productivity_hub'])
];

const configurationValidation = [
  body('brightness')
    .optional()
    .isInt({ min: 0, max: 100 }),
  body('colorMode')
    .optional()
    .isIn(['priority', 'custom', 'mood']),
  body('autoMode')
    .optional()
    .isBoolean(),
  body('soundEnabled')
    .optional()
    .isBoolean(),
  body('displayTimeout')
    .optional()
    .isInt({ min: 5, max: 300 }),
  body('taskNotifications')
    .optional()
    .isBoolean()
];

// @route   GET /api/devices
// @desc    Get all user devices
// @access  Private
router.get('/', asyncHandler(async (req, res) => {
  const {
    status,
    deviceType,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build query
  const query = { 
    owner: req.user._id, 
    isActive: true 
  };

  if (status) query.status = status;
  if (deviceType) query.deviceType = deviceType;

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Execute query with pagination
  const devices = await Device.find(query)
    .populate('currentTask.taskId', 'title priority status timing.estimatedDuration')
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

  const total = await Device.countDocuments(query);

  // Add online status from MQTT service
  const devicesWithStatus = devices.map(device => {
    const deviceObj = device.toObject();
    deviceObj.isOnline = mqttService.isDeviceOnline(device.deviceId);
    return deviceObj;
  });

  res.json({
    success: true,
    data: {
      devices: devicesWithStatus,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalDevices: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    }
  });
}));

// @route   POST /api/devices
// @desc    Register new device
// @access  Private
router.post('/', deviceValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const { name, description, location, deviceType } = req.body;

  // Generate unique device ID
  const deviceId = Device.generateDeviceId(req.user._id);

  // Check if device name is unique for this user
  const existingDevice = await Device.findOne({
    owner: req.user._id,
    name,
    isActive: true
  });

  if (existingDevice) {
    throw new ConflictError('Device with this name already exists');
  }

  // Create new device
  const device = new Device({
    deviceId,
    name,
    description,
    owner: req.user._id,
    location: location || {},
    deviceType: deviceType || 'smart_lamp'
  });

  await device.save();

  // Add device to user's devices array
  await User.findByIdAndUpdate(
    req.user._id,
    { $push: { devices: device._id } }
  );

  logger.logDeviceEvent(device.deviceId, 'device_registered', {
    name,
    deviceType,
    owner: req.user._id
  });

  res.status(201).json({
    success: true,
    message: 'Device registered successfully',
    data: {
      device: device.toObject()
    }
  });
}));

// @route   GET /api/devices/:deviceId
// @desc    Get specific device details
// @access  Private
router.get('/:deviceId', requireDeviceAccess, asyncHandler(async (req, res) => {
  const device = req.device; // Set by requireDeviceAccess middleware
  
  // Populate current task details
  await device.populate('currentTask.taskId');
  
  // Add real-time status
  const deviceData = device.toObject();
  deviceData.isOnline = mqttService.isDeviceOnline(device.deviceId);
  
  // Get recent device statistics
  const stats = await Device.getDeviceStats(device.deviceId);

  res.json({
    success: true,
    data: {
      device: deviceData,
      statistics: stats
    }
  });
}));

// @route   PUT /api/devices/:deviceId
// @desc    Update device information
// @access  Private
router.put('/:deviceId', requireDeviceAccess, deviceValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const device = req.device;
  const { name, description, location, deviceType } = req.body;

  // Check if new name conflicts with existing devices
  if (name && name !== device.name) {
    const existingDevice = await Device.findOne({
      owner: req.user._id,
      name,
      isActive: true,
      _id: { $ne: device._id }
    });

    if (existingDevice) {
      throw new ConflictError('Device with this name already exists');
    }
  }

  // Update device fields
  if (name) device.name = name;
  if (description !== undefined) device.description = description;
  if (location) device.location = { ...device.location, ...location };
  if (deviceType) device.deviceType = deviceType;

  await device.save();

  logger.logDeviceEvent(device.deviceId, 'device_updated', {
    updatedFields: Object.keys(req.body),
    updatedBy: req.user._id
  });

  res.json({
    success: true,
    message: 'Device updated successfully',
    data: {
      device: device.toObject()
    }
  });
}));

// @route   PUT /api/devices/:deviceId/configuration
// @desc    Update device configuration
// @access  Private
router.put('/:deviceId/configuration', 
  requireDeviceAccess, 
  configurationValidation, 
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', formatValidationError(errors));
    }

    const device = req.device;
    const configUpdates = req.body;

    // Update configuration
    await device.updateConfiguration(configUpdates);

    // Send configuration update to device via MQTT
    try {
      await mqttService.sendCommandToDevice(device.deviceId, 'update_config', configUpdates);
    } catch (mqttError) {
      logger.warn(`Failed to send config update to device ${device.deviceId}: ${mqttError.message}`);
    }

    logger.logDeviceEvent(device.deviceId, 'configuration_updated', {
      configuration: configUpdates,
      updatedBy: req.user._id
    });

    res.json({
      success: true,
      message: 'Device configuration updated successfully',
      data: {
        configuration: device.configuration
      }
    });
  })
);

// @route   POST /api/devices/:deviceId/commands
// @desc    Send command to device
// @access  Private
router.post('/:deviceId/commands', requireDeviceAccess, [
  body('command')
    .isIn(['reset_task', 'get_status', 'restart', 'update_firmware', 'test_connection'])
    .withMessage('Invalid command'),
  body('data')
    .optional()
    .isObject()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const device = req.device;
  const { command, data } = req.body;

  // Check if device is online
  if (!mqttService.isDeviceOnline(device.deviceId)) {
    throw new ValidationError('Device is offline and cannot receive commands');
  }

  // Send command via MQTT
  try {
    await mqttService.sendCommandToDevice(device.deviceId, command, data);
    
    logger.logDeviceEvent(device.deviceId, 'command_sent', {
      command,
      data,
      sentBy: req.user._id
    });

    res.json({
      success: true,
      message: `Command '${command}' sent successfully`,
      data: {
        command,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`Failed to send command to device ${device.deviceId}:`, error);
    throw new Error('Failed to send command to device');
  }
}));

// @route   GET /api/devices/:deviceId/tasks
// @desc    Get tasks assigned to device
// @access  Private
router.get('/:deviceId/tasks', requireDeviceAccess, asyncHandler(async (req, res) => {
  const device = req.device;
  const { status, limit = 10 } = req.query;

  const query = { 
    assignedDevice: device._id,
    isActive: true
  };

  if (status) query.status = status;

  const tasks = await Task.find(query)
    .populate('owner', 'firstName lastName')
    .sort({ priority: 1, 'timing.deadline': 1 })
    .limit(parseInt(limit));

  res.json({
    success: true,
    data: {
      tasks,
      deviceId: device.deviceId,
      deviceName: device.name
    }
  });
}));

// @route   POST /api/devices/:deviceId/assign-task
// @desc    Assign task to device
// @access  Private
router.post('/:deviceId/assign-task', requireDeviceAccess, [
  body('taskId')
    .isMongoId()
    .withMessage('Valid task ID required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const device = req.device;
  const { taskId } = req.body;

  // Check if device already has an active task
  if (device.currentTask.isActive) {
    throw new ConflictError('Device already has an active task');
  }

  // Find and validate task
  const task = await Task.findOne({
    _id: taskId,
    owner: req.user._id,
    status: 'pending'
  });

  if (!task) {
    throw new NotFoundError('Task not found or not available for assignment');
  }

  // Check if device is online
  if (!mqttService.isDeviceOnline(device.deviceId)) {
    throw new ValidationError('Device is offline and cannot receive tasks');
  }

  // Assign task to device
  await task.assignToDevice(device.deviceId); // Pass deviceId string
  await device.assignTask(task._id);

  // Send task to device via MQTT
  try {
    await mqttService.sendTaskToDevice(device.deviceId, task);
    
    logger.logTaskEvent(task._id, req.user._id, 'task_assigned_to_device', {
      deviceId: device.deviceId,
      deviceName: device.name
    });

    res.json({
      success: true,
      message: 'Task assigned to device successfully',
      data: {
        task: task.toObject(),
        device: {
          deviceId: device.deviceId,
          name: device.name
        }
      }
    });
  } catch (error) {
    // Rollback assignment if MQTT fails
    await task.updateOne({ status: 'pending', assignedDevice: null });
    await device.updateOne({ 'currentTask.taskId': null, 'currentTask.isActive': false });
    
    logger.error(`Failed to send task to device ${device.deviceId}:`, error);
    throw new Error('Failed to send task to device');
  }
}));

// @route   GET /api/devices/:deviceId/logs
// @desc    Get device logs
// @access  Private
router.get('/:deviceId/logs', requireDeviceAccess, [
  query('level')
    .optional()
    .isIn(['info', 'warning', 'error']),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
], asyncHandler(async (req, res) => {
  const device = req.device;
  const { level, limit = 50 } = req.query;

  let logs = device.logs;

  // Filter by level if specified
  if (level) {
    logs = logs.filter(log => log.level === level);
  }

  // Sort by timestamp (newest first) and limit
  logs = logs
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, parseInt(limit));

  res.json({
    success: true,
    data: {
      logs,
      deviceId: device.deviceId,
      totalLogs: device.logs.length
    }
  });
}));

// @route   GET /api/devices/:deviceId/status
// @desc    Get real-time device status
// @access  Private
router.get('/:deviceId/status', requireDeviceAccess, asyncHandler(async (req, res) => {
  const device = req.device;
  
  const status = {
    deviceId: device.deviceId,
    name: device.name,
    status: device.status,
    isOnline: mqttService.isDeviceOnline(device.deviceId),
    lastSeen: device.lastSeen,
    currentTask: device.currentTask,
    configuration: device.configuration,
    connectivity: device.connectivity,
    uptime: device.lastSeen ? Date.now() - device.lastSeen.getTime() : null
  };

  res.json({
    success: true,
    data: status
  });
}));

// @route   DELETE /api/devices/:deviceId
// @desc    Deactivate device
// @access  Private
router.delete('/:deviceId', requireDeviceAccess, asyncHandler(async (req, res) => {
  const device = req.device;

  // Check if device has active tasks
  const activeTasks = await Task.countDocuments({
    assignedDevice: device._id,
    status: { $in: ['assigned', 'in_progress', 'paused'] }
  });

  if (activeTasks > 0) {
    throw new ConflictError('Cannot deactivate device with active tasks');
  }

  // Deactivate device
  device.isActive = false;
  await device.save();

  // Remove from user's devices array
  await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { devices: device._id } }
  );

  logger.logDeviceEvent(device.deviceId, 'device_deactivated', {
    deactivatedBy: req.user._id
  });

  res.json({
    success: true,
    message: 'Device deactivated successfully'
  });
}));

// @route   GET /api/devices/stats/overview
// @desc    Get devices overview statistics
// @access  Private
router.get('/stats/overview', asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const stats = await Device.aggregate([
    { $match: { owner: userId, isActive: true } },
    {
      $group: {
        _id: null,
        totalDevices: { $sum: 1 },
        onlineDevices: {
          $sum: {
            $cond: [
              { $gte: ['$lastSeen', new Date(Date.now() - 5 * 60 * 1000)] },
              1,
              0
            ]
          }
        },
        deviceTypes: { $push: '$deviceType' },
        totalTasksReceived: { $sum: '$statistics.totalTasksReceived' },
        totalTasksCompleted: { $sum: '$statistics.totalTasksCompleted' }
      }
    }
  ]);

  const overview = stats[0] || {
    totalDevices: 0,
    onlineDevices: 0,
    deviceTypes: [],
    totalTasksReceived: 0,
    totalTasksCompleted: 0
  };

  // Calculate device type distribution
  const typeDistribution = overview.deviceTypes.reduce((acc, type) => {
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  res.json({
    success: true,
    data: {
      ...overview,
      typeDistribution,
      completionRate: overview.totalTasksReceived > 0 
        ? (overview.totalTasksCompleted / overview.totalTasksReceived * 100).toFixed(1)
        : 0
    }
  });
}));

module.exports = router;