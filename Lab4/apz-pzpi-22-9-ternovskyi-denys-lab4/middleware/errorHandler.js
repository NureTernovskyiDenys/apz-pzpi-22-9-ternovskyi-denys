const logger = require('../utils/logger');

// Custom Error Classes
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 400);
    this.field = field;
    this.type = 'validation';
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
    this.type = 'authentication';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
    this.type = 'authorization';
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
    this.type = 'not_found';
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
    this.type = 'conflict';
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
    this.type = 'rate_limit';
  }
}

// Handle specific error types
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new ValidationError(message, err.path);
};

const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `${field} '${value}' already exists`;
  return new ConflictError(message);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => ({
    field: el.path,
    message: el.message,
    value: el.value
  }));
  
  const message = 'Invalid input data';
  const validationError = new ValidationError(message);
  validationError.errors = errors;
  return validationError;
};

const handleJWTError = () => new AuthenticationError('Invalid token');

const handleJWTExpiredError = () => new AuthenticationError('Token expired');

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    error: {
      status: err.status,
      message: err.message,
      stack: err.stack,
      ...(err.errors && { validationErrors: err.errors }),
      ...(err.field && { field: err.field })
    }
  });
};

const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    const response = {
      success: false,
      message: err.message,
      ...(err.type && { type: err.type }),
      ...(err.errors && { validationErrors: err.errors }),
      ...(err.field && { field: err.field })
    };
    
    res.status(err.statusCode).json(response);
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('Unexpected error:', err);
    
    res.status(500).json({
      success: false,
      message: 'Something went wrong'
    });
  }
};

// Main error handling middleware
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  // Log error details
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });
  
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;
    
    // Handle specific error types
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    
    sendErrorProd(error, res);
  }
};

// Async error handler wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler for undefined routes
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Validation error formatter
const formatValidationError = (errors) => {
  return errors.array().map(error => ({
    field: error.param,
    message: error.msg,
    value: error.value,
    location: error.location
  }));
};

// Database connection error handler
const handleDatabaseError = (error) => {
  logger.error('Database connection error:', error);
  
  if (error.name === 'MongooseServerSelectionError') {
    throw new AppError('Database connection failed', 503);
  }
  
  if (error.name === 'MongooseTimeoutError') {
    throw new AppError('Database operation timeout', 504);
  }
  
  throw new AppError('Database error', 500);
};

// MQTT error handler
const handleMQTTError = (error, deviceId = null) => {
  logger.error('MQTT error:', { error: error.message, deviceId });
  
  if (error.code === 'ECONNREFUSED') {
    throw new AppError('MQTT broker connection refused', 503);
  }
  
  if (error.code === 'ENOTFOUND') {
    throw new AppError('MQTT broker not found', 503);
  }
  
  throw new AppError('MQTT communication error', 500);
};

// AI Service error handler
const handleAIError = (error) => {
  logger.error('AI service error:', error);
  
  if (error.status === 401) {
    throw new AppError('AI service authentication failed', 503);
  }
  
  if (error.status === 429) {
    throw new AppError('AI service rate limit exceeded', 503);
  }
  
  if (error.status === 500) {
    throw new AppError('AI service unavailable', 503);
  }
  
  throw new AppError('AI service error', 500);
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  globalErrorHandler,
  asyncHandler,
  notFoundHandler,
  formatValidationError,
  handleDatabaseError,
  handleMQTTError,
  handleAIError
};