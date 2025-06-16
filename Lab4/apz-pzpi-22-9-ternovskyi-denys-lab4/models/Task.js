const mongoose = require('mongoose');
const moment = require('moment');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedDevice: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['work', 'personal', 'health', 'learning', 'exercise', 'break', 'other'],
    default: 'work'
  },
  priority: {
    type: Number,
    enum: [1, 2, 3], // 1-high, 2-medium, 3-low
    default: 2
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in_progress', 'paused', 'completed', 'cancelled', 'overdue'],
    default: 'pending'
  },
  timing: {
    estimatedDuration: { type: Number, required: true, min: 1 }, // in minutes
    actualDuration: { type: Number, default: 0 }, // in minutes
    scheduledStart: Date,
    scheduledEnd: Date,
    actualStart: Date,
    actualEnd: Date,
    deadline: Date
  },
  recurrence: {
    isRecurring: { type: Boolean, default: false },
    pattern: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'custom'],
      default: 'daily'
    },
    interval: { type: Number, default: 1 }, // Every N days/weeks/months
    daysOfWeek: [{ type: Number, min: 0, max: 6 }], // For weekly pattern
    endDate: Date,
    occurrences: Number // Number of times to repeat
  },
  aiSuggestions: {
    optimalTime: String, // e.g., "morning", "afternoon", "evening"
    energyLevel: { type: String, enum: ['low', 'medium', 'high'] },
    estimatedFocus: Number, // 1-10 scale
    tips: [String],
    generatedAt: Date
  },
  progress: {
    percentage: { type: Number, min: 0, max: 100, default: 0 },
    checkpoints: [{
      name: String,
      completed: { type: Boolean, default: false },
      timestamp: Date
    }],
    notes: [{
      content: String,
      timestamp: { type: Date, default: Date.now },
      addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }]
  },
  tags: [String],
  metadata: {
    difficulty: { type: Number, min: 1, max: 10, default: 5 },
    energyRequired: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    environmentRequired: { type: String, enum: ['quiet', 'normal', 'collaborative'] },
    toolsNeeded: [String],
    dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }]
  },
  completion: {
    completedAt: Date,
    completionRating: { type: Number, min: 1, max: 5 }, // User satisfaction
    feedback: String,
    lessons: String,
    nextSteps: String
  },
  analytics: {
    viewCount: { type: Number, default: 0 },
    editCount: { type: Number, default: 0 },
    postponedCount: { type: Number, default: 0 },
    deviceInteractions: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for better performance
taskSchema.index({ owner: 1, status: 1 });
taskSchema.index({ assignedDevice: 1 });
taskSchema.index({ priority: 1, status: 1 });
taskSchema.index({ 'timing.deadline': 1 });
taskSchema.index({ 'timing.scheduledStart': 1 });
taskSchema.index({ category: 1 });
taskSchema.index({ tags: 1 });

// Update timestamp on save
taskSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for overdue status
taskSchema.virtual('isOverdue').get(function() {
  if (!this.timing.deadline) return false;
  return moment().isAfter(moment(this.timing.deadline)) && this.status !== 'completed';
});

// Virtual for time remaining
taskSchema.virtual('timeRemaining').get(function() {
  if (!this.timing.deadline) return null;
  const remaining = moment(this.timing.deadline).diff(moment(), 'minutes');
  return remaining > 0 ? remaining : 0;
});

// Instance methods
taskSchema.methods.start = function(deviceId = null) {
  this.status = 'in_progress';
  this.timing.actualStart = new Date();
  
  if (deviceId) {
    this.assignedDevice = deviceId;
  }
  
  this.analytics.deviceInteractions += 1;
  return this.save();
};

taskSchema.methods.pause = function() {
  if (this.status === 'in_progress') {
    this.status = 'paused';
    
    // Calculate current duration
    if (this.timing.actualStart) {
      const currentDuration = moment().diff(moment(this.timing.actualStart), 'minutes');
      this.timing.actualDuration += currentDuration;
    }
  }
  
  return this.save();
};

taskSchema.methods.complete = function(rating = null, feedback = null) {
  this.status = 'completed';
  this.timing.actualEnd = new Date();
  this.progress.percentage = 100;
  
  // Calculate final duration
  if (this.timing.actualStart) {
    this.timing.actualDuration = moment(this.timing.actualEnd).diff(
      moment(this.timing.actualStart), 'minutes'
    );
  }
  
  this.completion.completedAt = new Date();
  if (rating) this.completion.completionRating = rating;
  if (feedback) this.completion.feedback = feedback;
  
  return this.save();
};

taskSchema.methods.postpone = function(newDeadline) {
  this.timing.deadline = newDeadline;
  this.analytics.postponedCount += 1;
  this.addNote(`Task postponed to ${moment(newDeadline).format('YYYY-MM-DD HH:mm')}`, this.owner);
  
  return this.save();
};

taskSchema.methods.addNote = function(content, userId) {
  this.progress.notes.push({
    content,
    addedBy: userId,
    timestamp: new Date()
  });
  
  return this;
};

taskSchema.methods.updateProgress = function(percentage, checkpoint = null) {
  this.progress.percentage = Math.min(100, Math.max(0, percentage));
  
  if (checkpoint) {
    const existingCheckpoint = this.progress.checkpoints.find(cp => cp.name === checkpoint);
    if (existingCheckpoint) {
      existingCheckpoint.completed = true;
      existingCheckpoint.timestamp = new Date();
    } else {
      this.progress.checkpoints.push({
        name: checkpoint,
        completed: true,
        timestamp: new Date()
      });
    }
  }
  
  return this.save();
};

taskSchema.methods.assignToDevice = function(deviceId) {
  this.assignedDevice = deviceId; // Теперь сохраняем строку deviceId
  this.status = 'assigned';
  this.analytics.deviceInteractions += 1;
  
  return this.save();
};

// Static methods
taskSchema.statics.findUserTasks = function(userId, status = null) {
  const query = { owner: userId, isActive: true };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('assignedDevice', 'name deviceId status')
    .sort({ priority: 1, 'timing.deadline': 1 });
};

taskSchema.statics.findOverdueTasks = function() {
  return this.find({
    'timing.deadline': { $lt: new Date() },
    status: { $in: ['pending', 'assigned', 'in_progress', 'paused'] },
    isActive: true
  });
};

taskSchema.statics.findTasksForDevice = function(deviceId) {
  return this.find({
    assignedDevice: deviceId, // Теперь ищем по строке deviceId
    status: { $in: ['assigned', 'in_progress', 'paused'] },
    isActive: true
  }).sort({ priority: 1 });
};

taskSchema.statics.getTaskStats = async function(userId, days = 30) {
  const startDate = moment().subtract(days, 'days').toDate();
  
  const stats = await this.aggregate([
    {
      $match: {
        owner: mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate },
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        totalTasks: { $sum: 1 },
        completedTasks: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        averageDuration: { $avg: '$timing.actualDuration' },
        totalTime: { $sum: '$timing.actualDuration' },
        averageRating: { $avg: '$completion.completionRating' }
      }
    }
  ]);
  
  return stats[0] || {
    totalTasks: 0,
    completedTasks: 0,
    averageDuration: 0,
    totalTime: 0,
    averageRating: 0
  };
};

module.exports = mongoose.model('Task', taskSchema);