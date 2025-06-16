const mongoose = require('mongoose');
const moment = require('moment');

const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v) {
        // Format: YYYYMMDD-UserId-6RandomSymbols
        return /^\d{8}-[a-zA-Z0-9]+-[a-zA-Z0-9]{6}$/.test(v);
      },
      message: 'Device ID must follow format: YYYYMMDD-UserId-6RandomSymbols'
    }
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    trim: true,
    maxlength: 200
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  location: {
    room: { type: String, trim: true },
    building: { type: String, trim: true },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'maintenance', 'error'],
    default: 'offline'
  },
  deviceType: {
    type: String,
    enum: ['smart_lamp', 'task_display', 'productivity_hub'],
    default: 'smart_lamp'
  },
  firmware: {
    version: { type: String, default: '1.0.0' },
    lastUpdate: Date
  },
  hardware: {
    model: { type: String, default: 'ESP32-WROOM-32' },
    serialNumber: String,
    macAddress: String
  },
  configuration: {
    brightness: { type: Number, min: 0, max: 100, default: 80 },
    colorMode: { type: String, enum: ['priority', 'custom', 'mood'], default: 'priority' },
    autoMode: { type: Boolean, default: true },
    soundEnabled: { type: Boolean, default: false },
    displayTimeout: { type: Number, default: 30 }, // seconds
    taskNotifications: { type: Boolean, default: true }
  },
  connectivity: {
    wifi: {
      ssid: String,
      signalStrength: Number,
      lastConnected: Date
    },
    mqtt: {
      broker: { type: String, default: 'broker.hivemq.com' },
      port: { type: Number, default: 1883 },
      lastMessage: Date,
      messageCount: { type: Number, default: 0 }
    }
  },
  currentTask: {
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    startedAt: Date,
    isActive: { type: Boolean, default: false }
  },
  statistics: {
    totalTasksReceived: { type: Number, default: 0 },
    totalTasksCompleted: { type: Number, default: 0 },
    totalUptime: { type: Number, default: 0 }, // in minutes
    averageResponseTime: { type: Number, default: 0 }, // in milliseconds
    lastActivityDate: Date
  },
  logs: [{
    timestamp: { type: Date, default: Date.now },
    level: { type: String, enum: ['info', 'warning', 'error'], default: 'info' },
    message: String,
    data: mongoose.Schema.Types.Mixed
  }],
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
  },
  lastSeen: {
    type: Date,
    default: Date.now
  }
});

// Indexes for better performance
deviceSchema.index({ deviceId: 1 });
deviceSchema.index({ owner: 1 });
deviceSchema.index({ status: 1 });
deviceSchema.index({ lastSeen: 1 });
deviceSchema.index({ 'currentTask.taskId': 1 });

// Update timestamp on save
deviceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for online status check
deviceSchema.virtual('isOnline').get(function() {
  if (!this.lastSeen) return false;
  const minutesOffline = moment().diff(moment(this.lastSeen), 'minutes');
  return minutesOffline < 5; // Consider offline if no activity for 5 minutes
});

// Instance methods
deviceSchema.methods.updateStatus = function(status, message = null) {
  this.status = status;
  this.lastSeen = new Date();
  
  if (message) {
    this.addLog('info', `Status updated to ${status}`, { message });
  }
  
  return this.save();
};

deviceSchema.methods.addLog = function(level, message, data = null) {
  this.logs.push({
    timestamp: new Date(),
    level,
    message,
    data
  });
  
  // Keep only last 100 logs
  if (this.logs.length > 100) {
    this.logs = this.logs.slice(-100);
  }
  
  return this;
};

deviceSchema.methods.assignTask = function(taskId) {
  this.currentTask = {
    taskId,
    startedAt: new Date(),
    isActive: true
  };
  this.statistics.totalTasksReceived += 1;
  
  return this.save();
};

deviceSchema.methods.completeCurrentTask = function() {
  if (this.currentTask.taskId) {
    this.statistics.totalTasksCompleted += 1;
    this.currentTask = {
      taskId: null,
      startedAt: null,
      isActive: false
    };
    this.statistics.lastActivityDate = new Date();
  }
  
  return this.save();
};

deviceSchema.methods.updateConfiguration = function(config) {
  Object.assign(this.configuration, config);
  this.addLog('info', 'Configuration updated', config);
  return this.save();
};

deviceSchema.methods.heartbeat = function() {
  this.lastSeen = new Date();
  this.connectivity.mqtt.lastMessage = new Date();
  this.connectivity.mqtt.messageCount += 1;
  
  if (this.status === 'offline') {
    this.status = 'online';
  }
  
  return this.save();
};

// Static methods
deviceSchema.statics.findOnlineDevices = function() {
  const fiveMinutesAgo = moment().subtract(5, 'minutes').toDate();
  return this.find({
    lastSeen: { $gte: fiveMinutesAgo },
    isActive: true
  });
};

deviceSchema.statics.findByOwner = function(userId) {
  return this.find({ owner: userId, isActive: true }).populate('currentTask.taskId');
};

deviceSchema.statics.generateDeviceId = function(userId) {
  const today = moment().format('YYYYMMDD');
  const randomSymbols = Math.random().toString(36).substring(2, 8);
  return `${today}-${userId}-${randomSymbols}`;
};

deviceSchema.statics.getDeviceStats = async function(deviceId) {
  const device = await this.findOne({ deviceId }).select('statistics');
  return device ? device.statistics : null;
};

module.exports = mongoose.model('Device', deviceSchema);