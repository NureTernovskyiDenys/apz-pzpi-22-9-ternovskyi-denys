const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// JWT Authentication Middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user
    const user = await User.findById(decoded.userId).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    // Add user to request object
    req.user = user;
    req.userId = user._id;
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Admin Authorization Middleware
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  
  next();
};

// Moderator or Admin Authorization
const requireModerator = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  if (!['admin', 'moderator'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Moderator or Admin access required'
    });
  }
  
  next();
};

// Resource Owner Authorization (user can only access their own resources)
const requireOwnership = (resourceField = 'owner') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }
    
    // For resources where ownership needs to be checked against DB
    req.ownershipField = resourceField;
    next();
  };
};

// Device Access Authorization
const requireDeviceAccess = async (req, res, next) => {
  try {
    const deviceId = req.params.deviceId || req.body.deviceId;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID required'
      });
    }
    
    const Device = require('../models/Device');
    const device = await Device.findOne({ deviceId });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Check if user owns the device or is admin
    if (req.user.role !== 'admin' && !device.owner.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this device'
      });
    }
    
    req.device = device;
    next();
  } catch (error) {
    logger.error('Device access check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Optional Authentication (for public endpoints that can benefit from auth)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return next(); // Continue without authentication
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (user && user.isActive) {
      req.user = user;
      req.userId = user._id;
    }
    
    next();
  } catch (error) {
    // Ignore authentication errors for optional auth
    next();
  }
};

// Generate JWT Token
const generateToken = (userId, expiresIn = '24h') => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

// Generate Refresh Token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Verify Refresh Token
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    return decoded.type === 'refresh' ? decoded : null;
  } catch (error) {
    return null;
  }
};

// Rate limiting middleware for sensitive operations
const sensitiveOperationLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();
  
  return (req, res, next) => {
    const key = req.ip + (req.user ? req.user._id : '');
    const now = Date.now();
    
    // Clean old entries
    for (const [k, v] of attempts.entries()) {
      if (now - v.timestamp > windowMs) {
        attempts.delete(k);
      }
    }
    
    const userAttempts = attempts.get(key) || { count: 0, timestamp: now };
    
    if (userAttempts.count >= maxAttempts) {
      return res.status(429).json({
        success: false,
        message: 'Too many attempts, please try again later'
      });
    }
    
    userAttempts.count += 1;
    userAttempts.timestamp = now;
    attempts.set(key, userAttempts);
    
    next();
  };
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireModerator,
  requireOwnership,
  requireDeviceAccess,
  optionalAuth,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  sensitiveOperationLimit
};