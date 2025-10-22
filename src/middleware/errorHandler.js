const logger = require('../config/logger');

function errorHandler(error, req, res, next) {
  const requestId = req.requestId || 'unknown';
  const timestamp = new Date().toISOString();

  const errorDetails = {
    requestId,
    timestamp,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  };

  // Log the error
  logger.error('Request error', errorDetails);

  // Determine error type and status code
  let statusCode = 500;
  let errorType = 'Internal Server Error';
  let userMessage = 'An unexpected error occurred';

  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorType = 'Validation Error';
    userMessage = error.message;
  } else if (error.name === 'UnauthorizedError' || error.status === 401) {
    statusCode = 401;
    errorType = 'Unauthorized';
    userMessage = 'Authentication required';
  } else if (error.status === 403) {
    statusCode = 403;
    errorType = 'Forbidden';
    userMessage = 'Access denied';
  } else if (error.status === 404) {
    statusCode = 404;
    errorType = 'Not Found';
    userMessage = 'Resource not found';
  } else if (error.name === 'SyntaxError' && error.status === 400) {
    statusCode = 400;
    errorType = 'Syntax Error';
    userMessage = 'Invalid JSON format';
  } else if (error.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    errorType = 'File Too Large';
    userMessage = 'File size exceeds limit';
  } else if (error.code === 'ECONNREFUSED') {
    statusCode = 503;
    errorType = 'Service Unavailable';
    userMessage = 'External service temporarily unavailable';
  } else if (error.status) {
    statusCode = error.status;
    errorType = error.name || 'Error';
    userMessage = error.message;
  }

  const errorResponse = {
    error: {
      type: errorType,
      message: userMessage,
      requestId,
      timestamp
    }
  };

  // Include additional details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.details = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error.details && { errorDetails: error.details })
    };
  }

  // Include status code for client debugging
  if (process.env.NODE_ENV === 'development' || process.env.INCLUDE_ERROR_STATUS === 'true') {
    errorResponse.error.statusCode = statusCode;
  }

  res.status(statusCode).json(errorResponse);
}

// Custom error classes
class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}

class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
    this.status = 401;
  }
}

class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
    this.status = 403;
  }
}

class ConflictError extends Error {
  constructor(message = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
    this.status = 409;
  }
}

class ServiceUnavailableError extends Error {
  constructor(message = 'Service temporarily unavailable') {
    super(message);
    this.name = 'ServiceUnavailableError';
    this.status = 503;
  }
}

// Async error wrapper
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 404 handler (should be used after all routes)
function notFoundHandler(req, res, next) {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ServiceUnavailableError
};