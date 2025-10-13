const request = require('supertest');
const Application = require('../src/index');
const database = require('../src/config/database');

describe('API Endpoints', () => {
  let app;
  let server;
  let testUser;
  let authToken;

  beforeAll(async () => {
    app = new Application();
    await app.initialize();
    server = await app.start();
    
    // Create test tables
    await database.createTables();
    
    // Generate test user data
    testUser = global.testUtils.generateTestUser();
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await database.query('DELETE FROM users WHERE email LIKE $1', ['test%@example.com']);
    } catch (error) {
      // Ignore cleanup errors
    }
    
    if (app) {
      await app.gracefulShutdown('TEST_CLEANUP');
    }
  });

  describe('GET /api', () => {
    it('should return API information', async () => {
      const response = await request(server)
        .get('/api')
        .expect(200);

      expect(response.body).toMatchObject({
        name: expect.any(String),
        version: expect.any(String),
        description: expect.any(String),
        platform: expect.any(String),
        environment: expect.any(String),
        endpoints: expect.any(Object),
        timestamp: expect.any(String)
      });

      expect(response.body.endpoints).toHaveProperty('health');
      expect(response.body.endpoints).toHaveProperty('auth');
      expect(response.body.endpoints).toHaveProperty('users');
      expect(response.body.endpoints).toHaveProperty('cache');
      expect(response.body.endpoints).toHaveProperty('system');
    });
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/register', () => {
      it('should register a new user', async () => {
        const response = await request(server)
          .post('/api/auth/register')
          .send(testUser)
          .expect(201);

        expect(response.body).toMatchObject({
          message: 'User registered successfully',
          user: {
            id: expect.any(Number),
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            createdAt: expect.any(String)
          },
          token: expect.any(String)
        });

        // Store auth token for future tests
        authToken = response.body.token;
      });

      it('should not register user with existing email', async () => {
        const response = await request(server)
          .post('/api/auth/register')
          .send(testUser)
          .expect(409);

        expect(response.body).toMatchObject({
          error: {
            type: 'Conflict',
            message: 'User with this email already exists'
          }
        });
      });

      it('should validate required fields', async () => {
        const response = await request(server)
          .post('/api/auth/register')
          .send({
            email: 'invalid-email',
            password: '123', // Too short
            firstName: '',
            lastName: ''
          })
          .expect(400);

        expect(response.body).toMatchObject({
          error: {
            type: 'Validation Error',
            message: 'Validation failed'
          }
        });
      });
    });

    describe('POST /api/auth/login', () => {
      it('should login with valid credentials', async () => {
        const response = await request(server)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: testUser.password
          })
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Login successful',
          user: {
            id: expect.any(Number),
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName
          },
          token: expect.any(String)
        });
      });

      it('should reject invalid credentials', async () => {
        const response = await request(server)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword'
          })
          .expect(401);

        expect(response.body).toMatchObject({
          error: {
            type: 'Unauthorized',
            message: 'Invalid or expired token'
          }
        });
      });

      it('should reject non-existent user', async () => {
        const response = await request(server)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'password'
          })
          .expect(401);

        expect(response.body).toMatchObject({
          error: {
            type: 'Unauthorized'
          }
        });
      });
    });

    describe('GET /api/auth/profile', () => {
      it('should return user profile with valid token', async () => {
        const response = await request(server)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          user: {
            id: expect.any(Number),
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            isActive: true,
            createdAt: expect.any(String),
            updatedAt: expect.any(String)
          }
        });
      });

      it('should reject request without token', async () => {
        const response = await request(server)
          .get('/api/auth/profile')
          .expect(401);

        expect(response.body).toMatchObject({
          error: {
            type: 'Unauthorized',
            message: 'Access token required'
          }
        });
      });

      it('should reject request with invalid token', async () => {
        const response = await request(server)
          .get('/api/auth/profile')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body).toMatchObject({
          error: {
            type: 'Unauthorized',
            message: 'Invalid or expired token'
          }
        });
      });
    });
  });

  describe('User Management Endpoints', () => {
    describe('GET /api/users', () => {
      it('should return paginated user list', async () => {
        const response = await request(server)
          .get('/api/users')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          users: expect.any(Array),
          pagination: {
            page: expect.any(Number),
            limit: expect.any(Number),
            total: expect.any(Number),
            totalPages: expect.any(Number)
          }
        });

        if (response.body.users.length > 0) {
          expect(response.body.users[0]).toMatchObject({
            id: expect.any(Number),
            email: expect.any(String),
            firstName: expect.any(String),
            lastName: expect.any(String),
            isActive: expect.any(Boolean),
            createdAt: expect.any(String)
          });
        }
      });

      it('should handle pagination parameters', async () => {
        const response = await request(server)
          .get('/api/users?page=1&limit=5')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.pagination).toMatchObject({
          page: 1,
          limit: 5
        });
      });

      it('should require authentication', async () => {
        const response = await request(server)
          .get('/api/users')
          .expect(401);

        expect(response.body).toMatchObject({
          error: {
            type: 'Unauthorized'
          }
        });
      });
    });
  });

  describe('System Information Endpoints', () => {
    describe('GET /api/system/info', () => {
      it('should return system information', async () => {
        const response = await request(server)
          .get('/api/system/info')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          application: {
            name: 'my-multiplatform-app',
            version: expect.any(String),
            environment: expect.any(String),
            nodeVersion: expect.any(String),
            uptime: expect.any(Number)
          },
          platform: expect.any(Object),
          container: expect.any(Object),
          services: expect.any(Object),
          timestamp: expect.any(String)
        });
      });

      it('should require authentication', async () => {
        const response = await request(server)
          .get('/api/system/info')
          .expect(401);

        expect(response.body).toMatchObject({
          error: {
            type: 'Unauthorized'
          }
        });
      });
    });

    describe('GET /api/system/metrics', () => {
      it('should return system metrics', async () => {
        const response = await request(server)
          .get('/api/system/metrics')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          memory: expect.any(Object),
          cpu: expect.any(Object),
          network: expect.any(Object),
          process: {
            pid: expect.any(Number),
            uptime: expect.any(Number),
            memoryUsage: expect.any(Object),
            cpuUsage: expect.any(Object)
          },
          timestamp: expect.any(String)
        });
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting gracefully', async () => {
      // This test might be flaky depending on test environment
      // Making multiple requests quickly to test rate limiting
      const requests = Array(10).fill().map(() => 
        request(server).get('/api').expect(200)
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed in test environment
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});