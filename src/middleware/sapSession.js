const redis = require('../config/redis');
const logger = require('../config/logger');

/**
 * SAP Session Manager
 * Handles SessionId storage and validation for Service Layer authentication
 */
class SAPSessionManager {
  constructor() {
    this.sessions = new Map(); // In-memory fallback if Redis is unavailable
    this.sessionPrefix = 'sap_session:';
    this.sessionTimeout = 30 * 60; // 30 minutes in seconds
  }

  /**
   * Store a session
   */
  async storeSession(sessionId, userInfo, companyDB) {
    const sessionData = {
      sessionId,
      username: userInfo.username,
      companyDB,
      loginTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      active: true
    };

    const key = `${this.sessionPrefix}${sessionId}`;

    try {
      // Try to store in Redis first
      if (await redis.ping()) {
        await redis.set(key, JSON.stringify(sessionData), { ttl: this.sessionTimeout });
        logger.info('Session stored in Redis', { sessionId, companyDB, username: userInfo.username });
      } else {
        // Fallback to memory
        this.sessions.set(key, sessionData);
        logger.info('Session stored in memory (Redis unavailable)', { sessionId, companyDB });
      }

      return true;
    } catch (error) {
      logger.error('Failed to store session', { error: error.message, sessionId });
      // Fallback to memory
      this.sessions.set(key, sessionData);
      return true;
    }
  }

  /**
   * Get session data
   */
  async getSession(sessionId) {
    const key = `${this.sessionPrefix}${sessionId}`;

    try {
      // Try Redis first
      if (await redis.ping()) {
        const sessionData = await redis.get(key);
        if (sessionData) {
          return JSON.parse(sessionData);
        }
      }
    } catch (error) {
      logger.warn('Failed to get session from Redis', { error: error.message, sessionId });
    }

    // Fallback to memory
    return this.sessions.get(key);
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId) {
    const sessionData = await this.getSession(sessionId);
    if (sessionData) {
      sessionData.lastActivity = new Date().toISOString();
      return await this.storeSession(sessionId, sessionData, sessionData.companyDB);
    }
    return false;
  }

  /**
   * Remove session
   */
  async removeSession(sessionId) {
    const key = `${this.sessionPrefix}${sessionId}`;

    try {
      // Remove from Redis
      if (await redis.ping()) {
        await redis.del(key);
        logger.info('Session removed from Redis', { sessionId });
      }
    } catch (error) {
      logger.warn('Failed to remove session from Redis', { error: error.message, sessionId });
    }

    // Remove from memory
    this.sessions.delete(key);
    return true;
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(username) {
    const userSessions = [];

    try {
      // Check Redis
      if (await redis.ping()) {
        const keys = await redis.keys(`${this.sessionPrefix}*`);
        for (const key of keys) {
          const sessionData = await redis.get(key);
          if (sessionData) {
            const parsed = JSON.parse(sessionData);
            if (parsed.username === username && parsed.active) {
              userSessions.push(parsed);
            }
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to get user sessions from Redis', { error: error.message, username });
    }

    // Check memory fallback
    for (const [key, sessionData] of this.sessions.entries()) {
      if (sessionData.username === username && sessionData.active) {
        userSessions.push(sessionData);
      }
    }

    return userSessions;
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    const expiredKeys = [];
    const cutoff = new Date(Date.now() - (this.sessionTimeout * 1000));

    // Check memory sessions
    for (const [key, sessionData] of this.sessions.entries()) {
      const lastActivity = new Date(sessionData.lastActivity);
      if (lastActivity < cutoff) {
        expiredKeys.push(key);
      }
    }

    // Remove expired sessions from memory
    for (const key of expiredKeys) {
      this.sessions.delete(key);
      logger.info('Expired session removed from memory', { key });
    }

    // Redis TTL handles expiration automatically
    return expiredKeys.length;
  }

  /**
   * Get session statistics
   */
  async getSessionStats() {
    let redisCount = 0;
    let memoryCount = this.sessions.size;

    try {
      if (await redis.ping()) {
        const keys = await redis.keys(`${this.sessionPrefix}*`);
        redisCount = keys.length;
      }
    } catch (error) {
      logger.warn('Failed to get Redis session stats', { error: error.message });
    }

    return {
      redis: redisCount,
      memory: memoryCount,
      total: redisCount + memoryCount,
      timeout: this.sessionTimeout,
      timestamp: new Date().toISOString()
    };
  }
}

// Create singleton instance
const sessionManager = new SAPSessionManager();

/**
 * Express middleware to validate SAP session
 */
const validateSAPSession = async (req, res, next) => {
  const sessionId = req.headers['x-sap-session'] || req.body.sessionId || req.query.sessionId;

  if (!sessionId) {
    return res.status(401).json({
      success: false,
      error: 'SAP session required',
      code: 'NO_SESSION',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const sessionData = await sessionManager.getSession(sessionId);

    if (!sessionData || !sessionData.active) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired SAP session',
        code: 'INVALID_SESSION',
        timestamp: new Date().toISOString()
      });
    }

    // Update last activity
    await sessionManager.updateSessionActivity(sessionId);

    // Add session data to request
    req.sapSession = sessionData;
    next();
  } catch (error) {
    logger.error('Session validation error', { error: error.message, sessionId });
    return res.status(500).json({
      success: false,
      error: 'Session validation failed',
      code: 'SESSION_ERROR',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Optional middleware - don't fail if no session
 */
const optionalSAPSession = async (req, res, next) => {
  const sessionId = req.headers['x-sap-session'] || req.body.sessionId || req.query.sessionId;

  if (sessionId) {
    try {
      const sessionData = await sessionManager.getSession(sessionId);
      if (sessionData && sessionData.active) {
        await sessionManager.updateSessionActivity(sessionId);
        req.sapSession = sessionData;
      }
    } catch (error) {
      logger.warn('Optional session validation error', { error: error.message, sessionId });
    }
  }

  next();
};

// Start cleanup job
setInterval(async () => {
  try {
    const cleanedCount = await sessionManager.cleanupExpiredSessions();
    if (cleanedCount > 0) {
      logger.info('Session cleanup completed', { cleanedSessions: cleanedCount });
    }
  } catch (error) {
    logger.error('Session cleanup error', { error: error.message });
  }
}, 5 * 60 * 1000); // Run every 5 minutes

module.exports = {
  sessionManager,
  validateSAPSession,
  optionalSAPSession
};