const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logLevel = process.env.LOG_LEVEL || 'info';
const logFormat = process.env.LOG_FORMAT || 'json';

const customFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      pid: process.pid,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      ...meta
    };
    return JSON.stringify(logEntry);
  })
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaString}`;
  })
);

const transports = [
  new winston.transports.Console({
    level: logLevel,
    format: process.env.NODE_ENV === 'production' ? customFormat : consoleFormat,
    handleExceptions: true,
    handleRejections: true
  })
];

if (process.env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: customFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      handleExceptions: true,
      handleRejections: true
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: customFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  );
}

const logger = winston.createLogger({
  level: logLevel,
  format: customFormat,
  transports,
  exitOnError: false
});

logger.info('Logger initialized', {
  level: logLevel,
  format: logFormat,
  environment: process.env.NODE_ENV,
  logDir: logDir
});

module.exports = logger;