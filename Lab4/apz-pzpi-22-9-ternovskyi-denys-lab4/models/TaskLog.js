const mongoose = require('mongoose');

const taskLogSchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  device: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device'
  },
  action: {
    type: String,
    enum: [
      'created', 'assigned', 'started', 'paused', 'resumed', 
      'completed', 'cancelled', 'postponed', 'updated', 
      'note_added', 'progress_updated', 'device_interaction'
    ],
    required: true
  },
  details: {
    previousStatus: String,
    newStatus: String,
    duration: Number, // in minutes
    progressChange: Number, // percentage change
    note: String,
    rating: Number,
    metadata: mongoose.Schema.Types.Mixed
  },
  deviceData: {
    lampColor: String,
    displayMessage: String,
    buttonPressed: String,
    sensorData: mongoose.Schema.Types.Mixed
  },
  context: {
    timeOfDay: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night']
    },
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6
    },
    userLocation: String,
    environmentNoise: String,
    userMood: {
      type: String,
      enum: ['energetic', 'focused', 'tired', 'stressed', 'relaxed']
    }
  },
  performance: {
    taskEfficiency: Number, // 0-100 scale
    focusLevel: Number, // 1-10 scale
    interruptionCount: Number,
    qualityScore: Number // 1-10 scale
  },
  aiInsights: {
    predicted: {
      duration: Number,
      successProbability: Number,
      optimalTime: String
    },
    actual: {
      duration: Number,
      success: Boolean,
      userSatisfaction: Number
    },
    accuracy: {
      durationAccuracy: Number, // percentage
      successPredictionAccuracy: Number,
      overallAccuracy: Number
    }
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  sessionId: {
    type: String,
    required: true
  },
  ipAddress: String,
  userAgent: String
});

// Indexes for analytics and performance
taskLogSchema.index({ task: 1, timestamp: -1 });
taskLogSchema.index({ user: 1, timestamp: -1 });
taskLogSchema.index({ device: 1, timestamp: -1 });
taskLogSchema.index({ action: 1, timestamp: -1 });
taskLogSchema.index({ sessionId: 1 });
taskLogSchema.index({ timestamp: -1 });
taskLogSchema.index({ 'context.timeOfDay': 1, action: 1 });

// Static methods for analytics
taskLogSchema.statics.getUserActivity = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startDate }
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
        },
        totalActions: { $sum: '$count' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

taskLogSchema.statics.getDeviceUsage = async function(deviceId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        device: mongoose.Types.ObjectId(deviceId),
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          hour: { $hour: '$timestamp' },
          action: '$action'
        },
        count: { $sum: 1 },
        avgDuration: { $avg: '$details.duration' }
      }
    },
    {
      $group: {
        _id: '$_id.hour',
        actions: {
          $push: {
            action: '$_id.action',
            count: '$count',
            avgDuration: '$avgDuration'
          }
        },
        totalInteractions: { $sum: '$count' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

taskLogSchema.statics.getProductivityInsights = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const insights = await this.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startDate },
        action: { $in: ['completed', 'started'] }
      }
    },
    {
      $group: {
        _id: {
          timeOfDay: '$context.timeOfDay',
          dayOfWeek: '$context.dayOfWeek'
        },
        completedTasks: {
          $sum: { $cond: [{ $eq: ['$action', 'completed'] }, 1, 0] }
        },
        startedTasks: {
          $sum: { $cond: [{ $eq: ['$action', 'started'] }, 1, 0] }
        },
        avgEfficiency: { $avg: '$performance.taskEfficiency' },
        avgFocus: { $avg: '$performance.focusLevel' },
        avgQuality: { $avg: '$performance.qualityScore' }
      }
    },
    {
      $addFields: {
        completionRate: {
          $cond: [
            { $gt: ['$startedTasks', 0] },
            { $divide: ['$completedTasks', '$startedTasks'] },
            0
          ]
        }
      }
    },
    { $sort: { '_id.dayOfWeek': 1, '_id.timeOfDay': 1 } }
  ]);
  
  return insights;
};

taskLogSchema.statics.getAIAccuracy = async function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate },
        'aiInsights.accuracy': { $exists: true }
      }
    },
    {
      $group: {
        _id: null,
        avgDurationAccuracy: { $avg: '$aiInsights.accuracy.durationAccuracy' },
        avgSuccessAccuracy: { $avg: '$aiInsights.accuracy.successPredictionAccuracy' },
        avgOverallAccuracy: { $avg: '$aiInsights.accuracy.overallAccuracy' },
        totalPredictions: { $sum: 1 }
      }
    }
  ]);
};

taskLogSchema.statics.logAction = async function(data) {
  const log = new this({
    task: data.taskId,
    user: data.userId,
    device: data.deviceId,
    action: data.action,
    details: data.details || {},
    deviceData: data.deviceData || {},
    context: data.context || {},
    performance: data.performance || {},
    aiInsights: data.aiInsights || {},
    sessionId: data.sessionId,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent
  });
  
  return log.save();
};

taskLogSchema.statics.getHeatmapData = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startDate },
        action: 'completed'
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          hour: { $hour: '$timestamp' }
        },
        count: { $sum: 1 },
        avgEfficiency: { $avg: '$performance.taskEfficiency' }
      }
    },
    { $sort: { '_id.date': 1, '_id.hour': 1 } }
  ]);
};

module.exports = mongoose.model('TaskLog', taskLogSchema);