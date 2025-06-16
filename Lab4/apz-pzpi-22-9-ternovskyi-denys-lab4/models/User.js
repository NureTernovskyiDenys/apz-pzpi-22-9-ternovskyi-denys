const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profilePicture: {
    type: String,
    default: null
  },
  preferences: {
    timezone: {
      type: String,
      default: 'UTC'
    },
    language: {
      type: String,
      default: 'en'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      taskReminders: { type: Boolean, default: true }
    },
    workSchedule: {
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '17:00' },
      workDays: [{ type: Number, min: 0, max: 6 }] // 0-Sunday, 6-Saturday
    }
  },
  statistics: {
    totalTasksCompleted: { type: Number, default: 0 },
    totalWorkingTime: { type: Number, default: 0 }, // in minutes
    averageTaskDuration: { type: Number, default: 0 }, // in minutes
    streakDays: { type: Number, default: 0 },
    lastActivityDate: Date
  },
  devices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device'
  }],
  lastLogin: Date,
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
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Update timestamp on save
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.updateStatistics = async function(completedTask) {
  this.statistics.totalTasksCompleted += 1;
  this.statistics.totalWorkingTime += completedTask.actualDuration || 0;
  this.statistics.lastActivityDate = new Date();
  
  // Calculate average task duration
  if (this.statistics.totalTasksCompleted > 0) {
    this.statistics.averageTaskDuration = Math.round(
      this.statistics.totalWorkingTime / this.statistics.totalTasksCompleted
    );
  }
  
  return this.save();
};

userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

// Static methods
userSchema.statics.findActiveUsers = function() {
  return this.find({ isActive: true });
};

userSchema.statics.getUserStats = async function(userId) {
  const user = await this.findById(userId).select('statistics');
  return user ? user.statistics : null;
};

module.exports = mongoose.model('User', userSchema);