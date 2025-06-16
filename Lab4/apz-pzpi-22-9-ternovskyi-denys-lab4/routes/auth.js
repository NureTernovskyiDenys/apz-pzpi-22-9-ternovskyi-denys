const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const User = require('../models/User');
const { 
  generateToken, 
  generateRefreshToken, 
  verifyRefreshToken, 
  authenticateToken,
  sensitiveOperationLimit 
} = require('../middleware/auth');
const { 
  asyncHandler, 
  ValidationError, 
  AuthenticationError,
  ConflictError,
  formatValidationError 
} = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // limit each IP to 5 login requests per windowMs
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.'
  },
  skipSuccessfulRequests: true,
});

// Validation rules
const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must be at least 6 characters with uppercase, lowercase, and number'),
  body('firstName')
    .isLength({ min: 1, max: 50 })
    .trim()
    .withMessage('First name is required and must be less than 50 characters'),
  body('lastName')
    .isLength({ min: 1, max: 50 })
    .trim()
    .withMessage('Last name is required and must be less than 50 characters')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must be at least 6 characters with uppercase, lowercase, and number'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    })
];

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', authLimiter, registerValidation, asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = formatValidationError(errors);
    throw new ValidationError('Validation failed', formattedErrors);
  }

  const { username, email, password, firstName, lastName } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }]
  });

  if (existingUser) {
    if (existingUser.email === email) {
      throw new ConflictError('User with this email already exists');
    }
    throw new ConflictError('Username already taken');
  }

  // Create new user
  const user = new User({
    username,
    email,
    password, // Will be hashed by pre-save middleware
    firstName,
    lastName
  });

  await user.save();

  // Generate tokens
  const accessToken = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Log successful registration
  logger.logAuth('register', user._id, req.ip, req.get('User-Agent'), true, {
    username,
    email
  });

  // Remove password from response
  const userResponse = user.getPublicProfile();

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: userResponse,
      accessToken,
      refreshToken
    }
  });
}));

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginLimiter, loginValidation, asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const { email, password } = req.body;

  // Find user and include password for comparison
  const user = await User.findOne({ email }).select('+password');
  
  if (!user || !user.isActive) {
    logger.logAuth('login', null, req.ip, req.get('User-Agent'), false, { email, reason: 'user_not_found' });
    throw new AuthenticationError('Invalid email or password');
  }

  // Check password
  const isPasswordValid = await user.comparePassword(password);
  
  if (!isPasswordValid) {
    logger.logAuth('login', user._id, req.ip, req.get('User-Agent'), false, { reason: 'invalid_password' });
    throw new AuthenticationError('Invalid email or password');
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate tokens
  const accessToken = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Log successful login
  logger.logAuth('login', user._id, req.ip, req.get('User-Agent'), true);

  // Remove password from response
  const userResponse = user.getPublicProfile();

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: userResponse,
      accessToken,
      refreshToken
    }
  });
}));

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AuthenticationError('Refresh token required');
  }

  const decoded = verifyRefreshToken(refreshToken);
  
  if (!decoded) {
    throw new AuthenticationError('Invalid refresh token');
  }

  // Check if user still exists and is active
  const user = await User.findById(decoded.userId);
  
  if (!user || !user.isActive) {
    throw new AuthenticationError('Invalid refresh token');
  }

  // Generate new access token
  const accessToken = generateToken(user._id);

  logger.logAuth('refresh_token', user._id, req.ip, req.get('User-Agent'), true);

  res.json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      accessToken
    }
  });
}));

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  logger.logAuth('logout', req.user._id, req.ip, req.get('User-Agent'), true);

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('devices', 'name deviceId status lastSeen');

  res.json({
    success: true,
    data: {
      user: user.getPublicProfile()
    }
  });
}));

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticateToken, [
  body('firstName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .trim(),
  body('lastName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .trim(),
  body('preferences.timezone')
    .optional()
    .isString(),
  body('preferences.language')
    .optional()
    .isIn(['en', 'uk', 'ru']),
  body('preferences.workSchedule.startTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('preferences.workSchedule.endTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const updates = req.body;
  const user = await User.findById(req.user._id);

  // Update fields
  if (updates.firstName) user.firstName = updates.firstName;
  if (updates.lastName) user.lastName = updates.lastName;
  if (updates.preferences) {
    user.preferences = { ...user.preferences, ...updates.preferences };
  }

  await user.save();

  logger.logUserAction(user._id, 'profile_updated', { updatedFields: Object.keys(updates) });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: user.getPublicProfile()
    }
  });
}));

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', 
  authenticateToken, 
  sensitiveOperationLimit(3), 
  changePasswordValidation, 
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', formatValidationError(errors));
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      logger.logAuth('change_password', user._id, req.ip, req.get('User-Agent'), false, { reason: 'invalid_current_password' });
      throw new AuthenticationError('Current password is incorrect');
    }

    // Update password
    user.password = newPassword; // Will be hashed by pre-save middleware
    await user.save();

    logger.logAuth('change_password', user._id, req.ip, req.get('User-Agent'), true);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  })
);

// @route   POST /api/auth/forgot-password
// @desc    Request password reset (placeholder for email functionality)
// @access  Public
router.post('/forgot-password', authLimiter, [
  body('email').isEmail().normalizeEmail()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', formatValidationError(errors));
  }

  const { email } = req.body;
  const user = await User.findOne({ email });

  // Always return success for security (don't reveal if email exists)
  logger.logAuth('forgot_password_requested', user?._id, req.ip, req.get('User-Agent'), true, { email });

  res.json({
    success: true,
    message: 'If an account with that email exists, password reset instructions will be sent.'
  });
}));

// @route   DELETE /api/auth/account
// @desc    Deactivate user account
// @access  Private
router.delete('/account', 
  authenticateToken, 
  sensitiveOperationLimit(2), 
  [body('password').notEmpty().withMessage('Password required for account deactivation')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', formatValidationError(errors));
    }

    const { password } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      logger.logAuth('account_deactivation', user._id, req.ip, req.get('User-Agent'), false, { reason: 'invalid_password' });
      throw new AuthenticationError('Password is incorrect');
    }

    // Deactivate account instead of deleting
    user.isActive = false;
    await user.save();

    logger.logAuth('account_deactivated', user._id, req.ip, req.get('User-Agent'), true);

    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });
  })
);

module.exports = router;