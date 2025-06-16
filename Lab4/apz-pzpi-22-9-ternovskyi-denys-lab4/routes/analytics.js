const express = require('express');
const { query, validationResult } = require('express-validator');
const moment = require('moment');

const Task = require('../models/Task');
const TaskLog = require('../models/TaskLog');
const Device = require('../models/Device');
const User = require('../models/User');
const { 
  asyncHandler, 
  ValidationError,
  formatValidationError 
} = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Validation rules
const dateRangeValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO8601 format'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO8601 format'),
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365')
];

// @route   GET /api/analytics/dashboard
// @desc    Get dashboard analytics overview
// @access  Private
router.get('/dashboard', asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const thirtyDaysAgo = moment().subtract(30, 'days').toDate();
  const sevenDaysAgo = moment().subtract(7, 'days').toDate();
  const yesterday = moment().subtract(1, 'day').startOf('day').toDate();
  const today = moment().startOf('day').toDate();

  // Get user statistics
  const user = await User.findById(userId);

  // Task completion trends
  const taskTrends = await Task.aggregate([
    {
      $match: {
        owner: userId,
        isActive: true,
        createdAt: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          status: '$status'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.date',
        created: { $sum: { $cond: [{ $ne: ['$_id.status', 'completed'] }, '$count', 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$_id.status', 'completed'] }, '$count', 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Today's tasks
  const todaysTasks = await Task.find({
    owner: userId,
    isActive: true,
    $or: [
      { 'timing.scheduledStart': { $gte: today, $lt: moment().add(1, 'day').startOf('day').toDate() } },
      { createdAt: { $gte: today } },
      { status: { $in: ['in_progress', 'assigned'] } }
    ]
  }).countDocuments();

  // Productivity score calculation
  const recentCompletedTasks = await Task.find({
    owner: userId,
    status: 'completed',
    'timing.actualEnd': { $gte: sevenDaysAgo }
  }).select('timing.estimatedDuration timing.actualDuration completion.completionRating');

  let productivityScore = 70; // Default score
  if (recentCompletedTasks.length > 0) {
    const avgEfficiency = recentCompletedTasks.reduce((acc, task) => {
      const efficiency = task.timing.estimatedDuration / (task.timing.actualDuration || task.timing.estimatedDuration);
      return acc + Math.min(efficiency, 2); // Cap at 200% efficiency
    }, 0) / recentCompletedTasks.length;

    const avgRating = recentCompletedTasks.reduce((acc, task) => {
      return acc + (task.completion.completionRating || 4);
    }, 0) / recentCompletedTasks.length;

    productivityScore = Math.round((avgEfficiency * 40) + (avgRating * 12) + 8);
  }

  // Weekly comparison
  const thisWeekCompleted = await Task.countDocuments({
    owner: userId,
    status: 'completed',
    'timing.actualEnd': { $gte: sevenDaysAgo }
  });

  const lastWeekCompleted = await Task.countDocuments({
    owner: userId,
    status: 'completed',
    'timing.actualEnd': {
      $gte: moment().subtract(14, 'days').toDate(),
      $lt: sevenDaysAgo
    }
  });

  // Device usage
  const deviceUsage = await Device.aggregate([
    {
      $match: { owner: userId, isActive: true }
    },
    {
      $group: {
        _id: null,
        totalDevices: { $sum: 1 },
        onlineDevices: {
          $sum: {
            $cond: [
              { $gte: ['$lastSeen', moment().subtract(5, 'minutes').toDate()] },
              1,
              0
            ]
          }
        },
        totalTasksHandled: { $sum: '$statistics.totalTasksCompleted' }
      }
    }
  ]);

  // Upcoming deadlines
  const upcomingDeadlines = await Task.find({
    owner: userId,
    isActive: true,
    status: { $nin: ['completed', 'cancelled'] },
    'timing.deadline': {
      $gte: new Date(),
      $lte: moment().add(7, 'days').toDate()
    }
  })
  .select('title timing.deadline priority category')
  .sort({ 'timing.deadline': 1 })
  .limit(5);

  res.json({
    success: true,
    data: {
      overview: {
        totalTasksCompleted: user.statistics.totalTasksCompleted,
        totalWorkingTime: user.statistics.totalWorkingTime,
        averageTaskDuration: user.statistics.averageTaskDuration,
        streakDays: user.statistics.streakDays,
        productivityScore,
        todaysTasks
      },
      trends: {
        taskCompletion: taskTrends,
        weeklyComparison: {
          thisWeek: thisWeekCompleted,
          lastWeek: lastWeekCompleted,
          change: lastWeekCompleted > 0 ? ((thisWeekCompleted - lastWeekCompleted) / lastWeekCompleted * 100).toFixed(1) : 0
        }
      },
      devices: deviceUsage[0] || { totalDevices: 0, onlineDevices: 0, totalTasksHandled: 0 },
      upcomingDeadlines,
      generatedAt: new Date()
    }
  });
}));

// @route   GET /api/analytics/productivity
// @desc    Get detailed productivity analysis
// @access  Private
router.get('/productivity', dateRangeValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const userId = req.user._id;
  const { days = 30 } = req.query;
  
  let { startDate, endDate } = req.query;
  
  if (!startDate) startDate = moment().subtract(days, 'days').toDate();
  if (!endDate) endDate = new Date();

  // Get productivity insights from TaskLog
  const insights = await TaskLog.getProductivityInsights(userId, days);

  // Task completion by time of day
  const hourlyCompletion = await TaskLog.aggregate([
    {
      $match: {
        user: userId,
        action: 'completed',
        timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) }
      }
    },
    {
      $group: {
        _id: { $hour: '$timestamp' },
        count: { $sum: 1 },
        avgEfficiency: { $avg: '$performance.taskEfficiency' },
        avgFocus: { $avg: '$performance.focusLevel' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Focus time analysis
  const focusSessions = await TaskLog.aggregate([
    {
      $match: {
        user: userId,
        action: { $in: ['started', 'completed'] },
        timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) }
      }
    },
    {
      $group: {
        _id: '$task',
        events: { $push: { action: '$action', timestamp: '$timestamp' } }
      }
    },
    {
      $project: {
        focusTime: {
          $reduce: {
            input: '$events',
            initialValue: { total: 0, lastStart: null },
            in: {
              $cond: [
                { $eq: ['$$this.action', 'started'] },
                { total: '$$value.total', lastStart: '$$this.timestamp' },
                {
                  $cond: [
                    { $ne: ['$$value.lastStart', null] },
                    {
                      total: {
                        $add: [
                          '$$value.total',
                          { $subtract: ['$$this.timestamp', '$$value.lastStart'] }
                        ]
                      },
                      lastStart: null
                    },
                    '$$value'
                  ]
                }
              ]
            }
          }
        }
      }
    },
    {
      $group: {
        _id: null,
        totalFocusTime: { $sum: '$focusTime.total' },
        avgSessionLength: { $avg: '$focusTime.total' },
        sessionCount: { $sum: 1 }
      }
    }
  ]);

  // Category performance
  const categoryPerformance = await Task.aggregate([
    {
      $match: {
        owner: userId,
        isActive: true,
        status: 'completed',
        'timing.actualEnd': { $gte: new Date(startDate), $lte: new Date(endDate) }
      }
    },
    {
      $group: {
        _id: '$category',
        totalTasks: { $sum: 1 },
        avgDuration: { $avg: '$timing.actualDuration' },
        avgRating: { $avg: '$completion.completionRating' },
        totalTime: { $sum: '$timing.actualDuration' },
        efficiency: {
          $avg: {
            $divide: ['$timing.estimatedDuration', '$timing.actualDuration']
          }
        }
      }
    },
    { $sort: { totalTasks: -1 } }
  ]);

  // Streak analysis
  const taskCompletionDates = await Task.aggregate([
    {
      $match: {
        owner: userId,
        status: 'completed',
        'timing.actualEnd': { $gte: moment().subtract(60, 'days').toDate() }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timing.actualEnd' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: -1 } }
  ]);

  // Calculate current streak
  let currentStreak = 0;
  const today = moment().format('YYYY-MM-DD');
  const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');
  
  for (let i = 0; i < taskCompletionDates.length; i++) {
    const date = taskCompletionDates[i]._id;
    const expectedDate = moment().subtract(i, 'days').format('YYYY-MM-DD');
    
    if (date === expectedDate || (i === 0 && date === yesterday && today !== date)) {
      currentStreak++;
    } else {
      break;
    }
  }

  res.json({
    success: true,
    data: {
      timeRange: { startDate, endDate, days: parseInt(days) },
      insights,
      hourlyProductivity: hourlyCompletion,
      focusAnalysis: focusSessions[0] || { totalFocusTime: 0, avgSessionLength: 0, sessionCount: 0 },
      categoryPerformance,
      streakAnalysis: {
        currentStreak,
        completionDates: taskCompletionDates.slice(0, 30) // Last 30 days
      },
      recommendations: await generateProductivityRecommendations(userId, insights, categoryPerformance)
    }
  });
}));

// @route   GET /api/analytics/heatmap
// @desc    Get productivity heatmap data
// @access  Private
router.get('/heatmap', dateRangeValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const userId = req.user._id;
  const { days = 30 } = req.query;

  const heatmapData = await TaskLog.getHeatmapData(userId, days);

  // Transform data for frontend consumption
  const heatmapMatrix = {};
  
  heatmapData.forEach(item => {
    const { date, hour } = item._id;
    if (!heatmapMatrix[date]) {
      heatmapMatrix[date] = {};
    }
    heatmapMatrix[date][hour] = {
      count: item.count,
      efficiency: item.avgEfficiency || 0
    };
  });

  // Fill missing hours with 0 values
  Object.keys(heatmapMatrix).forEach(date => {
    for (let hour = 0; hour < 24; hour++) {
      if (!heatmapMatrix[date][hour]) {
        heatmapMatrix[date][hour] = { count: 0, efficiency: 0 };
      }
    }
  });

  res.json({
    success: true,
    data: {
      heatmap: heatmapMatrix,
      period: `${days} days`,
      generatedAt: new Date()
    }
  });
}));

// @route   GET /api/analytics/device-usage
// @desc    Get device usage analytics
// @access  Private
router.get('/device-usage', dateRangeValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const userId = req.user._id;
  const { days = 30 } = req.query;

  // Get user devices
  const userDevices = await Device.find({
    owner: userId,
    isActive: true
  }).select('deviceId name statistics');

  const deviceUsageData = await Promise.all(
    userDevices.map(async (device) => {
      const usage = await TaskLog.getDeviceUsage(device._id, days);
      
      return {
        deviceId: device.deviceId,
        name: device.name,
        statistics: device.statistics,
        hourlyUsage: usage,
        isOnline: require('../services/mqttService').isDeviceOnline(device.deviceId)
      };
    })
  );

  // Overall device statistics
  const deviceStats = await Device.aggregate([
    {
      $match: { owner: userId, isActive: true }
    },
    {
      $group: {
        _id: '$deviceType',
        count: { $sum: 1 },
        totalTasks: { $sum: '$statistics.totalTasksCompleted' },
        avgUptime: { $avg: '$statistics.totalUptime' }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      devices: deviceUsageData,
      overview: deviceStats,
      period: `${days} days`
    }
  });
}));

// @route   GET /api/analytics/goals-progress
// @desc    Get goals and progress tracking
// @access  Private
router.get('/goals-progress', asyncHandler(async (req, res) => {
  const userId = req.user._id;
  
  const thisWeek = moment().startOf('week').toDate();
  const thisMonth = moment().startOf('month').toDate();
  const today = moment().startOf('day').toDate();

  // Daily goals progress
  const dailyProgress = await Task.aggregate([
    {
      $match: {
        owner: userId,
        status: 'completed',
        'timing.actualEnd': { $gte: today }
      }
    },
    {
      $group: {
        _id: null,
        completedToday: { $sum: 1 },
        totalTimeToday: { $sum: '$timing.actualDuration' }
      }
    }
  ]);

  // Weekly goals progress
  const weeklyProgress = await Task.aggregate([
    {
      $match: {
        owner: userId,
        status: 'completed',
        'timing.actualEnd': { $gte: thisWeek }
      }
    },
    {
      $group: {
        _id: null,
        completedThisWeek: { $sum: 1 },
        totalTimeThisWeek: { $sum: '$timing.actualDuration' }
      }
    }
  ]);

  // Monthly goals progress
  const monthlyProgress = await Task.aggregate([
    {
      $match: {
        owner: userId,
        status: 'completed',
        'timing.actualEnd': { $gte: thisMonth }
      }
    },
    {
      $group: {
        _id: null,
        completedThisMonth: { $sum: 1 },
        totalTimeThisMonth: { $sum: '$timing.actualDuration' }
      }
    }
  ]);

  // Goal targets (these could be user-defined in the future)
  const goals = {
    daily: { tasks: 5, time: 240 }, // 4 hours
    weekly: { tasks: 25, time: 1200 }, // 20 hours
    monthly: { tasks: 100, time: 4800 } // 80 hours
  };

  const progress = {
    daily: dailyProgress[0] || { completedToday: 0, totalTimeToday: 0 },
    weekly: weeklyProgress[0] || { completedThisWeek: 0, totalTimeThisWeek: 0 },
    monthly: monthlyProgress[0] || { completedThisMonth: 0, totalTimeThisMonth: 0 }
  };

  // Calculate completion percentages
  const progressPercentages = {
    daily: {
      tasks: Math.min((progress.daily.completedToday / goals.daily.tasks) * 100, 100),
      time: Math.min((progress.daily.totalTimeToday / goals.daily.time) * 100, 100)
    },
    weekly: {
      tasks: Math.min((progress.weekly.completedThisWeek / goals.weekly.tasks) * 100, 100),
      time: Math.min((progress.weekly.totalTimeThisWeek / goals.weekly.time) * 100, 100)
    },
    monthly: {
      tasks: Math.min((progress.monthly.completedThisMonth / goals.monthly.tasks) * 100, 100),
      time: Math.min((progress.monthly.totalTimeThisMonth / goals.monthly.time) * 100, 100)
    }
  };

  res.json({
    success: true,
    data: {
      goals,
      progress,
      progressPercentages,
      achievements: await checkAchievements(userId, progress, goals)
    }
  });
}));

// @route   GET /api/analytics/export
// @desc    Export analytics data
// @access  Private
router.get('/export', dateRangeValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const userId = req.user._id;
  const { format = 'json', days = 30 } = req.query;
  
  let { startDate, endDate } = req.query;
  
  if (!startDate) startDate = moment().subtract(days, 'days').toDate();
  if (!endDate) endDate = new Date();

  // Get comprehensive data
  const tasks = await Task.find({
    owner: userId,
    isActive: true,
    createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
  }).populate('assignedDevice', 'name deviceId');

  const taskLogs = await TaskLog.find({
    user: userId,
    timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) }
  }).populate('task', 'title category').populate('device', 'name deviceId');

  const devices = await Device.find({
    owner: userId,
    isActive: true
  });

  const exportData = {
    user: req.user.getPublicProfile(),
    period: { startDate, endDate },
    tasks: tasks.map(task => task.toObject()),
    taskLogs: taskLogs.map(log => log.toObject()),
    devices: devices.map(device => device.toObject()),
    exportedAt: new Date()
  };

  if (format === 'csv') {
    // Convert to CSV format (simplified)
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-${moment().format('YYYY-MM-DD')}.csv"`);
    
    // Simple CSV export for tasks
    let csv = 'Title,Category,Priority,Status,Created,Estimated Duration,Actual Duration,Completion Rating\n';
    tasks.forEach(task => {
      csv += `"${task.title}","${task.category}",${task.priority},"${task.status}","${task.createdAt}",${task.timing.estimatedDuration},${task.timing.actualDuration || 0},${task.completion.completionRating || ''}\n`;
    });
    
    res.send(csv);
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-${moment().format('YYYY-MM-DD')}.json"`);
    res.json(exportData);
  }

  logger.logUserAction(userId, 'analytics_exported', { format, period: { startDate, endDate } });
}));

// Helper function to generate productivity recommendations
async function generateProductivityRecommendations(userId, insights, categoryPerformance) {
  const recommendations = [];

  // Analyze peak productivity times
  const peakHours = insights
    .sort((a, b) => (b.avgEfficiency || 0) - (a.avgEfficiency || 0))
    .slice(0, 3);

  if (peakHours.length > 0) {
    const bestTime = peakHours[0]._id.timeOfDay;
    recommendations.push({
      type: 'schedule',
      priority: 'high',
      message: `Your peak productivity is during ${bestTime}. Schedule important tasks during this time.`,
      action: 'schedule_optimization'
    });
  }

  // Analyze category performance
  if (categoryPerformance.length > 0) {
    const worstCategory = categoryPerformance
      .sort((a, b) => (a.efficiency || 0) - (b.efficiency || 0))[0];
    
    if (worstCategory.efficiency < 0.8) {
      recommendations.push({
        type: 'category',
        priority: 'medium',
        message: `Consider breaking down ${worstCategory._id} tasks into smaller chunks to improve efficiency.`,
        action: 'task_breakdown'
      });
    }
  }

  // Check for consistency
  const inconsistentDays = insights.filter(day => 
    day.completionRate < 0.5 && day.startedTasks > 0
  );

  if (inconsistentDays.length > insights.length * 0.3) {
    recommendations.push({
      type: 'consistency',
      priority: 'medium',
      message: 'Focus on completing started tasks before beginning new ones.',
      action: 'completion_focus'
    });
  }

  return recommendations;
}

// Helper function to check achievements
async function checkAchievements(userId, progress, goals) {
  const achievements = [];

  // Daily achievements
  if (progress.daily.completedToday >= goals.daily.tasks) {
    achievements.push({
      type: 'daily_tasks',
      message: 'Daily task goal achieved!',
      earnedAt: new Date()
    });
  }

  if (progress.daily.totalTimeToday >= goals.daily.time) {
    achievements.push({
      type: 'daily_time',
      message: 'Daily time goal achieved!',
      earnedAt: new Date()
    });
  }

  // Weekly achievements
  if (progress.weekly.completedThisWeek >= goals.weekly.tasks) {
    achievements.push({
      type: 'weekly_tasks',
      message: 'Weekly task goal achieved!',
      earnedAt: new Date()
    });
  }

  return achievements;
}

module.exports = router;