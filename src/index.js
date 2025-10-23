require('dotenv').config();
const express = require('express');
const https = require('https');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const logger = require('./config/logger');
const database = require('./config/database');
const redis = require('./config/redis');
const platform = require('./utils/platform');
const { errorHandler } = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');
const healthRoutes = require('./routes/health');
const apiRoutes = require('./routes/api');

class Application {
  constructor() {
    this.app = express();
    this.httpServer = null;
    this.httpsServer = null;
    this.shutdownInProgress = false;

    this.setupSignalHandlers();
  }

  async initialize() {
    try {
      logger.info('🚀 Starting application initialization...', {
        platform: platform.getPlatformInfo(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV
      });

      await this.setupMiddleware();
      await this.setupDatabase();
      await this.setupRedis();
      await this.setupRoutes();
      await this.setupErrorHandling();
      
      logger.info('✅ Application initialized successfully');
      
    } catch (error) {
      logger.error('❌ Failed to initialize application', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async setupMiddleware() {
    logger.info('🔧 Setting up middleware...');

    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
          scriptSrcAttr: ["'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          formAction: ["'self'", "javascript:"],
          fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
          connectSrc: ["'self'", "https:", "wss:"],
          upgradeInsecureRequests: null, // Desactivar upgrade automático a HTTPS en desarrollo
        },
      },
      hsts: process.env.NODE_ENV === 'production',
    }));

    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: process.env.CORS_CREDENTIALS === 'true',
    }));

    this.app.use(compression());

    this.app.use(morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim(), { source: 'http' })
      }
    }));

    this.app.use(express.json({ 
      limit: process.env.MAX_REQUEST_SIZE || '10mb',
      verify: (req, res, buf, encoding) => {
        req.rawBody = buf;
      }
    }));
    
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    this.app.use(express.static(path.join(__dirname, '../public'), {
      maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
      etag: true,
      lastModified: true
    }));

    this.app.use(rateLimiter.basicLimiter || rateLimiter);

    this.app.use((req, res, next) => {
      req.startTime = Date.now();
      req.requestId = require('uuid').v4();
      
      res.on('finish', () => {
        const duration = Date.now() - req.startTime;
        logger.info('Request completed', {
          requestId: req.requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      });
      
      next();
    });
  }

  async setupDatabase() {
    logger.info('🗄️  Setting up database connection...');

    if (typeof database.isEnabled === 'function' && !database.isEnabled()) {
      logger.info('Skipping database initialization because local storage is disabled');
      return;
    }

    const allowStartWithoutDb = (
      process.env.ALLOW_START_WITHOUT_DATABASE === 'true'
      || process.env.NODE_ENV !== 'production'
    );

    try {
      await database.connect();
      await database.testConnection();
      logger.info('✅ Database connected successfully');
    } catch (error) {
      if (allowStartWithoutDb) {
        logger.warn('⚠️  Database connection unavailable, continuing without database', {
          error: error.message,
          environment: process.env.NODE_ENV,
          allowStartWithoutDb
        });
      } else {
        logger.error('❌ Database connection failed', { error: error.message });
        throw error;
      }
    }
  }

  async setupRedis() {
    logger.info('🔄 Setting up Redis connection...');
    
    try {
      await redis.connect();
      await redis.ping();
      logger.info('✅ Redis connected successfully');
    } catch (error) {
      logger.warn('⚠️  Redis connection failed, continuing without cache', { error: error.message });
    }
  }

  setupRoutes() {
    logger.info('🛣️  Setting up routes...');

    this.app.use('/health', healthRoutes);
    this.app.use('/api', apiRoutes);

    // Serve main login page
    this.app.get('/login', (req, res) => {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.sendFile(path.join(__dirname, '../public/login.html'));
    });

    // Serve dashboard page (protected route - client-side auth check)
    this.app.get('/dashboard', (req, res) => {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.sendFile(path.join(__dirname, '../public/dashboard.html'));
    });

    // Serve articulos page (protected route - client-side auth check)
    this.app.get('/articulos', (req, res) => {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.sendFile(path.join(__dirname, '../public/articulos.html'));
    });

    // Serve sales orders page (protected route - client-side auth check)
    this.app.get('/ordenes-venta', (req, res) => {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.sendFile(path.join(__dirname, '../public/ordenes-venta.html'));
    });

    // Serve sales quotations page (protected route - client-side auth check)
    this.app.get('/ofertas-venta', (req, res) => {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.sendFile(path.join(__dirname, '../public/ofertas-venta.html'));
    });

    // Serve financial reports page (protected route - client-side auth check)
    this.app.get('/reportes-eeff', (req, res) => {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.sendFile(path.join(__dirname, '../public/reportes-eeff.html'));
    });

    // Serve exchange rates page (protected route - client-side auth check)
    this.app.get('/tipos-cambio', (req, res) => {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.sendFile(path.join(__dirname, '../public/tipos-cambio.html'));
    });

    // Serve fichas tecnicas page (protected route - client-side auth check)
    this.app.get('/fichas-tecnicas', (req, res) => {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.sendFile(path.join(__dirname, '../public/fichas-tecnicas.html'));
    });

    // Serve admin permisos page (protected route - client-side auth check)
    this.app.get('/admin-permisos', (req, res) => {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.sendFile(path.join(__dirname, '../public/admin-permisos.html'));
    });

    // Serve system config page (protected route - client-side auth check)
    this.app.get('/config-sistema', (req, res) => {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.sendFile(path.join(__dirname, '../public/config-sistema.html'));
    });

    // Redirect root to login page
    this.app.get('/', (req, res) => {
      res.redirect('/login');
    });

    // API info endpoint (keep for backwards compatibility)
    this.app.get('/api-info', (req, res) => {
      res.json({
        name: 'My Multiplatform App',
        version: '1.0.0',
        environment: process.env.NODE_ENV,
        platform: platform.getPlatformInfo(),
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    this.app.get('/info', (req, res) => {
      res.json({
        application: {
          name: 'my-multiplatform-app',
          version: '1.0.0',
          environment: process.env.NODE_ENV,
          nodeVersion: process.version,
          platform: platform.getPlatformInfo(),
        },
        container: {
          buildPlatform: process.env.BUILD_PLATFORM,
          targetPlatform: process.env.TARGET_PLATFORM,
          architecture: process.arch,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        },
        services: {
          database: database.getStatus(),
          redis: redis.getStatus(),
        },
        timestamp: new Date().toISOString()
      });
    });

    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });
  }

  setupErrorHandling() {
    logger.info('⚠️  Setting up error handling...');
    
    this.app.use(errorHandler);

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason, promise });
      this.gracefulShutdown('UNHANDLED_REJECTION');
    });
  }

  setupSignalHandlers() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach((signal) => {
      process.on(signal, () => {
        logger.info(`Received ${signal}, starting graceful shutdown...`);
        this.gracefulShutdown(signal);
      });
    });
  }

  async start() {
    const httpPort = parseInt(process.env.HTTP_PORT) || 80;
    const httpsPort = parseInt(process.env.HTTPS_PORT) || 443;
    const host = process.env.HOST || '0.0.0.0';
    const enableHttps = process.env.ENABLE_HTTPS !== 'false';

    // SSL Certificate paths
    const certPath = path.join(__dirname, '../docker/ssl/cert.pem');
    const keyPath = path.join(__dirname, '../docker/ssl/key.pem');

    // Check if SSL certificates exist
    const sslAvailable = fs.existsSync(certPath) && fs.existsSync(keyPath);

    if (enableHttps && sslAvailable) {
      // HTTPS enabled - start both HTTP (redirect) and HTTPS servers
      const options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };

      // HTTP server - redirects to HTTPS
      const redirectApp = express();
      redirectApp.use((req, res) => {
        res.redirect(301, `https://${req.hostname}:${httpsPort}${req.url}`);
      });

      await new Promise((resolve, reject) => {
        this.httpServer = redirectApp.listen(httpPort, host, (error) => {
          if (error) {
            logger.error('❌ Failed to start HTTP redirect server', { error: error.message });
            reject(error);
          } else {
            logger.info(`🔀 HTTP redirect server started`, { port: httpPort, host });
            resolve();
          }
        });

        this.httpServer.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            logger.warn(`⚠️  Port ${httpPort} is already in use, skipping HTTP redirect server`);
            resolve();
          } else {
            logger.error('❌ HTTP server error', { error: error.message });
            reject(error);
          }
        });
      });

      // HTTPS server - main application
      return new Promise((resolve, reject) => {
        this.httpsServer = https.createServer(options, this.app);

        this.httpsServer.listen(httpsPort, host, (error) => {
          if (error) {
            logger.error('❌ Failed to start HTTPS server', { error: error.message });
            reject(error);
          } else {
            logger.info(`🔒 HTTPS server started successfully`, {
              port: httpsPort,
              host,
              environment: process.env.NODE_ENV,
              platform: platform.getPlatformInfo(),
              pid: process.pid
            });
            resolve(this.httpsServer);
          }
        });

        this.httpsServer.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            logger.error(`❌ Port ${httpsPort} is already in use`);
          } else {
            logger.error('❌ HTTPS server error', { error: error.message });
          }
          reject(error);
        });
      });
    } else {
      // HTTP only mode (fallback)
      const port = process.env.PORT || 3000;
      if (!sslAvailable) {
        logger.warn('⚠️  SSL certificates not found, running in HTTP-only mode');
      }

      return new Promise((resolve, reject) => {
        this.httpServer = this.app.listen(port, host, (error) => {
          if (error) {
            logger.error('❌ Failed to start HTTP server', { error: error.message });
            reject(error);
          } else {
            logger.info(`🚀 HTTP server started successfully`, {
              port,
              host,
              environment: process.env.NODE_ENV,
              platform: platform.getPlatformInfo(),
              pid: process.pid
            });
            resolve(this.httpServer);
          }
        });

        this.httpServer.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            logger.error(`❌ Port ${port} is already in use`);
          } else {
            logger.error('❌ HTTP server error', { error: error.message });
          }
          reject(error);
        });
      });
    }
  }

  async gracefulShutdown(signal) {
    if (this.shutdownInProgress) {
      logger.warn('Shutdown already in progress, forcing exit...');
      process.exit(1);
    }

    this.shutdownInProgress = true;
    const timeout = parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT) || 10000;

    logger.info(`Starting graceful shutdown (signal: ${signal})...`, { timeout });

    const shutdownTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, timeout);

    try {
      // Close HTTP server
      if (this.httpServer) {
        logger.info('Closing HTTP server...');
        await new Promise((resolve) => {
          this.httpServer.close(resolve);
        });
        logger.info('✅ HTTP server closed');
      }

      // Close HTTPS server
      if (this.httpsServer) {
        logger.info('Closing HTTPS server...');
        await new Promise((resolve) => {
          this.httpsServer.close(resolve);
        });
        logger.info('✅ HTTPS server closed');
      }

      logger.info('Closing database connections...');
      await database.close();
      logger.info('✅ Database connections closed');

      logger.info('Closing Redis connections...');
      await redis.close();
      logger.info('✅ Redis connections closed');

      clearTimeout(shutdownTimer);
      logger.info('✅ Graceful shutdown completed');
      process.exit(0);

    } catch (error) {
      logger.error('❌ Error during graceful shutdown', { error: error.message });
      clearTimeout(shutdownTimer);
      process.exit(1);
    }
  }
}

async function main() {
  const app = new Application();

  try {
    await app.initialize();
    await app.start();
  } catch (error) {
    logger.error('❌ Failed to start application', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = Application;
