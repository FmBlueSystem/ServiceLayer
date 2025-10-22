const { Pool } = require('pg');
const logger = require('./logger');

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.connected = false;
    this.retryAttempts = 0;
    this.maxRetries = parseInt(process.env.DB_MAX_RETRIES) || 5;
    this.retryDelay = parseInt(process.env.DB_RETRY_DELAY) || 5000;
    this.disabled = process.env.DISABLE_LOCAL_DATABASE === 'true';
  }

  isEnabled() {
    return !this.disabled;
  }

  isDisabled() {
    return this.disabled;
  }

  async connect() {
    if (this.disabled) {
      logger.info('Local PostgreSQL storage disabled via configuration (DISABLE_LOCAL_DATABASE=true)');
      return null;
    }

    if (this.connected) {
      return this.pool;
    }

    const config = {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT) || 5432,
      database: process.env.POSTGRES_DB || 'myapp',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'password',
      max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS) || 20,
      idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT) || 10000,
      connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT) || 5000,
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

    logger.info('Connecting to PostgreSQL database...', {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      ssl: !!config.ssl
    });

    try {
      this.pool = new Pool(config);

      this.pool.on('error', (err) => {
        logger.error('Unexpected database error', { error: err.message });
        this.connected = false;
      });

      this.pool.on('connect', (client) => {
        logger.debug('Database client connected', { processId: client.processID });
      });

      this.pool.on('remove', (client) => {
        logger.debug('Database client removed', { processId: client.processID });
      });

      await this.testConnection();
      this.connected = true;
      this.retryAttempts = 0;

      logger.info('✅ Database connected successfully');
      return this.pool;

    } catch (error) {
      logger.error('❌ Database connection failed', { 
        error: error.message,
        attempt: this.retryAttempts + 1,
        maxRetries: this.maxRetries
      });

      if (this.retryAttempts < this.maxRetries) {
        this.retryAttempts++;
        logger.info(`Retrying database connection in ${this.retryDelay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.connect();
      }

      throw new Error(`Failed to connect to database after ${this.maxRetries} attempts: ${error.message}`);
    }
  }

  async testConnection() {
    if (this.disabled) {
      logger.debug('Skipping database test connection because local storage is disabled');
      return { disabled: true };
    }

    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT NOW() as current_time, version() as version');
      const { current_time, version } = result.rows[0];
      
      logger.info('Database connection test passed', {
        currentTime: current_time,
        version: version.split(' ')[0] + ' ' + version.split(' ')[1]
      });

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async query(text, params = []) {
    if (this.disabled) {
      const error = new Error('Local database disabled (DISABLE_LOCAL_DATABASE=true)');
      error.code = 'DATABASE_DISABLED';
      throw error;
    }

    if (!this.connected || !this.pool) {
      throw new Error('Database not connected');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      logger.debug('Database query executed', {
        query: text,
        duration: `${duration}ms`,
        rowCount: result.rowCount
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Database query failed', {
        query: text,
        duration: `${duration}ms`,
        error: error.message
      });
      throw error;
    }
  }

  async transaction(callback) {
    if (this.disabled) {
      const error = new Error('Local database disabled (DISABLE_LOCAL_DATABASE=true)');
      error.code = 'DATABASE_DISABLED';
      throw error;
    }

    if (!this.connected || !this.pool) {
      throw new Error('Database not connected');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck() {
    if (this.disabled) {
      return {
        status: 'disabled',
        connected: false,
        timestamp: new Date().toISOString(),
        message: 'Local database disabled (DISABLE_LOCAL_DATABASE=true)'
      };
    }

    const start = Date.now();
    try {
      await this.query('SELECT 1 as healthy');
      return {
        status: 'healthy',
        connected: this.connected,
        timestamp: new Date().toISOString(),
        responseTime: `${Date.now() - start}ms`
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
      enabled: !this.disabled,
      connected: this.connected,
      poolSize: this.pool ? {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount
      } : null,
      retryAttempts: this.retryAttempts,
      maxRetries: this.maxRetries
    };
  }

  async close() {
    if (this.disabled) {
      return;
    }

    if (this.pool) {
      logger.info('Closing database connections...');
      await this.pool.end();
      this.connected = false;
      this.pool = null;
      logger.info('✅ Database connections closed');
    }
  }

  async createTables() {
    if (this.disabled) {
      logger.info('Skipping local table creation because DISABLE_LOCAL_DATABASE=true');
      return;
    }

    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createSessionsTable = `
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR(255) PRIMARY KEY,
        data JSONB NOT NULL,
        expires TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
    `;

    try {
      await this.query(createUsersTable);
      await this.query(createSessionsTable);
      await this.query(createIndexes);
      
      logger.info('✅ Database tables created/verified successfully');
    } catch (error) {
      logger.error('❌ Failed to create database tables', { error: error.message });
      throw error;
    }
  }
}

const database = new DatabaseManager();

module.exports = database;
