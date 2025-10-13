# Multi-platform Dockerfile for macOS (ARM64) to Windows (AMD64) deployment
# Supports both development and production builds

ARG NODE_VERSION=18
ARG PLATFORM_SPECIFIC_CONFIG=""

# Build stage - optimized for both ARM64 and AMD64
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS builder

# Install build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    && ln -sf python3 /usr/bin/python

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies with platform-specific optimizations
RUN npm ci --only=production --platform=linux && \
    npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY public/ ./public/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Production stage
FROM node:${NODE_VERSION}-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Copy built application from builder
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/src ./src
COPY --from=builder --chown=appuser:nodejs /app/public ./public
COPY --chown=appuser:nodejs package*.json ./

# Set proper permissions
RUN chmod +x src/index.js

# Platform-specific environment variables
ARG BUILDPLATFORM
ARG TARGETPLATFORM
ENV BUILD_PLATFORM=$BUILDPLATFORM
ENV TARGET_PLATFORM=$TARGETPLATFORM
ENV NODE_ENV=production
ENV PORT=3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Switch to non-root user
USER appuser

# Expose application port
EXPOSE ${PORT}

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]

# Development stage
FROM node:${NODE_VERSION}-alpine AS development

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    && ln -sf python3 /usr/bin/python

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies including dev dependencies
RUN npm ci

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs && \
    chown -R appuser:nodejs /app

USER appuser

ENV NODE_ENV=development
ENV PORT=3000

EXPOSE ${PORT}

# Use nodemon for development
CMD ["npm", "run", "dev"]