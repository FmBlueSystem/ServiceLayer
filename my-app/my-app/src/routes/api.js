const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const logger = require('../config/logger');
const database = require('../config/database');
const redis = require('../config/redis');
const platform = require('../utils/platform');
const { 
  asyncHandler, 
  ValidationError, 
  NotFoundError, 
  UnauthorizedError 
} = require('../middleware/errorHandler');
const { apiLimiter, authLimiter } = require('../middleware/rateLimiter');
const sapRoutes = require('./sap');
const sapValidationRoutes = require('./sapValidation');

// Apply API rate limiting to all routes
router.use(apiLimiter);

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }
  next();
};

// Authentication middleware
const authenticateToken = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new UnauthorizedError('Access token required');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    req.user = decoded;
    next();
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
});

const ensureLocalDatabaseEnabled = (req, res, next) => {
  if (typeof database.isEnabled === 'function' && !database.isEnabled()) {
    return res.status(503).json({
      error: {
        type: 'ServiceUnavailable',
        message: 'Local user storage is disabled. Use the SAP Service Layer authentication endpoints.'
      }
    });
  }
  return next();
};

// API Info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'My Multiplatform App API',
    version: '1.0.0',
    description: 'Cross-platform containerized API',
    platform: platform.getPlatformName(),
    environment: process.env.NODE_ENV,
    endpoints: {
      health: '/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/profile',
        refresh: 'POST /api/auth/refresh'
      },
      users: {
        list: 'GET /api/users',
        create: 'POST /api/users',
        get: 'GET /api/users/:id',
        update: 'PUT /api/users/:id',
        delete: 'DELETE /api/users/:id'
      },
      cache: {
        get: 'GET /api/cache/:key',
        set: 'POST /api/cache/:key',
        delete: 'DELETE /api/cache/:key',
        clear: 'DELETE /api/cache'
      },
      system: {
        info: 'GET /api/system/info',
        metrics: 'GET /api/system/metrics'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// App Configuration endpoint
router.get('/config', (req, res) => {
  res.json({
    appName: process.env.APP_DISPLAY_NAME || 'My Application',
    appVersion: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

router.post('/auth/register', 
  ensureLocalDatabaseEnabled,
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
    body('firstName').trim().isLength({ min: 1, max: 100 }),
    body('lastName').trim().isLength({ min: 1, max: 100 }),
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await database.query(
      'SELECT id FROM users WHERE email = $1', 
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: {
          type: 'Conflict',
          message: 'User with this email already exists'
        }
      });
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await database.query(`
      INSERT INTO users (email, password_hash, first_name, last_name)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, first_name, last_name, created_at
    `, [email, passwordHash, firstName, lastName]);

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        type: 'access'
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    logger.info('User registered successfully', { 
      userId: user.id, 
      email: user.email,
      requestId: req.requestId 
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        createdAt: user.created_at
      },
      token
    });
  })
);

router.post('/auth/login',
  ensureLocalDatabaseEnabled,
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 1 })
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Find user
    const result = await database.query(
      'SELECT id, email, password_hash, first_name, last_name, is_active FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw new UnauthorizedError('Account is deactivated');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        type: 'access'
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    logger.info('User logged in successfully', { 
      userId: user.id, 
      email: user.email,
      requestId: req.requestId 
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      },
      token
    });
  })
);

router.get('/auth/profile',
  ensureLocalDatabaseEnabled,
  authenticateToken,
  asyncHandler(async (req, res) => {
    const result = await database.query(
      'SELECT id, email, first_name, last_name, is_active, created_at, updated_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    const user = result.rows[0];

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isActive: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  })
);

// ============================================================================
// USER MANAGEMENT ROUTES
// ============================================================================

router.get('/users',
  ensureLocalDatabaseEnabled,
  authenticateToken,
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const offset = (page - 1) * limit;

    const result = await database.query(`
      SELECT id, email, first_name, last_name, is_active, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await database.query('SELECT COUNT(*) FROM users');
    const total = parseInt(countResult.rows[0].count);

    res.json({
      users: result.rows.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isActive: user.is_active,
        createdAt: user.created_at
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  })
);

// ============================================================================
// CACHE MANAGEMENT ROUTES
// ============================================================================

router.get('/cache/:key',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const value = await redis.get(key);

    if (value === null) {
      throw new NotFoundError('Cache key not found');
    }

    res.json({
      key,
      value,
      timestamp: new Date().toISOString()
    });
  })
);

router.post('/cache/:key',
  authenticateToken,
  [body('value').notEmpty()],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const { value, ttl } = req.body;

    const success = await redis.set(key, JSON.stringify(value), { ttl });

    if (!success) {
      return res.status(503).json({
        error: {
          type: 'Service Unavailable',
          message: 'Cache service unavailable'
        }
      });
    }

    res.json({
      message: 'Cache entry created',
      key,
      ttl,
      timestamp: new Date().toISOString()
    });
  })
);

router.delete('/cache/:key',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const deleted = await redis.del(key);

    res.json({
      message: deleted ? 'Cache entry deleted' : 'Cache entry not found',
      key,
      deleted,
      timestamp: new Date().toISOString()
    });
  })
);

router.delete('/cache',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const success = await redis.flushAll();

    if (!success) {
      return res.status(503).json({
        error: {
          type: 'Service Unavailable',
          message: 'Cache service unavailable'
        }
      });
    }

    res.json({
      message: 'All cache entries cleared',
      timestamp: new Date().toISOString()
    });
  })
);

// ============================================================================
// SYSTEM INFORMATION ROUTES
// ============================================================================

router.get('/system/info',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const systemInfo = {
      application: {
        name: 'my-multiplatform-app',
        version: '1.0.0',
        environment: process.env.NODE_ENV,
        nodeVersion: process.version,
        uptime: process.uptime()
      },
      platform: platform.getSystemSummary(),
      container: {
        buildPlatform: process.env.BUILD_PLATFORM,
        targetPlatform: process.env.TARGET_PLATFORM,
        isInContainer: platform.isInContainer()
      },
      services: {
        database: database.getStatus(),
        redis: redis.getStatus()
      },
      timestamp: new Date().toISOString()
    };

    res.json(systemInfo);
  })
);

router.get('/system/metrics',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const metrics = {
      memory: platform.getMemoryInfo(),
      cpu: platform.getCPUInfo(),
      network: platform.getNetworkInfo(),
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      timestamp: new Date().toISOString()
    };

    res.json(metrics);
  })
);

// ============================================================================
// SAP INTEGRATION ROUTES
// ============================================================================

router.use('/sap', sapRoutes);
router.use('/sap-validation', sapValidationRoutes);

module.exports = router;
