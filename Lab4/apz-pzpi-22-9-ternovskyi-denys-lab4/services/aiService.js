const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');
const TaskLog = require('../models/TaskLog');
const Task = require('../models/Task');
const User = require('../models/User');
const { handleAIError } = require('../middleware/errorHandler');

class AIService {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.requestCount = 0;
    this.lastRequestTime = null;
  }

  // Initialize AI service
  initialize() {
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        logger.warn('ANTHROPIC_API_KEY not provided, AI features will be disabled');
        return;
      }

      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      this.isInitialized = true;
      logger.info('AI service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AI service:', error);
    }
  }

  // Generate task suggestions based on user patterns
  async generateTaskSuggestions(userId, userContext = {}) {
    if (!this.isInitialized) {
      throw new Error('AI service not initialized');
    }

    try {
      // Get user data and task history
      const user = await User.findById(userId).populate('devices');
      const taskHistory = await TaskLog.getUserActivity(userId, 30);
      const recentTasks = await Task.findUserTasks(userId).limit(10);

      const prompt = this.buildTaskSuggestionPrompt(user, taskHistory, recentTasks, userContext);

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      this.requestCount++;
      this.lastRequestTime = new Date();

      const suggestions = this.parseTaskSuggestions(response.content[0].text);
      
      logger.info(`Generated ${suggestions.length} task suggestions for user ${userId}`);
      return suggestions;

    } catch (error) {
      logger.error('Error generating task suggestions:', error);
      handleAIError(error);
    }
  }

  // Analyze user productivity patterns
  async analyzeProductivityPatterns(userId) {
    if (!this.isInitialized) {
      throw new Error('AI service not initialized');
    }

    try {
      const insights = await TaskLog.getProductivityInsights(userId, 30);
      const user = await User.findById(userId);

      const prompt = this.buildProductivityAnalysisPrompt(user, insights);

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      this.requestCount++;
      this.lastRequestTime = new Date();

      const analysis = this.parseProductivityAnalysis(response.content[0].text);
      
      logger.info(`Generated productivity analysis for user ${userId}`);
      return analysis;

    } catch (error) {
      logger.error('Error analyzing productivity patterns:', error);
      handleAIError(error);
    }
  }

  // Generate optimal schedule suggestions
  async generateOptimalSchedule(userId, tasks, preferences = {}) {
    if (!this.isInitialized) {
      throw new Error('AI service not initialized');
    }

    try {
      const user = await User.findById(userId);
      const productivityInsights = await TaskLog.getProductivityInsights(userId, 30);

      const prompt = this.buildScheduleOptimizationPrompt(user, tasks, productivityInsights, preferences);

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      this.requestCount++;
      this.lastRequestTime = new Date();

      const schedule = this.parseScheduleSuggestions(response.content[0].text);
      
      logger.info(`Generated optimal schedule for user ${userId} with ${tasks.length} tasks`);
      return schedule;

    } catch (error) {
      logger.error('Error generating optimal schedule:', error);
      handleAIError(error);
    }
  }

  // Provide personalized productivity tips
  async getProductivityTips(userId, currentContext = {}) {
    if (!this.isInitialized) {
      throw new Error('AI service not initialized');
    }

    try {
      const user = await User.findById(userId);
      const recentActivity = await TaskLog.getUserActivity(userId, 7);
      const taskStats = await Task.getTaskStats(userId, 30);

      const prompt = this.buildProductivityTipsPrompt(user, recentActivity, taskStats, currentContext);

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      this.requestCount++;
      this.lastRequestTime = new Date();

      const tips = this.parseProductivityTips(response.content[0].text);
      
      logger.info(`Generated productivity tips for user ${userId}`);
      return tips;

    } catch (error) {
      logger.error('Error generating productivity tips:', error);
      handleAIError(error);
    }
  }

  // Estimate task duration and difficulty
  async estimateTask(taskDescription, userHistory = []) {
    if (!this.isInitialized) {
      return {
        estimatedDuration: 30,
        difficulty: 5,
        energyLevel: 'medium',
        confidence: 0.5
      };
    }

    try {
      const prompt = this.buildTaskEstimationPrompt(taskDescription, userHistory);

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      this.requestCount++;
      this.lastRequestTime = new Date();

      const estimation = this.parseTaskEstimation(response.content[0].text);
      
      logger.debug(`Generated task estimation for: ${taskDescription.substring(0, 50)}...`);
      return estimation;

    } catch (error) {
      logger.error('Error estimating task:', error);
      return {
        estimatedDuration: 30,
        difficulty: 5,
        energyLevel: 'medium',
        confidence: 0.3,
        error: error.message
      };
    }
  }

  // Build prompts for different AI tasks
  buildTaskSuggestionPrompt(user, taskHistory, recentTasks, context) {
    return `You are a productivity AI assistant helping users optimize their daily routines and task management.

User Profile:
- Name: ${user.firstName} ${user.lastName}
- Work Schedule: ${user.preferences.workSchedule.startTime} - ${user.preferences.workSchedule.endTime}
- Timezone: ${user.preferences.timezone}
- Total Completed Tasks: ${user.statistics.totalTasksCompleted}
- Average Task Duration: ${user.statistics.averageTaskDuration} minutes

Recent Task Activity (last 30 days):
${JSON.stringify(taskHistory, null, 2)}

Recent Tasks:
${recentTasks.map(task => `- ${task.title} (${task.category}, priority: ${task.priority})`).join('\n')}

Current Context:
${JSON.stringify(context, null, 2)}

Based on this user's patterns and current context, suggest 5-8 productive tasks they should consider. Focus on:
1. Maintaining work-life balance
2. Building on their existing habits
3. Considering their most productive times
4. Varying task types and difficulty levels

Return suggestions in JSON format:
{
  "suggestions": [
    {
      "title": "Task title",
      "description": "Brief description",
      "category": "work|personal|health|learning|exercise|break",
      "priority": 1-3,
      "estimatedDuration": minutes,
      "reasoning": "Why this task is suggested",
      "optimalTime": "morning|afternoon|evening",
      "energyLevel": "low|medium|high"
    }
  ]
}`;
  }

  buildProductivityAnalysisPrompt(user, insights) {
    return `Analyze this user's productivity patterns and provide actionable insights.

User: ${user.firstName} ${user.lastName}
Work Schedule: ${user.preferences.workSchedule.startTime} - ${user.preferences.workSchedule.endTime}
Statistics: ${user.statistics.totalTasksCompleted} tasks completed, ${user.statistics.totalWorkingTime} minutes total

Productivity Data (last 30 days):
${JSON.stringify(insights, null, 2)}

Provide analysis in JSON format:
{
  "patterns": {
    "mostProductiveTime": "time period",
    "mostProductiveDay": "day name",
    "averageEfficiency": percentage,
    "consistencyScore": 1-10
  },
  "strengths": ["strength1", "strength2"],
  "improvements": ["area1", "area2"],
  "recommendations": [
    {
      "category": "schedule|habits|environment|tools",
      "suggestion": "specific recommendation",
      "impact": "high|medium|low",
      "effort": "easy|moderate|difficult"
    }
  ],
  "insights": "2-3 sentence summary of key findings"
}`;
  }

  buildScheduleOptimizationPrompt(user, tasks, insights, preferences) {
    return `Create an optimal daily schedule for this user based on their tasks and productivity patterns.

User Profile:
- Work Hours: ${user.preferences.workSchedule.startTime} - ${user.preferences.workSchedule.endTime}
- Timezone: ${user.preferences.timezone}

Tasks to Schedule:
${tasks.map(task => `- ${task.title} (${task.timing.estimatedDuration}min, priority: ${task.priority}, category: ${task.category})`).join('\n')}

Productivity Insights:
${JSON.stringify(insights, null, 2)}

Preferences:
${JSON.stringify(preferences, null, 2)}

Create an optimized schedule in JSON format:
{
  "schedule": [
    {
      "time": "HH:MM",
      "task": "task title or activity",
      "duration": minutes,
      "type": "task|break|transition",
      "reasoning": "why scheduled at this time"
    }
  ],
  "summary": {
    "totalWorkTime": minutes,
    "breakTime": minutes,
    "efficiency_score": 1-10,
    "balance_score": 1-10
  },
  "tips": ["tip1", "tip2", "tip3"]
}`;
  }

  buildProductivityTipsPrompt(user, activity, stats, context) {
    return `Provide personalized productivity tips for this user based on their recent activity and current context.

User: ${user.firstName}
Recent Activity: ${JSON.stringify(activity, null, 2)}
Statistics: ${JSON.stringify(stats, null, 2)}
Current Context: ${JSON.stringify(context, null, 2)}

Provide 3-5 actionable, personalized tips in JSON format:
{
  "tips": [
    {
      "category": "focus|energy|scheduling|environment|habits",
      "tip": "specific actionable advice",
      "reasoning": "why this helps based on their data",
      "difficulty": "easy|medium|hard",
      "impact": "high|medium|low"
    }
  ],
  "motivation": "encouraging message based on their progress"
}`;
  }

  buildTaskEstimationPrompt(description, history) {
    return `Estimate the duration and difficulty for this task based on the description and user's history with similar tasks.

Task Description: "${description}"

Similar Tasks History:
${history.map(h => `- ${h.title}: planned ${h.estimatedDuration}min, actual ${h.actualDuration}min, difficulty ${h.difficulty}/10`).join('\n')}

Provide estimation in JSON format:
{
  "estimatedDuration": minutes,
  "difficulty": 1-10,
  "energyLevel": "low|medium|high",
  "confidence": 0.0-1.0,
  "factors": ["factor1", "factor2"],
  "tips": ["tip1", "tip2"]
}`;
  }

  // Parse AI responses
  parseTaskSuggestions(response) {
    try {
      const parsed = JSON.parse(response);
      return parsed.suggestions || [];
    } catch (error) {
      logger.warn('Failed to parse task suggestions, using fallback');
      return this.getFallbackTaskSuggestions();
    }
  }

  parseProductivityAnalysis(response) {
    try {
      return JSON.parse(response);
    } catch (error) {
      logger.warn('Failed to parse productivity analysis');
      return {
        patterns: { mostProductiveTime: 'morning', consistencyScore: 5 },
        strengths: ['Consistent task completion'],
        improvements: ['Schedule optimization'],
        recommendations: [],
        insights: 'Analysis requires more data for accurate insights.'
      };
    }
  }

  parseScheduleSuggestions(response) {
    try {
      return JSON.parse(response);
    } catch (error) {
      logger.warn('Failed to parse schedule suggestions');
      return {
        schedule: [],
        summary: { totalWorkTime: 0, efficiency_score: 5 },
        tips: ['Focus on one task at a time', 'Take regular breaks']
      };
    }
  }

  parseProductivityTips(response) {
    try {
      const parsed = JSON.parse(response);
      return parsed.tips || [];
    } catch (error) {
      logger.warn('Failed to parse productivity tips');
      return this.getFallbackProductivityTips();
    }
  }

  parseTaskEstimation(response) {
    try {
      return JSON.parse(response);
    } catch (error) {
      logger.warn('Failed to parse task estimation');
      return {
        estimatedDuration: 30,
        difficulty: 5,
        energyLevel: 'medium',
        confidence: 0.5
      };
    }
  }

  // Fallback responses when AI is unavailable
  getFallbackTaskSuggestions() {
    return [
      {
        title: 'Review daily goals',
        description: 'Take 10 minutes to review and adjust today\'s priorities',
        category: 'work',
        priority: 2,
        estimatedDuration: 10,
        reasoning: 'Regular goal review improves focus and productivity',
        optimalTime: 'morning',
        energyLevel: 'low'
      },
      {
        title: 'Take a short walk',
        description: 'Step outside for fresh air and light exercise',
        category: 'health',
        priority: 3,
        estimatedDuration: 15,
        reasoning: 'Physical activity boosts energy and mental clarity',
        optimalTime: 'afternoon',
        energyLevel: 'medium'
      }
    ];
  }

  getFallbackProductivityTips() {
    return [
      {
        category: 'focus',
        tip: 'Use the Pomodoro Technique: work for 25 minutes, then take a 5-minute break',
        reasoning: 'Short focused intervals improve concentration and prevent burnout',
        difficulty: 'easy',
        impact: 'high'
      },
      {
        category: 'environment',
        tip: 'Organize your workspace before starting tasks',
        reasoning: 'A clean environment reduces distractions and improves focus',
        difficulty: 'easy',
        impact: 'medium'
      }
    ];
  }

  // Service status and metrics
  getServiceStatus() {
    return {
      initialized: this.isInitialized,
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY
    };
  }

  // Reset request counter (for rate limiting)
  resetRequestCounter() {
    this.requestCount = 0;
    this.lastRequestTime = null;
  }
}

// Singleton instance
const aiService = new AIService();

module.exports = aiService;