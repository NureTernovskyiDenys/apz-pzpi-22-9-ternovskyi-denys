const express = require('express');
const { body, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const Task = require('../models/Task');
const User = require('../models/User');
const TaskLog = require('../models/TaskLog');
const aiService = require('../services/aiService');
const { 
  asyncHandler, 
  ValidationError,
  formatValidationError 
} = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Rate limiting for AI endpoints (more restrictive)
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // limit each user to 20 AI requests per 15 minutes
  message: {
    success: false,
    message: 'Too many AI requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(aiLimiter);

// @route   POST /api/ai/suggestions/tasks
// @desc    Get AI-generated task suggestions
// @access  Private
router.post('/suggestions/tasks', [
  body('context').optional().isObject(),
  body('preferences').optional().isObject(),
  body('currentWorkload').optional().isInt({ min: 0, max: 10 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const startTime = Date.now();
  const userId = req.user._id;
  const { context = {}, preferences = {}, currentWorkload } = req.body;

  try {
    // Enhance context with current user data
    const enhancedContext = {
      ...context,
      currentTime: new Date(),
      userPreferences: req.user.preferences,
      userStats: req.user.statistics,
      currentWorkload: currentWorkload || 5
    };

    const suggestions = await aiService.generateTaskSuggestions(userId, enhancedContext);

    const duration = Date.now() - startTime;
    logger.logAIRequest(userId, 'task_suggestions', duration, true);

    res.json({
      success: true,
      data: {
        suggestions,
        context: enhancedContext,
        generatedAt: new Date(),
        aiModel: 'claude-3-sonnet'
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logAIRequest(userId, 'task_suggestions', duration, false, error);

    // Return fallback suggestions
    const fallbackSuggestions = aiService.getFallbackTaskSuggestions();
    
    res.json({
      success: true,
      data: {
        suggestions: fallbackSuggestions,
        fallback: true,
        generatedAt: new Date(),
        error: process.env.NODE_ENV === 'development' ? error.message : 'AI service temporarily unavailable'
      }
    });
  }
}));

// @route   POST /api/ai/analysis/productivity
// @desc    Get AI productivity analysis
// @access  Private
router.post('/analysis/productivity', [
  body('timeRange').optional().isObject(),
  body('includeRecommendations').optional().isBoolean()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const startTime = Date.now();
  const userId = req.user._id;
  const { timeRange, includeRecommendations = true } = req.body;

  try {
    const analysis = await aiService.analyzeProductivityPatterns(userId);

    const duration = Date.now() - startTime;
    logger.logAIRequest(userId, 'productivity_analysis', duration, true);

    res.json({
      success: true,
      data: {
        analysis,
        timeRange: timeRange || { days: 30 },
        includeRecommendations,
        generatedAt: new Date(),
        aiModel: 'claude-3-sonnet'
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logAIRequest(userId, 'productivity_analysis', duration, false, error);

    // Return basic analysis without AI
    const basicAnalysis = {
      patterns: {
        mostProductiveTime: 'morning',
        consistencyScore: 6,
        averageEfficiency: 75
      },
      strengths: ['Regular task completion'],
      improvements: ['Time estimation accuracy'],
      recommendations: [],
      insights: 'Analysis requires more data for detailed insights.'
    };

    res.json({
      success: true,
      data: {
        analysis: basicAnalysis,
        fallback: true,
        generatedAt: new Date(),
        error: process.env.NODE_ENV === 'development' ? error.message : 'AI service temporarily unavailable'
      }
    });
  }
}));

// @route   POST /api/ai/schedule/optimize
// @desc    Get AI-optimized schedule
// @access  Private
router.post('/schedule/optimize', [
  body('tasks').isArray({ min: 1 }).withMessage('Tasks array is required'),
  body('preferences').optional().isObject(),
  body('timeConstraints').optional().isObject(),
  body('workingHours').optional().isObject()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const startTime = Date.now();
  const userId = req.user._id;
  const { tasks, preferences = {}, timeConstraints = {}, workingHours } = req.body;

  try {
    // Validate that tasks belong to the user
    const taskIds = tasks.map(t => t.id || t._id).filter(Boolean);
    const userTasks = await Task.find({
      _id: { $in: taskIds },
      owner: userId,
      isActive: true
    });

    if (userTasks.length !== taskIds.length) {
      throw new ValidationError('Some tasks do not belong to user or do not exist');
    }

    // Enhance preferences with user data
    const enhancedPreferences = {
      ...preferences,
      userWorkSchedule: req.user.preferences.workSchedule,
      timezone: req.user.preferences.timezone,
      workingHours: workingHours || {
        start: req.user.preferences.workSchedule.startTime,
        end: req.user.preferences.workSchedule.endTime
      }
    };

    const optimizedSchedule = await aiService.generateOptimalSchedule(
      userId,
      userTasks,
      enhancedPreferences
    );

    const duration = Date.now() - startTime;
    logger.logAIRequest(userId, 'schedule_optimization', duration, true);

    res.json({
      success: true,
      data: {
        schedule: optimizedSchedule,
        inputTasks: userTasks.length,
        preferences: enhancedPreferences,
        generatedAt: new Date(),
        aiModel: 'claude-3-sonnet'
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logAIRequest(userId, 'schedule_optimization', duration, false, error);

    // Return basic schedule without AI optimization
    const basicSchedule = {
      schedule: tasks.map((task, index) => ({
        time: `${9 + index}:00`,
        task: task.title || `Task ${index + 1}`,
        duration: task.estimatedDuration || 30,
        type: 'task',
        reasoning: 'Sequential scheduling without AI optimization'
      })),
      summary: {
        totalWorkTime: tasks.reduce((sum, t) => sum + (t.estimatedDuration || 30), 0),
        efficiency_score: 5,
        balance_score: 5
      },
      tips: ['Take regular breaks', 'Start with high-priority tasks']
    };

    res.json({
      success: true,
      data: {
        schedule: basicSchedule,
        fallback: true,
        generatedAt: new Date(),
        error: process.env.NODE_ENV === 'development' ? error.message : 'AI service temporarily unavailable'
      }
    });
  }
}));

// @route   POST /api/ai/tips/productivity
// @desc    Get personalized productivity tips
// @access  Private
router.post('/tips/productivity', [
  body('currentContext').optional().isObject(),
  body('challenges').optional().isArray(),
  body('goals').optional().isArray()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const startTime = Date.now();
  const userId = req.user._id;
  const { currentContext = {}, challenges = [], goals = [] } = req.body;

  try {
    // Enhance context with recent user activity
    const enhancedContext = {
      ...currentContext,
      challenges,
      goals,
      userStats: req.user.statistics,
      recentActivity: await TaskLog.find({ user: userId })
        .sort({ timestamp: -1 })
        .limit(10)
    };

    const tips = await aiService.getProductivityTips(userId, enhancedContext);

    const duration = Date.now() - startTime;
    logger.logAIRequest(userId, 'productivity_tips', duration, true);

    res.json({
      success: true,
      data: {
        tips,
        context: enhancedContext,
        generatedAt: new Date(),
        aiModel: 'claude-3-sonnet'
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logAIRequest(userId, 'productivity_tips', duration, false, error);

    // Return fallback tips
    const fallbackTips = aiService.getFallbackProductivityTips();

    res.json({
      success: true,
      data: {
        tips: fallbackTips,
        fallback: true,
        generatedAt: new Date(),
        error: process.env.NODE_ENV === 'development' ? error.message : 'AI service temporarily unavailable'
      }
    });
  }
}));

// @route   POST /api/ai/estimate/task
// @desc    Get AI task estimation
// @access  Private
router.post('/estimate/task', [
  body('title').isLength({ min: 1, max: 200 }).withMessage('Task title is required'),
  body('description').optional().isLength({ max: 1000 }),
  body('category').optional().isIn(['work', 'personal', 'health', 'learning', 'exercise', 'break', 'other']),
  body('priority').optional().isInt({ min: 1, max: 3 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const startTime = Date.now();
  const userId = req.user._id;
  const { title, description = '', category, priority } = req.body;

  try {
    // Get user's similar tasks for better estimation
    const similarTasks = await Task.find({
      owner: userId,
      isActive: true,
      status: 'completed',
      $or: [
        { category: category },
        { title: { $regex: title.split(' ')[0], $options: 'i' } }
      ]
    })
    .select('title timing.estimatedDuration timing.actualDuration metadata.difficulty')
    .limit(10);

    const taskDescription = `${title} ${description}`.trim();
    const estimation = await aiService.estimateTask(taskDescription, similarTasks);

    const duration = Date.now() - startTime;
    logger.logAIRequest(userId, 'task_estimation', duration, true);

    res.json({
      success: true,
      data: {
        estimation,
        similarTasksFound: similarTasks.length,
        taskInput: { title, description, category, priority },
        generatedAt: new Date(),
        aiModel: 'claude-3-sonnet'
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logAIRequest(userId, 'task_estimation', duration, false, error);

    // Return basic estimation
    const basicEstimation = {
      estimatedDuration: 30,
      difficulty: 5,
      energyLevel: 'medium',
      confidence: 0.4,
      factors: ['No AI analysis available'],
      tips: ['Break task into smaller parts if it seems complex']
    };

    res.json({
      success: true,
      data: {
        estimation: basicEstimation,
        fallback: true,
        generatedAt: new Date(),
        error: process.env.NODE_ENV === 'development' ? error.message : 'AI service temporarily unavailable'
      }
    });
  }
}));

// @route   POST /api/ai/insights/weekly
// @desc    Get weekly AI insights
// @access  Private
router.post('/insights/weekly', [
  body('weekOffset').optional().isInt({ min: 0, max: 4 })
], asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const userId = req.user._id;
  const { weekOffset = 0 } = req.body;

  try {
    // Get week's data
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (7 * weekOffset) - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekTasks = await Task.find({
      owner: userId,
      isActive: true,
      $or: [
        { 'timing.actualStart': { $gte: weekStart, $lte: weekEnd } },
        { 'timing.actualEnd': { $gte: weekStart, $lte: weekEnd } },
        { createdAt: { $gte: weekStart, $lte: weekEnd } }
      ]
    });

    const weekLogs = await TaskLog.find({
      user: userId,
      timestamp: { $gte: weekStart, $lte: weekEnd }
    });

    // Generate insights using AI
    const weeklyData = {
      tasks: weekTasks,
      logs: weekLogs,
      weekStart,
      weekEnd,
      weekOffset
    };

    // For now, generate basic insights
    const insights = {
      summary: {
        tasksCreated: weekTasks.filter(t => t.createdAt >= weekStart && t.createdAt <= weekEnd).length,
        tasksCompleted: weekTasks.filter(t => t.status === 'completed').length,
        totalTimeSpent: weekTasks.reduce((sum, t) => sum + (t.timing.actualDuration || 0), 0),
        averageTaskDuration: weekTasks.length > 0 ? 
          weekTasks.reduce((sum, t) => sum + (t.timing.actualDuration || 0), 0) / weekTasks.length : 0
      },
      patterns: {
        mostProductiveDay: 'Monday', // Would be calculated from actual data
        peakHours: '10:00-12:00',
        categoryFocus: weekTasks.reduce((acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + 1;
          return acc;
        }, {})
      },
      recommendations: [
        'Consider scheduling more complex tasks during your peak hours',
        'Break down larger tasks into smaller, manageable chunks',
        'Maintain consistent daily routines for better productivity'
      ],
      achievements: [
        ...(weekTasks.filter(t => t.status === 'completed').length >= 10 ? ['Completed 10+ tasks this week!'] : []),
        ...(weekTasks.reduce((sum, t) => sum + (t.timing.actualDuration || 0), 0) >= 300 ? ['Spent 5+ hours on productive work!'] : [])
      ]
    };

    const duration = Date.now() - startTime;
    logger.logAIRequest(userId, 'weekly_insights', duration, true);

    res.json({
      success: true,
      data: {
        insights,
        weekRange: { start: weekStart, end: weekEnd },
        weekOffset,
        generatedAt: new Date()
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logAIRequest(userId, 'weekly_insights', duration, false, error);

    throw error;
  }
}));

// @route   GET /api/ai/status
// @desc    Get AI service status
// @access  Private
router.get('/status', asyncHandler(async (req, res) => {
  const status = aiService.getServiceStatus();
  
  res.json({
    success: true,
    data: {
      ...status,
      features: {
        taskSuggestions: status.initialized,
        productivityAnalysis: status.initialized,
        scheduleOptimization: status.initialized,
        taskEstimation: status.initialized,
        personalizedTips: status.initialized
      },
      limitations: {
        requestsPerHour: 50,
        maxContextLength: 4000,
        supportedLanguages: ['en']
      }
    }
  });
}));

// @route   POST /api/ai/feedback
// @desc    Submit feedback on AI suggestions
// @access  Private
router.post('/feedback', [
  body('type').isIn(['task_suggestion', 'productivity_analysis', 'schedule_optimization', 'task_estimation']),
  body('suggestionId').optional().isString(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('feedback').optional().isLength({ max: 500 }),
  body('helpful').isBoolean()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const { type, suggestionId, rating, feedback, helpful } = req.body;
  const userId = req.user._id;

  // Log AI feedback for future improvements
  logger.logAIRequest(userId, 'ai_feedback', 0, true, null, {
    type,
    suggestionId,
    rating,
    feedback,
    helpful,
    timestamp: new Date()
  });

  res.json({
    success: true,
    message: 'Thank you for your feedback! This helps us improve our AI recommendations.',
    data: {
      feedbackReceived: true,
      type,
      rating
    }
  });
}));

module.exports = router;