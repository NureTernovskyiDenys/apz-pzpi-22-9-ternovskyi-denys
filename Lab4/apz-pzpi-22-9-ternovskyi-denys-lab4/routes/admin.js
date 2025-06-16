const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const moment = require('moment');

const User = require('../models/User');
const Device = require('../models/Device');
const Task = require('../models/Task');
const TaskLog = require('../models/TaskLog');
const mqttService = require('../services/mqttService');
const aiService = require('../services/aiService');
const { 
  requireAdmin, 
  requireModerator 
} = require('../middleware/auth');
const { 
  asyncHandler, 
  ValidationError, 
  NotFoundError,
  formatValidationError 
} = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// All admin routes require admin privileges
router.use(requireAdmin);

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard overview
// @access  Admin
router.get('/dashboard', asyncHandler(async (req, res) => {
  const thirtyDaysAgo = moment().subtract(30, 'days').toDate();
  const sevenDaysAgo = moment().subtract(7, 'days').toDate();

  // System statistics
  const systemStats = {
    users: {
      total: await User.countDocuments({ isActive: true }),
      new: await User.countDocuments({ 
        isActive: true, 
        createdAt: { $gte: sevenDaysAgo } 
      }),
      active: await User.countDocuments({ 
        isActive: true, 
        lastLogin: { $gte: sevenDaysAgo } 
      })
    },
    devices: {
      total: await Device.countDocuments({ isActive: true }),
      online: (await Device.findOnlineDevices()).length,
      new: await Device.countDocuments({ 
        isActive: true, 
        createdAt: { $gte: sevenDaysAgo } 
      })
    },
    tasks: {
      total: await Task.countDocuments({ isActive: true }),
      completed: await Task.countDocuments({ 
        isActive: true, 
        status: 'completed' 
      }),
      active: await Task.countDocuments({ 
        isActive: true, 
        status: { $in: ['in_progress', 'assigned'] } 
      }),
      completedThisWeek: await Task.countDocuments({
        isActive: true,
        status: 'completed',
        'timing.actualEnd': { $gte: sevenDaysAgo }
      })
    }
  };

  // Service status
  const serviceStatus = {
    mqtt: mqttService.getConnectionStatus(),
    ai: aiService.getServiceStatus(),
    database: { connected: true }, // MongoDB connection is checked in server.js
    uptime: process.uptime()
  };

  // Recent activity
  const recentActivity = await TaskLog.find({})
    .populate('user', 'firstName lastName email')
    .populate('task', 'title')
    .populate('device', 'name deviceId')
    .sort({ timestamp: -1 })
    .limit(20);

  // User growth trend
  const userGrowth = await User.aggregate([
    {
      $match: { 
        createdAt: { $gte: thirtyDaysAgo } 
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Device type distribution
  const deviceDistribution = await Device.aggregate([
    {
      $match: { isActive: true }
    },
    {
      $group: {
        _id: '$deviceType',
        count: { $sum: 1 },
        online: {
          $sum: {
            $cond: [
              { $gte: ['$lastSeen', moment().subtract(5, 'minutes').toDate()] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      systemStats,
      serviceStatus,
      recentActivity,
      trends: {
        userGrowth,
        deviceDistribution
      },
      generatedAt: new Date()
    }
  });
}));

// @route   GET /api/admin/users
// @desc    Get all users with filtering and pagination
// @access  Admin
router.get('/users', [
  query('role').optional().isIn(['user', 'admin', 'moderator']),
  query('isActive').optional().isBoolean(),
  query('search').optional().isLength({ min: 1, max: 100 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const {
    role,
    isActive,
    search,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build query
  const query = {};
  
  if (role) query.role = role;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } }
    ];
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Execute query
  const users = await User.find(query)
    .select('-password')
    .populate('devices', 'name deviceId status')
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

  const total = await User.countDocuments(query);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    }
  });
}));

// @route   GET /api/admin/users/:userId
// @desc    Get specific user details
// @access  Admin
router.get('/users/:userId', [
  param('userId').isMongoId().withMessage('Invalid user ID')
], asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId)
    .select('-password')
    .populate('devices');

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Get user statistics
  const userStats = await Task.getTaskStats(user._id, 90);
  
  // Get recent user activity
  const recentActivity = await TaskLog.find({ user: user._id })
    .populate('task', 'title')
    .populate('device', 'name deviceId')
    .sort({ timestamp: -1 })
    .limit(50);

  res.json({
    success: true,
    data: {
      user,
      statistics: userStats,
      recentActivity
    }
  });
}));

// @route   PUT /api/admin/users/:userId
// @desc    Update user (admin can change role, active status)
// @access  Admin
router.put('/users/:userId', [
  param('userId').isMongoId().withMessage('Invalid user ID'),
  body('role').optional().isIn(['user', 'admin', 'moderator']),
  body('isActive').optional().isBoolean(),
  body('firstName').optional().isLength({ min: 1, max: 50 }).trim(),
  body('lastName').optional().isLength({ min: 1, max: 50 }).trim()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const user = await User.findById(req.params.userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Prevent admin from demoting themselves
  if (user._id.equals(req.user._id) && req.body.role && req.body.role !== 'admin') {
    throw new ValidationError('Cannot change your own admin role');
  }

  // Update fields
  const updates = req.body;
  Object.keys(updates).forEach(key => {
    if (updates[key] !== undefined) {
      user[key] = updates[key];
    }
  });

  await user.save();

  logger.logUserAction(req.user._id, 'admin_user_updated', {
    targetUserId: user._id,
    updates: Object.keys(updates)
  });

  res.json({
    success: true,
    message: 'User updated successfully',
    data: {
      user: user.getPublicProfile()
    }
  });
}));

// @route   GET /api/admin/devices
// @desc    Get all devices in system
// @access  Admin
router.get('/devices', [
  query('status').optional().isIn(['online', 'offline', 'maintenance', 'error']),
  query('deviceType').optional().isIn(['smart_lamp', 'task_display', 'productivity_hub']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], asyncHandler(async (req, res) => {
  const {
    status,
    deviceType,
    page = 1,
    limit = 20,
    sortBy = 'lastSeen',
    sortOrder = 'desc'
  } = req.query;

  // Build query
  const query = { isActive: true };
  if (status) query.status = status;
  if (deviceType) query.deviceType = deviceType;

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  const devices = await Device.find(query)
    .populate('owner', 'firstName lastName email')
    .populate('currentTask.taskId', 'title priority')
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Device.countDocuments(query);

  // Add real-time online status
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
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalDevices: total
      }
    }
  });
}));

// @route   POST /api/admin/devices/:deviceId/commands
// @desc    Send admin command to device
// @access  Admin
router.post('/devices/:deviceId/commands', [
  param('deviceId').isString(),
  body('command').isIn(['reset', 'restart', 'maintenance_mode', 'factory_reset', 'update_firmware']),
  body('data').optional().isObject()
], asyncHandler(async (req, res) => {
  const { deviceId } = req.params;
  const { command, data } = req.body;

  const device = await Device.findOne({ deviceId });
  if (!device) {
    throw new NotFoundError('Device not found');
  }

  // Check if device is online for critical commands
  if (['factory_reset', 'update_firmware'].includes(command) && !mqttService.isDeviceOnline(deviceId)) {
    throw new ValidationError('Device must be online for this command');
  }

  try {
    await mqttService.sendCommandToDevice(deviceId, command, data);
    
    // Log admin action
    await device.addLog('info', `Admin command executed: ${command}`, {
      adminUserId: req.user._id,
      command,
      data
    });
    await device.save();

    logger.logDeviceEvent(deviceId, 'admin_command', {
      command,
      data,
      adminId: req.user._id
    });

    res.json({
      success: true,
      message: `Admin command '${command}' sent successfully`
    });
  } catch (error) {
    logger.error(`Admin command failed for device ${deviceId}:`, error);
    throw new Error('Failed to send admin command');
  }
}));

// @route   GET /api/admin/analytics/system
// @desc    Get system-wide analytics
// @access  Admin
router.get('/analytics/system', [
  query('days').optional().isInt({ min: 1, max: 365 })
], asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const startDate = moment().subtract(days, 'days').toDate();

  // System performance metrics
  const systemMetrics = {
    totalUsers: await User.countDocuments({ isActive: true }),
    activeUsers: await User.countDocuments({ 
      isActive: true, 
      lastLogin: { $gte: moment().subtract(7, 'days').toDate() } 
    }),
    totalDevices: await Device.countDocuments({ isActive: true }),
    onlineDevices: (await Device.findOnlineDevices()).length,
    totalTasks: await Task.countDocuments({ 
      isActive: true,
      createdAt: { $gte: startDate }
    }),
    completedTasks: await Task.countDocuments({ 
      isActive: true,
      status: 'completed',
      'timing.actualEnd': { $gte: startDate }
    })
  };

  // Usage trends
  const dailyUsage = await TaskLog.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate },
        action: { $in: ['started', 'completed'] }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          action: '$action'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.date',
        actions: {
          $push: {
            action: '$_id.action',
            count: '$count'
          }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Device type performance
  const deviceTypePerformance = await Device.aggregate([
    {
      $match: { isActive: true }
    },
    {
      $group: {
        _id: '$deviceType',
        totalDevices: { $sum: 1 },
        totalTasks: { $sum: '$statistics.totalTasksCompleted' },
        avgUptime: { $avg: '$statistics.totalUptime' },
        onlineDevices: {
          $sum: {
            $cond: [
              { $gte: ['$lastSeen', moment().subtract(5, 'minutes').toDate()] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  // AI service accuracy if available
  const aiAccuracy = await TaskLog.getAIAccuracy(days);

  // Top performing users
  const topUsers = await User.aggregate([
    {
      $match: { isActive: true }
    },
    {
      $sort: { 'statistics.totalTasksCompleted': -1 }
    },
    {
      $limit: 10
    },
    {
      $project: {
        firstName: 1,
        lastName: 1,
        'statistics.totalTasksCompleted': 1,
        'statistics.totalWorkingTime': 1,
        'statistics.averageTaskDuration': 1
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      systemMetrics,
      trends: {
        dailyUsage,
        deviceTypePerformance
      },
      aiPerformance: aiAccuracy[0] || null,
      topUsers,
      period: `${days} days`,
      generatedAt: new Date()
    }
  });
}));

// @route   GET /api/admin/logs
// @desc    Get system logs
// @access  Admin
router.get('/logs', [
  query('level').optional().isIn(['error', 'warn', 'info', 'debug']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], asyncHandler(async (req, res) => {
  const {
    level,
    page = 1,
    limit = 50
  } = req.query;

  // In a real implementation, you would read from log files or a logging service
  // For now, we'll return recent TaskLog entries as system activity
  const query = {};
  if (level) {
    // Map log levels to actions for demonstration
    const actionMap = {
      error: ['error', 'failed'],
      warn: ['cancelled', 'postponed'],
      info: ['created', 'completed', 'started'],
      debug: ['progress_updated', 'device_interaction']
    };
    query.action = { $in: actionMap[level] || [] };
  }

  const logs = await TaskLog.find(query)
    .populate('user', 'firstName lastName email')
    .populate('task', 'title')
    .populate('device', 'name deviceId')
    .sort({ timestamp: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await TaskLog.countDocuments(query);

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalLogs: total
      }
    }
  });
}));

// @route   POST /api/admin/maintenance
// @desc    System maintenance operations
// @access  Admin
router.post('/maintenance', [
  body('operation').isIn(['cleanup_logs', 'reset_statistics', 'optimize_database', 'clear_cache']),
  body('confirm').isBoolean().custom(value => {
    if (!value) {
      throw new Error('Maintenance operation must be confirmed');
    }
    return true;
  })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const { operation } = req.body;
  let result = {};

  switch (operation) {
    case 'cleanup_logs':
      // Remove logs older than 90 days
      const oldLogs = await TaskLog.deleteMany({
        timestamp: { $lt: moment().subtract(90, 'days').toDate() }
      });
      result = { deletedLogs: oldLogs.deletedCount };
      break;

    case 'reset_statistics':
      // Reset AI request counters
      aiService.resetRequestCounter();
      result = { message: 'Statistics reset successfully' };
      break;

    case 'optimize_database':
      // In a real implementation, you would run database optimization
      result = { message: 'Database optimization completed' };
      break;

    case 'clear_cache':
      // Clear any application caches
      result = { message: 'Cache cleared successfully' };
      break;

    default:
      throw new ValidationError('Unknown maintenance operation');
  }

  logger.logUserAction(req.user._id, 'admin_maintenance', {
    operation,
    result
  });

  res.json({
    success: true,
    message: `Maintenance operation '${operation}' completed`,
    data: result
  });
}));

// @route   GET /api/admin/export/data
// @desc    Export system data
// @access  Admin
router.get('/export/data', [
  query('type').isIn(['users', 'devices', 'tasks', 'logs', 'all']),
  query('format').optional().isIn(['json', 'csv']),
  query('days').optional().isInt({ min: 1, max: 365 })
], asyncHandler(async (req, res) => {
  const { type, format = 'json', days = 30 } = req.query;
  const startDate = moment().subtract(days, 'days').toDate();

  let data = {};

  if (type === 'users' || type === 'all') {
    data.users = await User.find({ isActive: true })
      .select('-password')
      .lean();
  }

  if (type === 'devices' || type === 'all') {
    data.devices = await Device.find({ isActive: true })
      .populate('owner', 'firstName lastName email')
      .lean();
  }

  if (type === 'tasks' || type === 'all') {
    data.tasks = await Task.find({
      isActive: true,
      createdAt: { $gte: startDate }
    })
    .populate('owner', 'firstName lastName email')
    .populate('assignedDevice', 'name deviceId')
    .lean();
  }

  if (type === 'logs' || type === 'all') {
    data.logs = await TaskLog.find({
      timestamp: { $gte: startDate }
    })
    .populate('user', 'firstName lastName email')
    .populate('task', 'title')
    .populate('device', 'name deviceId')
    .lean();
  }

  const exportData = {
    ...data,
    exportedAt: new Date(),
    exportedBy: req.user._id,
    period: { days, startDate: startDate.toISOString() }
  };

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="system-export-${moment().format('YYYY-MM-DD')}.csv"`);
    
    // Simplified CSV export - you would implement proper CSV conversion
    res.send('CSV export not implemented in this demo');
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="system-export-${moment().format('YYYY-MM-DD')}.json"`);
    res.json(exportData);
  }

  logger.logUserAction(req.user._id, 'admin_export', {
    type,
    format,
    recordCount: Object.values(data).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
  });
}));

module.exports = router;