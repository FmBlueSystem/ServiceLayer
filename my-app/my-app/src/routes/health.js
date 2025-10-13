const express = require('express');
const router = express.Router();
const database = require('../config/database');
const redis = require('../config/redis');
const platform = require('../utils/platform');
const logger = require('../config/logger');

// Basic health check endpoint
router.get('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV,
      services: {}
    };

    // Check database health
    try {
      const dbHealth = await database.healthCheck();
      healthStatus.services.database = dbHealth;
    } catch (error) {
      healthStatus.services.database = {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      healthStatus.status = 'degraded';
    }

    // Check Redis health
    try {
      const redisHealth = await redis.healthCheck();
      healthStatus.services.redis = redisHealth;
    } catch (error) {
      healthStatus.services.redis = {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      // Redis is optional, so don't mark as degraded
    }

    // Add response time
    healthStatus.responseTime = `${Date.now() - startTime}ms`;

    // Determine overall status
    const hasUnhealthyServices = Object.values(healthStatus.services)
      .some(service => service.status === 'unhealthy');
      
    if (hasUnhealthyServices && healthStatus.status === 'healthy') {
      healthStatus.status = 'degraded';
    }

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);

  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: `${Date.now() - startTime}ms`
    });
  }
});

// Detailed health check with platform information
router.get('/detailed', async (req, res) => {
  const startTime = Date.now();

  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV,
      platform: platform.getSystemSummary(),
      services: {},
      system: {},
      performance: {}
    };

    // Database health with detailed info
    try {
      const dbHealth = await database.healthCheck();
      const dbStatus = database.getStatus();
      healthStatus.services.database = {
        ...dbHealth,
        pool: dbStatus.poolSize,
        retryAttempts: dbStatus.retryAttempts
      };
    } catch (error) {
      healthStatus.services.database = {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      healthStatus.status = 'degraded';
    }

    // Redis health with detailed info
    try {
      const redisHealth = await redis.healthCheck();
      const redisStatus = redis.getStatus();
      healthStatus.services.redis = {
        ...redisHealth,
        retryAttempts: redisStatus.retryAttempts
      };
    } catch (error) {
      healthStatus.services.redis = {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }

    // System information
    healthStatus.system = {
      memory: platform.getMemoryInfo(),
      cpu: platform.getCPUInfo(),
      network: Object.keys(platform.getNetworkInfo()),
      filesystem: platform.getFileSystemInfo()
    };

    // Performance metrics
    const memUsage = process.memoryUsage();
    healthStatus.performance = {
      memoryUsage: {
        rss: platform.formatBytes(memUsage.rss),
        heapTotal: platform.formatBytes(memUsage.heapTotal),
        heapUsed: platform.formatBytes(memUsage.heapUsed),
        external: platform.formatBytes(memUsage.external)
      },
      uptime: {
        process: Math.floor(process.uptime()),
        system: Math.floor(require('os').uptime())
      },
      responseTime: `${Date.now() - startTime}ms`
    };

    // Determine overall status
    const hasUnhealthyServices = Object.values(healthStatus.services)
      .some(service => service.status === 'unhealthy');
      
    if (hasUnhealthyServices && healthStatus.status === 'healthy') {
      healthStatus.status = 'degraded';
    }

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);

  } catch (error) {
    logger.error('Detailed health check failed', { error: error.message });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: `${Date.now() - startTime}ms`
    });
  }
});

// Liveness probe (Kubernetes-style)
router.get('/live', (req, res) => {
  // Simple check - if the process is running, it's alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Readiness probe (Kubernetes-style)
router.get('/ready', async (req, res) => {
  try {
    // Check if all critical services are ready
    const checks = [];

    // Database readiness
    try {
      await database.testConnection();
      checks.push({ service: 'database', status: 'ready' });
    } catch (error) {
      checks.push({ service: 'database', status: 'not_ready', error: error.message });
    }

    // Redis readiness (optional)
    try {
      if (redis.connected) {
        await redis.ping();
        checks.push({ service: 'redis', status: 'ready' });
      } else {
        checks.push({ service: 'redis', status: 'not_ready', error: 'Not connected' });
      }
    } catch (error) {
      checks.push({ service: 'redis', status: 'not_ready', error: error.message });
    }

    const allReady = checks.every(check => check.status === 'ready' || check.service === 'redis');
    const status = allReady ? 'ready' : 'not_ready';
    const statusCode = allReady ? 200 : 503;

    res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      checks
    });

  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Startup probe (Kubernetes-style)
router.get('/startup', async (req, res) => {
  try {
    // Check if the application has started successfully
    const startupChecks = {
      database: false,
      redis: false,
      platform: false
    };

    // Database connection
    try {
      await database.testConnection();
      startupChecks.database = true;
    } catch (error) {
      // Database is required for startup
    }

    // Redis connection (optional)
    try {
      if (redis.connected) {
        await redis.ping();
      }
      startupChecks.redis = true;
    } catch (error) {
      // Redis is optional for startup
      startupChecks.redis = true;
    }

    // Platform detection
    try {
      platform.getPlatformInfo();
      startupChecks.platform = true;
    } catch (error) {
      // Platform detection should always work
    }

    const started = startupChecks.database && startupChecks.platform;
    const status = started ? 'started' : 'starting';
    const statusCode = started ? 200 : 503;

    res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      checks: startupChecks
    });

  } catch (error) {
    logger.error('Startup check failed', { error: error.message });
    
    res.status(503).json({
      status: 'failed',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Simple ping endpoint
router.get('/ping', (req, res) => {
  res.status(200).json({
    message: 'pong',
    timestamp: new Date().toISOString()
  });
});

// Version information
router.get('/version', (req, res) => {
  res.json({
    version: '1.0.0',
    name: 'my-multiplatform-app',
    environment: process.env.NODE_ENV,
    nodeVersion: process.version,
    platform: platform.getPlatformName(),
    buildPlatform: process.env.BUILD_PLATFORM,
    targetPlatform: process.env.TARGET_PLATFORM,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;