const mqtt = require('mqtt');
const logger = require('../utils/logger');
const Device = require('../models/Device');
const Task = require('../models/Task');
const TaskLog = require('../models/TaskLog');
const { handleMQTTError } = require('../middleware/errorHandler');

class MQTTService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.subscriptions = new Map();
    this.deviceStatus = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  // Initialize MQTT connection
  initialize() {
    const options = {
      host: process.env.MQTT_BROKER || 'broker.hivemq.com',
      port: process.env.MQTT_PORT || 1883,
      protocol: 'mqtt',
      clientId: `smart-lamp-server-${Date.now()}`,
      clean: true,
      connectTimeout: 30000,
      reconnectPeriod: 5000,
      keepalive: 60,
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD
    };

    this.client = mqtt.connect(options);
    this.setupEventHandlers();
    
    logger.info('MQTT service initializing...');
  }

  // Setup MQTT event handlers
  setupEventHandlers() {
    this.client.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info('Connected to MQTT broker');
      
      // Subscribe to all device topics
      this.subscribeToDeviceTopics();
      
      // Subscribe to general topics
      this.client.subscribe('smartlamp/+/+', (err) => {
        if (err) {
          logger.error('Failed to subscribe to device topics:', err);
        } else {
          logger.info('Subscribed to all device topics');
        }
      });
    });

    this.client.on('message', (topic, message) => {
      this.handleIncomingMessage(topic, message);
    });

    this.client.on('error', (error) => {
      logger.error('MQTT connection error:', error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('MQTT connection closed');
    });

    this.client.on('disconnect', () => {
      this.isConnected = false;
      logger.warn('MQTT disconnected');
    });

    this.client.on('offline', () => {
      this.isConnected = false;
      logger.warn('MQTT client offline');
    });

    this.client.on('reconnect', () => {
      this.reconnectAttempts++;
      logger.info(`MQTT reconnection attempt ${this.reconnectAttempts}`);
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        logger.error('Max MQTT reconnection attempts reached');
        this.client.end();
      }
    });
  }

  // Handle incoming MQTT messages
  async handleIncomingMessage(topic, message) {
    try {
      const topicParts = topic.split('/');
      
      if (topicParts.length < 3 || topicParts[0] !== 'smartlamp') {
        logger.warn(`Invalid topic format: ${topic}`);
        return;
      }

      const deviceId = topicParts[1];
      const messageType = topicParts[2];
      
      // Ignore messages in topics where server sends data (avoid processing our own messages)
      if (messageType === 'tasks' || messageType === 'commands') {
        logger.debug(`Ignoring outgoing message in topic: ${topic}`);
        return;
      }
      
      let data;
      try {
        data = JSON.parse(message.toString());
      } catch (parseError) {
        logger.warn(`Invalid JSON from device ${deviceId}:`, message.toString());
        return;
      }

      logger.debug(`MQTT message: ${topic} -> ${JSON.stringify(data)}`);

      // Update device last seen
      await this.updateDeviceStatus(deviceId, data);

      // Handle different message types
      switch (messageType) {
        case 'status':
          await this.handleDeviceStatus(deviceId, data);
          break;
        case 'task_status':
          await this.handleTaskStatus(deviceId, data);
          break;
        case 'completed':
          await this.handleTaskCompletion(deviceId, data);
          break;
        case 'progress':
          await this.handleTaskProgress(deviceId, data);
          break;
        case 'heartbeat':
          await this.handleHeartbeat(deviceId, data);
          break;
        case 'request':
          await this.handleTaskRequest(deviceId, data);
          break;
        default:
          logger.warn(`Unknown message type ${messageType} from device ${deviceId}`);
      }

    } catch (error) {
      logger.error('Error handling MQTT message:', error);
    }
  }

  // Handle task requests from devices
  async handleTaskRequest(deviceId, data) {
    try {
      logger.info(`Task request from device ${deviceId}:`, data);
      
      const device = await Device.findOne({ deviceId });
      if (!device) {
        logger.warn(`Device ${deviceId} not found for task request`);
        return;
      }

      // Send pending tasks to the requesting device
      await this.sendPendingTasksToDevice(deviceId);
      
    } catch (error) {
      logger.error(`Error handling task request from ${deviceId}:`, error);
    }
  }

  // Update device status and last seen
  async updateDeviceStatus(deviceId, data) {
    try {
      const device = await Device.findOne({ deviceId });
      if (device) {
        await device.heartbeat();
        this.deviceStatus.set(deviceId, {
          lastSeen: new Date(),
          status: data.status || 'online'
        });
      }
    } catch (error) {
      logger.error(`Error updating device ${deviceId} status:`, error);
    }
  }

  // Handle device status updates
  async handleDeviceStatus(deviceId, data) {
    try {
      const device = await Device.findOne({ deviceId });
      if (!device) {
        logger.warn(`Device ${deviceId} not found in database`);
        return;
      }

      await device.updateStatus(data.status, data.message);
      
      // Auto-send pending tasks when device comes online
      if (data.status === 'online') {
        await this.sendPendingTasksToDevice(deviceId);
      }
      
      logger.info(`Device ${deviceId} status updated to ${data.status}`);
    } catch (error) {
      logger.error(`Error handling device status for ${deviceId}:`, error);
    }
  }

  // Handle task status updates
  async handleTaskStatus(deviceId, data) {
    try {
      const task = await Task.findById(data.taskId);
      if (!task) {
        logger.warn(`Task ${data.taskId} not found`);
        return;
      }

      // Update task status based on device report
      if (data.status === 'started') {
        await task.start(deviceId);
      } else if (data.status === 'paused') {
        await task.pause();
      }

      // Log the action
      await TaskLog.logAction({
        taskId: task._id,
        userId: task.owner,
        deviceId: deviceId,
        action: data.status,
        details: { deviceReported: true },
        sessionId: data.sessionId || `device-${deviceId}-${Date.now()}`
      });

      logger.info(`Task ${data.taskId} ${data.status} on device ${deviceId}`);
    } catch (error) {
      logger.error(`Error handling task status from ${deviceId}:`, error);
    }
  }

  // Handle task completion
  async handleTaskCompletion(deviceId, data) {
    try {
      const task = await Task.findById(data.taskId);
      if (!task) {
        logger.warn(`Task ${data.taskId} not found`);
        return;
      }

      // Complete the task
      await task.complete(data.rating, data.feedback);

      // Update device
      const device = await Device.findOne({ deviceId });
      if (device) {
        await device.completeCurrentTask();
      }

      // Update user statistics
      const User = require('../models/User');
      const user = await User.findById(task.owner);
      if (user) {
        await user.updateStatistics(task);
      }

      // Log completion
      await TaskLog.logAction({
        taskId: task._id,
        userId: task.owner,
        deviceId: deviceId,
        action: 'completed',
        details: {
          actualDuration: data.actualDuration,
          plannedDuration: data.plannedDuration,
          rating: data.rating,
          deviceReported: true
        },
        performance: {
          taskEfficiency: this.calculateEfficiency(data.actualDuration, data.plannedDuration),
          qualityScore: data.rating || 5
        },
        sessionId: data.sessionId || `device-${deviceId}-${Date.now()}`
      });

      logger.info(`Task ${data.taskId} completed on device ${deviceId}`);
      
      // Auto-send next pending task
      setTimeout(() => {
        this.sendPendingTasksToDevice(deviceId);
      }, 2000);
      
    } catch (error) {
      logger.error(`Error handling task completion from ${deviceId}:`, error);
    }
  }

  // Handle task progress updates
  async handleTaskProgress(deviceId, data) {
    try {
      const task = await Task.findById(data.taskId);
      if (!task) {
        return;
      }

      const progressPercentage = (data.elapsedMinutes / data.totalMinutes) * 100;
      await task.updateProgress(Math.min(progressPercentage, 100));

      logger.debug(`Task ${data.taskId} progress: ${data.elapsedMinutes}/${data.totalMinutes} minutes`);
    } catch (error) {
      logger.error(`Error handling task progress from ${deviceId}:`, error);
    }
  }

  // Handle device heartbeat
  async handleHeartbeat(deviceId, data) {
    try {
      const device = await Device.findOne({ deviceId });
      if (device) {
        await device.heartbeat();
      }
    } catch (error) {
      logger.error(`Error handling heartbeat from ${deviceId}:`, error);
    }
  }

  // Send task to device
  async sendTaskToDevice(deviceId, task) {
    if (!this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    const topic = `smartlamp/${deviceId}/tasks`;
    const taskData = {
      id: task._id.toString(),
      title: task.title,
      description: task.description,
      priority: task.priority,
      duration: task.timing.estimatedDuration,
      category: task.category,
      timestamp: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      this.client.publish(topic, JSON.stringify(taskData), { qos: 1 }, (error) => {
        if (error) {
          logger.error(`Failed to send task to device ${deviceId}:`, error);
          reject(error);
        } else {
          logger.info(`Task sent to device ${deviceId}: ${task.title}`);
          resolve();
        }
      });
    });
  }

  // Send command to device
  async sendCommandToDevice(deviceId, command, data = {}) {
    if (!this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    const topic = `smartlamp/${deviceId}/commands`;
    const commandData = {
      command,
      data,
      timestamp: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      this.client.publish(topic, JSON.stringify(commandData), { qos: 1 }, (error) => {
        if (error) {
          logger.error(`Failed to send command to device ${deviceId}:`, error);
          reject(error);
        } else {
          logger.info(`Command sent to device ${deviceId}: ${command}`);
          resolve();
        }
      });
    });
  }

  // Subscribe to device topics
  async subscribeToDeviceTopics() {
    try {
      const devices = await Device.find({ isActive: true });
      
      for (const device of devices) {
        const patterns = [
          `smartlamp/${device.deviceId}/status`,
          `smartlamp/${device.deviceId}/task_status`,
          `smartlamp/${device.deviceId}/completed`,
          `smartlamp/${device.deviceId}/progress`,
          `smartlamp/${device.deviceId}/heartbeat`,
          `smartlamp/${device.deviceId}/request`
        ];

        for (const pattern of patterns) {
          this.client.subscribe(pattern);
        }
      }

      logger.info(`Subscribed to ${devices.length} device topics`);
    } catch (error) {
      logger.error('Error subscribing to device topics:', error);
    }
  }

  // Get device online status
  isDeviceOnline(deviceId) {
    const status = this.deviceStatus.get(deviceId);
    if (!status) return false;
    
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return status.lastSeen > fiveMinutesAgo;
  }

  // Get all device statuses
  getAllDeviceStatuses() {
    const statuses = {};
    for (const [deviceId, status] of this.deviceStatus) {
      statuses[deviceId] = {
        ...status,
        isOnline: this.isDeviceOnline(deviceId)
      };
    }
    return statuses;
  }

  // Calculate task efficiency
  calculateEfficiency(actualDuration, plannedDuration) {
    if (!plannedDuration || plannedDuration === 0) return 100;
    
    const efficiency = (plannedDuration / Math.max(actualDuration, 1)) * 100;
    return Math.min(Math.max(efficiency, 0), 200); // Cap at 200% for overperformance
  }

  // Send pending tasks to device
  async sendPendingTasksToDevice(deviceId) {
    try {
      const device = await Device.findOne({ deviceId }).populate('owner');
      if (!device) {
        logger.warn(`Device ${deviceId} not found for sending pending tasks`);
        return;
      }

      const Task = require('../models/Task');
      
      // Get pending tasks for this user
      const pendingTasks = await Task.find({
        owner: device.owner._id,
        status: { $in: ['pending'] },
        isActive: true
      })
      .sort({ priority: 1, createdAt: 1 })
      .limit(1); // Send only one task at a time

      logger.info(`Found ${pendingTasks.length} pending tasks for device ${deviceId}`);

      // Send the first task
      if (pendingTasks.length > 0) {
        const task = pendingTasks[0];
        
        // Auto-assign to device if not assigned
        if (!task.assignedDevice) {
          await task.assignToDevice(device.deviceId);
          await device.assignTask(task._id);
          logger.info(`Auto-assigned task ${task._id} to device ${deviceId}`);
        }
        
        // Send via MQTT
        await this.sendTaskToDevice(deviceId, task);
        logger.info(`Sent task "${task.title}" to device ${deviceId}`);
      } else {
        logger.info(`No pending tasks found for device ${deviceId}`);
      }

    } catch (error) {
      logger.error(`Error sending pending tasks to device ${deviceId}:`, error);
    }
  }

  // Disconnect MQTT client
  disconnect() {
    if (this.client && this.isConnected) {
      this.client.end();
      logger.info('MQTT client disconnected');
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      subscribedDevices: this.subscriptions.size,
      activeDevices: this.deviceStatus.size
    };
  }
}

// Singleton instance
const mqttService = new MQTTService();

module.exports = mqttService;