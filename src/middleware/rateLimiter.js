const rateLimit = require('express-rate-limit');
const redis = require('../config/redis');
const logger = require('../config/logger');

// Parse whitelist from environment
const whitelist = process.env.RATE_LIMIT_WHITELIST
  ? process.env.RATE_LIMIT_WHITELIST.split(',').map(ip => ip.trim())
  : [];

// Parse trusted networks from environment (CIDR format)
const trustedNetworks = process.env.RATE_LIMIT_TRUSTED_NETWORKS
  ? process.env.RATE_LIMIT_TRUSTED_NETWORKS.split(',').map(net => net.trim())
  : [];

// Function to check if IP is in CIDR range
function isIPInCIDR(ip, cidr) {
  try {
    const [range, bits = '32'] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits)) - 1);

    const ipNum = ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
    const rangeNum = range.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;

    return (ipNum & mask) === (rangeNum & mask);
  } catch (error) {
    logger.warn('Error checking CIDR range', { ip, cidr, error: error.message });
    return false;
  }
}

// Function to check if IP is trusted
function isTrustedIP(ip) {
  // Clean IPv6 mapped IPv4 addresses
  const cleanIP = ip.replace(/^::ffff:/, '');

  // Check whitelist
  if (whitelist.includes(cleanIP) || whitelist.includes(ip)) {
    return true;
  }

  // Check localhost variations
  if (cleanIP === '127.0.0.1' || cleanIP === '::1' || cleanIP === 'localhost') {
    return true;
  }

  // Check trusted networks
  for (const network of trustedNetworks) {
    if (isIPInCIDR(cleanIP, network)) {
      return true;
    }
  }

  return false;
}

// Redis store for rate limiting (fallback to memory if Redis unavailable)
class RedisStore {
  constructor() {
    this.hits = new Map();
    this.resetTime = new Map();
  }

  async get(key) {
    try {
      if (redis.connected) {
        const data = await redis.get(`rate_limit:${key}`);
        return data ? JSON.parse(data) : undefined;
      }
    } catch (error) {
      logger.warn('Redis rate limit store error', { error: error.message });
    }

    // Fallback to memory store
    return this.hits.get(key);
  }

  async set(key, value, windowMs) {
    try {
      if (redis.connected) {
        await redis.set(
          `rate_limit:${key}`, 
          JSON.stringify(value), 
          { ttl: Math.ceil(windowMs / 1000) }
        );
        return;
      }
    } catch (error) {
      logger.warn('Redis rate limit store error', { error: error.message });
    }

    // Fallback to memory store
    this.hits.set(key, value);
    this.resetTime.set(key, Date.now() + windowMs);

    // Clean up expired entries
    setTimeout(() => {
      this.hits.delete(key);
      this.resetTime.delete(key);
    }, windowMs);
  }

  async increment(key) {
    const current = await this.get(key);
    const newValue = {
      totalHits: (current?.totalHits || 0) + 1,
      resetTime: current?.resetTime || Date.now() + (15 * 60 * 1000) // 15 minutes default
    };

    return newValue;
  }

  async decrement(key) {
    const current = await this.get(key);
    if (current && current.totalHits > 0) {
      const newValue = {
        ...current,
        totalHits: current.totalHits - 1
      };
      return newValue;
    }
    return current;
  }

  async resetKey(key) {
    try {
      if (redis.connected) {
        await redis.del(`rate_limit:${key}`);
      }
    } catch (error) {
      logger.warn('Redis rate limit reset error', { error: error.message });
    }

    this.hits.delete(key);
    this.resetTime.delete(key);
  }
}

const store = new RedisStore();

// Key generator function
function generateKey(req) {
  // Use combination of IP and user ID (if authenticated)
  const ip = req.ip || req.connection.remoteAddress;
  const userId = req.user?.id || 'anonymous';
  const userAgent = req.get('User-Agent') || 'unknown';
  
  // Create a more sophisticated key that considers user context
  return `${ip}:${userId}:${Buffer.from(userAgent).toString('base64').slice(0, 10)}`;
}

// Skip function for certain requests
function skipRequest(req) {
  // Check if rate limiting is disabled
  if (process.env.RATE_LIMIT_ENABLED === 'false') {
    return true;
  }

  // Skip for trusted IPs (whitelist and internal networks)
  const clientIP = req.ip || req.connection.remoteAddress;
  if (isTrustedIP(clientIP)) {
    logger.debug('Skipping rate limit for trusted IP', { ip: clientIP });
    return true;
  }

  // Skip rate limiting for health checks
  if (req.path === '/health' || req.path === '/ping' || req.path === '/api-info' || req.path === '/info') {
    return true;
  }

  // Skip for static files (CSS, JS, images, etc.)
  const staticExtensions = ['.css', '.js', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.map'];
  if (staticExtensions.some(ext => req.path.endsWith(ext))) {
    return true;
  }

  // Skip for HTML pages (not API endpoints)
  if (req.path.endsWith('.html') ||
      req.path === '/' ||
      req.path === '/login' ||
      req.path === '/dashboard' ||
      req.path === '/articulos' ||
      req.path === '/ordenes-venta' ||
      req.path === '/ofertas-venta' ||
      req.path === '/reportes-eeff' ||
      req.path === '/tipos-cambio' ||
      req.path === '/fichas-tecnicas') {
    return true;
  }

  // Skip for admin users (if implemented)
  if (req.user && req.user.role === 'admin') {
    return true;
  }

  return false;
}

// Custom handler for rate limit exceeded
function onLimitReached(req, res, next, options) {
  const requestId = req.requestId || 'unknown';
  const ip = req.ip;
  const userAgent = req.get('User-Agent');

  logger.warn('Rate limit exceeded', {
    requestId,
    ip,
    userAgent,
    endpoint: req.originalUrl,
    method: req.method,
    limit: options.max,
    windowMs: options.windowMs
  });

  res.status(429).json({
    error: {
      type: 'Rate Limit Exceeded',
      message: 'Too many requests from this IP, please try again later',
      requestId,
      retryAfter: Math.round(options.windowMs / 1000),
      timestamp: new Date().toISOString()
    }
  });
}

// Log rate limiting configuration
logger.info('Rate limiting configuration loaded', {
  enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10000,
  apiMaxRequests: parseInt(process.env.API_RATE_LIMIT_MAX) || 50000,
  whitelistedIPs: whitelist.length,
  trustedNetworks: trustedNetworks.length
});

// Basic rate limiter configuration
const basicLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10000, // limit each IP to 10000 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: generateKey,
  skip: skipRequest,
  handler: onLimitReached,
  store: {
    incr: async (key, cb) => {
      try {
        const result = await store.increment(key);
        await store.set(key, result, basicLimiter.windowMs);
        cb(null, result.totalHits, new Date(result.resetTime));
      } catch (error) {
        cb(error);
      }
    },
    decrement: async (key, cb) => {
      try {
        const result = await store.decrement(key);
        if (result) {
          await store.set(key, result, basicLimiter.windowMs);
        }
        cb(null, result?.totalHits || 0);
      } catch (error) {
        cb(error);
      }
    },
    resetKey: async (key, cb) => {
      try {
        await store.resetKey(key);
        cb(null);
      } catch (error) {
        cb(error);
      }
    }
  }
});

// Strict rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs for auth endpoints
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  skip: skipRequest, // Also skip trusted IPs for auth
  handler: onLimitReached,
  skipSuccessfulRequests: true // Don't count successful requests
});

// API rate limiter for general API endpoints
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.API_RATE_LIMIT_MAX) || 50000, // Higher limit for API
  message: 'API rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  skip: skipRequest,
  handler: onLimitReached
});

// File upload rate limiter
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 uploads per hour
  message: 'Upload rate limit exceeded, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: onLimitReached
});

// Rate limiter for password reset
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password reset requests per hour
  message: 'Too many password reset attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: onLimitReached
});

module.exports = {
  basicLimiter,
  authLimiter,
  apiLimiter,
  uploadLimiter,
  passwordResetLimiter,
  // Export the basic limiter as default
  default: basicLimiter
};