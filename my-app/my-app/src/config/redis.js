const redis = require('redis');
const logger = require('./logger');

class RedisManager {
  constructor() {
    this.client = null;
    this.connected = false;
    this.retryAttempts = 0;
    this.maxRetries = parseInt(process.env.REDIS_MAX_RETRIES) || 5;
    this.retryDelay = parseInt(process.env.REDIS_RETRY_DELAY) || 3000;
  }

  async connect() {
    if (this.connected && this.client) {
      return this.client;
    }

    const config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB) || 0,
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'myapp:',
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
      keepAlive: 30000,
      commandTimeout: 5000,
    };

    // Build Redis URL or use provided one
    const redisUrl = process.env.REDIS_URL || 
      `redis://${config.password ? `:${config.password}@` : ''}${config.host}:${config.port}/${config.db}`;

    logger.info('Connecting to Redis...', {
      host: config.host,
      port: config.port,
      db: config.db,
      keyPrefix: config.keyPrefix
    });

    try {
      this.client = redis.createClient({
        url: redisUrl,
        ...config
      });

      this.client.on('error', (err) => {
        logger.error('Redis error', { error: err.message });
        this.connected = false;
      });

      this.client.on('connect', () => {
        logger.debug('Redis client connecting...');
      });

      this.client.on('ready', () => {
        logger.info('✅ Redis client ready');
        this.connected = true;
        this.retryAttempts = 0;
      });

      this.client.on('end', () => {
        logger.warn('Redis connection closed');
        this.connected = false;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis client reconnecting...');
      });

      await this.client.connect();
      await this.ping();

      logger.info('✅ Redis connected successfully');
      return this.client;

    } catch (error) {
      logger.error('❌ Redis connection failed', {
        error: error.message,
        attempt: this.retryAttempts + 1,
        maxRetries: this.maxRetries
      });

      if (this.retryAttempts < this.maxRetries) {
        this.retryAttempts++;
        logger.info(`Retrying Redis connection in ${this.retryDelay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.connect();
      }

      // Redis is optional, so we'll warn but not throw
      logger.warn(`Failed to connect to Redis after ${this.maxRetries} attempts, continuing without cache`);
      return null;
    }
  }

  async ping() {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    const start = Date.now();
    const result = await this.client.ping();
    const duration = Date.now() - start;

    logger.debug('Redis ping successful', { response: result, duration: `${duration}ms` });
    return result;
  }

  async get(key) {
    if (!this.connected || !this.client) {
      logger.debug('Redis not available for GET operation', { key });
      return null;
    }

    try {
      const result = await this.client.get(key);
      logger.debug('Redis GET', { key, found: !!result });
      return result;
    } catch (error) {
      logger.error('Redis GET failed', { key, error: error.message });
      return null;
    }
  }

  async set(key, value, options = {}) {
    if (!this.connected || !this.client) {
      logger.debug('Redis not available for SET operation', { key });
      return false;
    }

    try {
      const setOptions = {};
      if (options.ttl) {
        setOptions.EX = options.ttl;
      }

      const result = await this.client.set(key, value, setOptions);
      logger.debug('Redis SET', { key, ttl: options.ttl, success: result === 'OK' });
      return result === 'OK';
    } catch (error) {
      logger.error('Redis SET failed', { key, error: error.message });
      return false;
    }
  }

  async del(key) {
    if (!this.connected || !this.client) {
      logger.debug('Redis not available for DEL operation', { key });
      return false;
    }

    try {
      const result = await this.client.del(key);
      logger.debug('Redis DEL', { key, deleted: result });
      return result > 0;
    } catch (error) {
      logger.error('Redis DEL failed', { key, error: error.message });
      return false;
    }
  }

  async exists(key) {
    if (!this.connected || !this.client) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS failed', { key, error: error.message });
      return false;
    }
  }

  async increment(key, amount = 1) {
    if (!this.connected || !this.client) {
      return null;
    }

    try {
      const result = await this.client.incrBy(key, amount);
      logger.debug('Redis INCREMENT', { key, amount, result });
      return result;
    } catch (error) {
      logger.error('Redis INCREMENT failed', { key, error: error.message });
      return null;
    }
  }

  async setHash(key, field, value) {
    if (!this.connected || !this.client) {
      return false;
    }

    try {
      const result = await this.client.hSet(key, field, value);
      logger.debug('Redis HSET', { key, field, success: result >= 0 });
      return result >= 0;
    } catch (error) {
      logger.error('Redis HSET failed', { key, field, error: error.message });
      return false;
    }
  }

  async getHash(key, field) {
    if (!this.connected || !this.client) {
      return null;
    }

    try {
      const result = await this.client.hGet(key, field);
      logger.debug('Redis HGET', { key, field, found: !!result });
      return result;
    } catch (error) {
      logger.error('Redis HGET failed', { key, field, error: error.message });
      return null;
    }
  }

  async healthCheck() {
    try {
      if (!this.connected || !this.client) {
        return {
          status: 'disconnected',
          connected: false,
          timestamp: new Date().toISOString()
        };
      }

      const start = Date.now();
      await this.ping();
      const responseTime = Date.now() - start;

      return {
        status: 'healthy',
        connected: this.connected,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: this.connected,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  getStatus() {
    return {
      connected: this.connected,
      retryAttempts: this.retryAttempts,
      maxRetries: this.maxRetries,
      client: !!this.client
    };
  }

  async flushAll() {
    if (!this.connected || !this.client) {
      return false;
    }

    try {
      await this.client.flushAll();
      logger.info('Redis cache cleared');
      return true;
    } catch (error) {
      logger.error('Redis FLUSHALL failed', { error: error.message });
      return false;
    }
  }

  async close() {
    if (this.client) {
      logger.info('Closing Redis connections...');
      try {
        await this.client.quit();
        this.connected = false;
        this.client = null;
        logger.info('✅ Redis connections closed');
      } catch (error) {
        logger.warn('Error closing Redis connection', { error: error.message });
        this.client = null;
        this.connected = false;
      }
    }
  }
}

const redisManager = new RedisManager();

module.exports = redisManager;