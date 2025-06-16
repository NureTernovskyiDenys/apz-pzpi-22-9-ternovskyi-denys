const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

// Tell winston about our colors
winston.addColors(colors);

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define format for file logs (without colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    format: format
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    tailable: true
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    tailable: true
  })
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels,
  format: fileFormat,
  transports,
  exitOnError: false
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Add request logging middleware
logger.http = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;
    
    if (res.statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.info(message);
    }
  });
  
  if (next) next();
};

// Add structured logging methods
logger.logUserAction = (userId, action, details = {}) => {
  logger.info('User action', {
    userId,
    action,
    details,
    timestamp: new Date().toISOString()
  });
};

logger.logDeviceEvent = (deviceId, event, data = {}) => {
  logger.info('Device event', {
    deviceId,
    event,
    data,
    timestamp: new Date().toISOString()
  });
};

logger.logTaskEvent = (taskId, userId, event, details = {}) => {
  logger.info('Task event', {
    taskId,
    userId,
    event,
    details,
    timestamp: new Date().toISOString()
  });
};

logger.logMQTTEvent = (deviceId, topic, message, direction = 'received') => {
  logger.debug('MQTT event', {
    deviceId,
    topic,
    message: typeof message === 'string' ? message.substring(0, 200) : message,
    direction,
    timestamp: new Date().toISOString()
  });
};

logger.logAIRequest = (userId, operation, duration, success = true, error = null) => {
  const level = success ? 'info' : 'error';
  logger[level]('AI request', {
    userId,
    operation,
    duration,
    success,
    error: error?.message,
    timestamp: new Date().toISOString()
  });
};

logger.logSecurityEvent = (event, details = {}) => {
  logger.warn('Security event', {
    event,
    details,
    timestamp: new Date().toISOString()
  });
};

logger.logPerformance = (operation, duration, details = {}) => {
  const level = duration > 5000 ? 'warn' : 'info'; // Warn if operation takes more than 5 seconds
  logger[level]('Performance', {
    operation,
    duration: `${duration}ms`,
    details,
    timestamp: new Date().toISOString()
  });
};

// Error tracking with context
logger.errorWithContext = (message, error, context = {}) => {
  logger.error(message, {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context,
    timestamp: new Date().toISOString()
  });
};

// Database operation logging
logger.logDBOperation = (operation, collection, duration, recordCount = null) => {
  logger.debug('Database operation', {
    operation,
    collection,
    duration: `${duration}ms`,
    recordCount,
    timestamp: new Date().toISOString()
  });
};

// System health logging
logger.logSystemHealth = (metrics) => {
  logger.info('System health', {
    ...metrics,
    timestamp: new Date().toISOString()
  });
};

// Rate limiting events
logger.logRateLimit = (ip, endpoint, userAgent = null) => {
  logger.warn('Rate limit exceeded', {
    ip,
    endpoint,
    userAgent,
    timestamp: new Date().toISOString()
  });
};

// Authentication events
logger.logAuth = (event, userId, ip, userAgent = null, success = true, details = {}) => {
  const level = success ? 'info' : 'warn';
  logger[level]('Authentication event', {
    event,
    userId,
    ip,
    userAgent,
    success,
    details,
    timestamp: new Date().toISOString()
  });
};

// Add custom log levels for specific components
logger.addLogLevel = (name, level) => {
  levels[name] = level;
  colors[name] = 'cyan';
  winston.addColors(colors);
};

// Graceful shutdown logging
logger.logShutdown = (reason) => {
  logger.info('Application shutdown', {
    reason,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
};

// Startup logging
logger.logStartup = (config) => {
  logger.info('Application startup', {
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    config,
    timestamp: new Date().toISOString()
  });
};

// Export logger instance
module.exports = logger;