# My Multiplatform App

A containerized Node.js application designed for cross-platform deployment from macOS (Apple Silicon) to Windows (x86_64). Built with Express.js, PostgreSQL, and Redis, featuring comprehensive Docker support and automated migration tools.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer (Nginx)                   │
├─────────────────────────────────────────────────────────────┤
│                    Application Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Node.js   │  │   Node.js   │  │   Node.js   │        │
│  │  Instance 1 │  │  Instance 2 │  │  Instance N │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────┤
│                    Data Layer                              │
│  ┌─────────────┐              ┌─────────────┐              │
│  │ PostgreSQL  │              │    Redis    │              │
│  │  Database   │              │    Cache    │              │
│  └─────────────┘              └─────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker Desktop (macOS/Windows)
- Node.js 18+ (for local development)
- Git

### 1. Clone and Setup

```bash
git clone <repository-url>
cd my-app
cp .env.example .env
```

### 2. Development on macOS

```bash
# Install dependencies
npm install

# Start development environment
npm run docker:run:dev

# Or without Docker
npm run dev
```

### 3. Production Build and Export for Windows

```bash
# Build for Windows deployment
npm run docker:build:win

# Export for Windows
npm run docker:export:win

# The exported files will be in ./docker-exports/
```

## 📦 Container Migration Workflow

### From macOS to Windows

```bash
# 1. On macOS - Build and export
npm run docker:build:win
npm run docker:export:win

# 2. Transfer files to Windows machine
# Copy ./docker-exports/ folder to Windows

# 3. On Windows - Import and run
# Use the generated PowerShell script:
.\docker-exports\scripts\import-windows.ps1

# Or manually:
docker load -i my-app-windows-*.tar.gz
docker run -d -p 3000:3000 --name my-app my-app:windows
```

## 🛠️ Development

### Project Structure

```
my-app/
├── src/                          # Application source code
│   ├── index.js                  # Main application entry point
│   ├── config/                   # Configuration files
│   │   ├── database.js           # PostgreSQL connection
│   │   ├── redis.js              # Redis connection
│   │   └── logger.js             # Winston logger setup
│   ├── routes/                   # Express routes
│   │   ├── health.js             # Health check endpoints
│   │   └── api.js                # API routes
│   ├── middleware/               # Express middleware
│   │   ├── errorHandler.js       # Error handling
│   │   └── rateLimiter.js        # Rate limiting
│   ├── services/                 # Business logic
│   └── utils/                    # Utility functions
│       └── platform.js           # Cross-platform utilities
├── docker/                       # Docker configuration
│   ├── Dockerfile                # Multi-stage Dockerfile
│   ├── docker-compose.yml        # Base compose file
│   ├── docker-compose.dev.yml    # Development overrides
│   └── docker-compose.prod.yml   # Production overrides
├── scripts/                      # Automation scripts
│   ├── migrate-container.js      # Container migration tool
│   ├── validate-image.js         # Image validation
│   └── init-db.sql               # Database initialization
├── tests/                        # Test files
├── public/                       # Static files
├── .env.example                  # Environment template
├── .env.mac                      # macOS-specific config
├── .env.windows                  # Windows-specific config
├── .dockerignore                 # Docker ignore rules
└── .gitattributes                # Git line ending rules
```

### Available Scripts

#### Docker Commands

```bash
# Build commands
npm run docker:build              # Build for current platform
npm run docker:build:multi        # Build for all platforms
npm run docker:build:mac          # Build for macOS (ARM64)
npm run docker:build:win          # Build for Windows (x86_64)

# Run commands
npm run docker:run                # Run production
npm run docker:run:dev            # Run development
npm run docker:run:prod           # Run production with overrides

# Migration commands
npm run docker:export             # Export current platform
npm run docker:export:win         # Export for Windows
npm run docker:import             # Import image
npm run docker:deploy             # Full deployment workflow

# Utility commands
npm run docker:validate           # Validate image
npm run docker:clean              # Clean up Docker resources
npm run docker:logs               # View logs
```

#### Development Commands

```bash
npm start                         # Start production server
npm run dev                       # Start development server
npm test                          # Run tests
npm run test:watch                # Run tests in watch mode
npm run lint                      # Lint code
npm run format                    # Format code
```

### Environment Configuration

The application uses different environment files for different platforms:

- `.env.example` - Template with all available options
- `.env.mac` - macOS development settings
- `.env.windows` - Windows production settings

Key environment variables:

```bash
# Application
NODE_ENV=production
APP_PORT=3000

# Database
POSTGRES_HOST=postgres
POSTGRES_DB=myapp
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Security
JWT_SECRET=your-secret-key
BCRYPT_SALT_ROUNDS=12

# Platform-specific
DOCKER_DEFAULT_PLATFORM=linux/amd64
BUILD_PLATFORM=darwin/arm64
TARGET_PLATFORM=linux/amd64
```

## 🔧 Platform-Specific Instructions

### macOS Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup Development Environment**
   ```bash
   cp .env.mac .env
   npm run docker:run:dev
   ```

3. **Build for Windows Deployment**
   ```bash
   npm run docker:build:win
   npm run docker:export:win
   ```

### Windows Deployment

1. **Prerequisites**
   ```powershell
   # Install Docker Desktop for Windows
   # Ensure WSL2 is enabled
   ```

2. **Import and Run**
   ```powershell
   # Import the exported image
   docker load -i my-app-windows-*.tar.gz
   
   # Run the application
   docker run -d -p 3000:3000 --name my-app my-app:windows
   ```

3. **Production Deployment**
   ```powershell
   # Copy production environment
   copy .env.windows .env
   
   # Run with production settings
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

## 🧪 Testing

### Unit Tests

```bash
npm test                          # Run all tests
npm run test:watch                # Watch mode
npm run test:coverage             # Coverage report
```

### Integration Tests

```bash
npm run test:integration          # Integration tests
```

### Image Validation

```bash
npm run docker:validate           # Validate Docker image
node scripts/validate-image.js my-app:latest
```

The validation includes:
- ✅ Image existence and layers
- 🔒 Security checks (non-root user)
- 📏 Image size validation
- 🚀 Application startup test
- 🌐 API endpoint validation
- 📜 Container log analysis
- 🏗️ Platform compatibility

## 📊 API Documentation

### Health Endpoints

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed system information
- `GET /health/live` - Kubernetes liveness probe
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/ping` - Simple ping endpoint

### Authentication Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

### API Endpoints

- `GET /api` - API information
- `GET /api/users` - List users (paginated)
- `GET /api/system/info` - System information
- `GET /api/system/metrics` - System metrics

### Example Requests

```bash
# Health check
curl http://localhost:3000/health

# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

## 🛡️ Security Features

- **Helmet.js** - Security headers
- **Rate Limiting** - Request throttling
- **CORS Protection** - Cross-origin security
- **JWT Authentication** - Secure tokens
- **Password Hashing** - bcrypt encryption
- **Input Validation** - express-validator
- **Non-root Container** - Security best practices
- **Audit Logging** - Action tracking

## 🔍 Monitoring & Logging

### Application Logs

Logs are structured JSON format with different levels:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info",
  "message": "Server started successfully",
  "pid": 1,
  "platform": "linux",
  "port": 3000,
  "environment": "production"
}
```

### Health Monitoring

The application exposes multiple health check endpoints:

- Basic health status with service checks
- Detailed system information and metrics
- Kubernetes-compatible probes

### Performance Metrics

Available at `/api/system/metrics`:

- Memory usage (process and system)
- CPU information and load
- Network interface details
- Process statistics

## 🚨 Troubleshooting

### Common Issues

#### Docker Build Fails

```bash
# Clear Docker cache
docker system prune -af

# Rebuild without cache
docker build --no-cache -t my-app .
```

#### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
export APP_PORT=3001
```

#### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps

# View database logs
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up -d
```

#### Redis Connection Issues

```bash
# Redis is optional, check logs
docker-compose logs redis

# Disable Redis temporarily
export REDIS_URL=""
```

### Platform-Specific Issues

#### macOS

- **Apple Silicon compatibility**: Use `linux/arm64` platform for local development
- **File permissions**: Ensure Docker has access to project directory
- **Performance**: Use `cached` volumes for better performance

#### Windows

- **WSL2 requirement**: Ensure WSL2 is properly configured
- **Line endings**: Project uses `.gitattributes` to handle CRLF/LF
- **Path separators**: Application handles Windows paths in containers

### Debug Mode

```bash
# Enable debug logging
export DEBUG=app:*
export LOG_LEVEL=debug

# Run in development mode
npm run dev
```

## 📈 Performance Optimization

### Docker Image Optimization

- Multi-stage builds to reduce image size
- Alpine Linux base for smaller footprint
- Layer caching for faster builds
- `.dockerignore` to exclude unnecessary files

### Application Performance

- Connection pooling for PostgreSQL
- Redis caching for frequent queries
- Compression middleware for responses
- Rate limiting to prevent abuse

### Production Tuning

```bash
# Environment variables for production
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=2048"
UV_THREADPOOL_SIZE=16

# PostgreSQL tuning
POSTGRES_SHARED_BUFFERS=256MB
POSTGRES_EFFECTIVE_CACHE_SIZE=1GB
POSTGRES_MAX_CONNECTIONS=100

# Redis configuration
REDIS_MAX_MEMORY=512MB
REDIS_MAXMEMORY_POLICY=allkeys-lru
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the existing code style
4. Write tests for new features
5. Ensure all tests pass
6. Submit a pull request

### Code Style

The project uses:
- ESLint for JavaScript linting
- Prettier for code formatting
- Jest for testing
- Conventional commits for commit messages

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:

1. Check the troubleshooting section above
2. Search existing issues in the repository
3. Create a new issue with detailed information
4. Include platform information and logs

### Issue Template

```markdown
**Platform**: macOS/Windows/Linux
**Architecture**: ARM64/x86_64
**Docker Version**: 
**Node.js Version**: 
**Error Message**: 
**Steps to Reproduce**: 
**Expected Behavior**: 
**Actual Behavior**: 
```

---

## 📋 Command Reference

### macOS Development Setup

```bash
# Initial setup
git clone <repo>
cd my-app
npm install
cp .env.mac .env

# Development
npm run docker:run:dev
npm run dev

# Testing
npm test
npm run docker:validate

# Build for Windows
npm run docker:build:win
npm run docker:export:win
```

### Windows Production Deployment

```powershell
# Prerequisites check
docker version
docker-compose version

# Import and run
docker load -i my-app-windows-*.tar.gz
copy .env.windows .env
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verify deployment
curl http://localhost:3000/health
docker-compose logs -f app
```

### Container Migration Commands

```bash
# Export for specific platform
node scripts/migrate-container.js export --platform windows

# Import image
node scripts/migrate-container.js import ./docker-exports/my-app-windows-*.tar.gz

# Full deployment workflow
node scripts/migrate-container.js deploy --platform windows

# Validate image
node scripts/validate-image.js my-app:windows
```

This README provides comprehensive documentation for developing, building, testing, and deploying the multiplatform containerized application. The application is designed to work seamlessly across macOS development and Windows production environments with full Docker support and automated migration tools.