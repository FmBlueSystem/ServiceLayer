# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **SAP Business One Service Layer Proxy** application that acts as an intermediary between frontend clients and SAP B1 Service Layer. Built with Node.js/Express, it provides authentication, session management, caching, permission control, and remote Windows server management capabilities.

**Key Features:**
- SAP B1 Service Layer authentication and session management with automatic renewal
- Multi-database/multi-company support
- Role-based permission system with resource-level authorization
- Redis caching for SAP responses (with in-memory fallback)
- Remote Windows server management via SSH
- PostgreSQL for user/permission data and system configuration
- HTTPS support with self-signed certificates
- Cross-platform Docker deployment (ARM64/x86_64)

## Development Commands

### Running the Application
```bash
npm start              # Production mode
npm run dev            # Development mode with debugging (port 9229)
```

### Testing
```bash
npm test               # Run all tests with coverage
npm run test:watch     # Watch mode for development
npm run test:integration  # Integration tests only
```

### Linting & Formatting
```bash
npm run lint           # Check for issues
npm run lint:fix       # Auto-fix issues
npm run format         # Format code with Prettier
npm run format:check   # Check formatting without changes
```

### Database Migrations
```bash
npm run migrate:up     # Apply pending migrations
npm run migrate:down   # Rollback last migration
npm run seed:data      # Seed database with initial data
node scripts/init-permissions.js  # Initialize permissions system
```

**Note:** Migrations are in `database/migrations/` with numbered prefixes (001_, 002_, etc.).

### Docker Operations
```bash
# Build
npm run docker:build:dev   # Development image
npm run docker:build:prod  # Production image
npm run docker:build:win   # Windows x86_64 platform
npm run docker:build:mac   # macOS ARM64 platform

# Run
npm run docker:run         # Basic docker-compose
npm run docker:run:dev     # Development environment
npm run docker:run:prod    # Production environment (detached)

# Maintenance
npm run docker:stop        # Stop containers
npm run docker:stop:clean  # Stop and remove volumes
npm run docker:logs        # View all logs
npm run docker:logs:app    # App logs only
npm run docker:clean       # Clean up unused resources
npm run docker:reset       # Complete reset (stop + clean)
```

## Architecture

### Request Flow
1. **Client Request** → Rate Limiter → CORS/Helmet/Compression
2. **Route Handler** (`routes/sap.js`, `routes/api.js`) → Authorization Middleware
3. **Authorization** (`middleware/authorization.js`) → Permission Service checks user role/resource access
4. **SAP Service** (`services/sapService.js`) → Checks Redis cache → Makes SAP B1 API call
5. **Session Management** (`middleware/sapSession.js`) → Stores/retrieves SAP SessionIds in Redis
6. **Response** → Cached in Redis → Returned to client

### Core Components

**Service Layer Architecture:**
- **`services/sapService.js`**: Central SAP B1 communication hub. Handles all SAP API calls, manages configuration loading from DB, implements retry logic, and manages per-endpoint caching with TTLs (items: 5min, orders: 1min, exchange rates: 30min, etc.)

- **`services/sessionRenewalService.js`**: Automatic SAP session renewal. Encrypts and stores user credentials (AES-256-CBC), detects 401 errors, and automatically re-authenticates to maintain session continuity

- **`services/permissionService.js`**: RBAC engine. Checks permissions via joins across `user_roles`, `role_permissions`, `permissions`, and `sap_users` tables. Supports multi-company authorization (specific companyDB or wildcard '*')

- **`services/remoteWindowsService.js`**: SSH-based Windows server management using ssh2 library. Executes PowerShell commands on remote Windows hosts (default: 10.13.0.29)

**Middleware Stack:**
- **`middleware/sapSession.js`**: SAP SessionId manager. Uses Redis for distributed sessions with in-memory Map fallback. 30-minute TTL with activity tracking

- **`middleware/authorization.js`**: Permission verification middleware. Factory function `checkPermission(resource, action)` creates route-specific guards. Extracts username from session/headers/body and validates against PermissionService

- **`middleware/errorHandler.js`**: Global error handling with logging, user-friendly messages, and proper status codes

- **`middleware/rateLimiter.js`**: Express rate limiting to prevent abuse

**Configuration:**
- **`config/database.js`**: PostgreSQL connection with query logging
- **`config/redis.js`**: Redis client with ping/reconnect logic. Can operate in disabled mode (DISABLE_REDIS=true)
- **`config/logger.js`**: Winston-based structured logging with file rotation and console output

### Database Schema

**Permission System** (migrations 001-002):
- `sap_users`: User registry with active status tracking
- `roles`: Admin, User, Viewer, etc.
- `permissions`: Resource-action pairs (e.g., 'tipos_cambio:view', 'items:create')
- `role_permissions`: Many-to-many role-permission mapping
- `user_roles`: User-role assignments with company_db scoping
- `audit_events`: Permission check logging for security auditing

**System Configuration** (migration 002):
- `system_config`: Key-value store for runtime config (SAP endpoint, timeouts, SSL verification)
- Used by `services/configService.js` to override environment variables

**Pages System** (migration 003):
- `pages`: Dynamic frontend page definitions with icon, route, permissions
- `page_permissions`: Role-based page visibility control

### Important Patterns

**SAP Service Configuration Loading:**
All SAP operations call `await sapService.ensureConfigLoaded()` to load DB-based config before use. This allows runtime configuration changes without restart.

**Session Renewal Flow:**
1. Request fails with 401 from SAP
2. `sessionRenewalService` detects auth failure
3. Decrypts stored credentials
4. Re-authenticates with SAP
5. Updates SessionId in Redis
6. Retries original request
7. Max 1 retry to prevent loops

**Multi-Database Support:**
Users can have roles scoped to specific SAP company databases via `user_roles.company_db`. Wildcard '*' grants access to all databases.

**Caching Strategy:**
Redis caching with endpoint-specific TTLs defined in `sapService.cacheTTLs`. Cache keys include endpoint path and query params for granular invalidation.

## Environment Variables

Key variables (see `.env`):
- `SAP_ENDPOINT`: SAP B1 Service Layer URL
- `SAP_COMPANY_DB`: Default SAP company database
- `POSTGRES_*`: Database connection details
- `ALLOW_START_WITHOUT_DATABASE`: If false, app won't start without DB connection
- `DISABLE_REDIS`: Set to 'true' to disable Redis (uses in-memory fallback)
- `SESSION_RENEWAL_ENABLED`: Enable/disable automatic session renewal
- `WINDOWS_SSH_PASSWORD`: Password for remote Windows server access
- `JWT_SECRET`: Secret for JWT token signing
- `CORS_ORIGIN`: Allowed CORS origin (default frontend URL)

## Testing Patterns

**Test Setup** (`tests/setup.js`):
- Configures test environment
- Mocks external dependencies (SAP, Redis, database)

**Coverage Requirements** (package.json jest config):
- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

Excludes: `src/index.js`, `src/config/*.js`

## Platform Notes

This application is designed for **cross-platform Docker deployment**, particularly macOS ARM64 → Windows x86_64. The `scripts/migrate-container.js` handles container export/import between platforms.

**Platform Detection:**
Use `src/utils/platform.js` for platform-specific logic. Available via `npm run platform:detect`.

## Scripts Directory

- **`init-db.sql`**: Base database schema (users, sessions, audit_log, api_keys)
- **`init-permissions.js`**: Seeds permission system with default roles/permissions
- **`run-migration.js`**: Migration runner (use via npm scripts)
- **`test-sap-connection.js`**: Standalone SAP connectivity test
- **`verify-pages.js`**: Validates page configuration in database
- **`scripts/windows/`**: PowerShell scripts for Windows server operations

## Common Workflows

**Adding a New SAP Endpoint:**
1. Add route in `routes/sap.js` or `routes/api.js`
2. Add authorization middleware: `checkPermission('resource_name', 'action')`
3. Add cache TTL in `sapService.cacheTTLs` if needed
4. Create permission in DB via migration or admin UI
5. Assign permission to relevant roles

**Adding a New Database Migration:**
1. Create `database/migrations/00X_description.sql`
2. Follow sequential numbering
3. Run `npm run migrate:up`
4. Update this file if schema changes affect architecture

**Debugging SAP Issues:**
1. Check `app.log` for SAP service errors
2. Verify SAP endpoint: `node scripts/test-sap-connection.js`
3. Check Redis session storage (if enabled)
4. Review `audit_events` table for permission issues
5. Enable debug logging: `LOG_LEVEL=debug npm run dev`

## Remote Windows Management

The `remoteWindowsService` allows executing PowerShell commands on remote Windows servers via SSH (port 22). Used for administrative tasks like service management, file operations, etc.

**Default Server:** 10.13.0.29 (production)
**Authentication:** Username/password from environment variables
**Usage:** See `routes/windows.js` for API endpoints
