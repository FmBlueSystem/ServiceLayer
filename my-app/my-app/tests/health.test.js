const request = require('supertest');
const Application = require('../src/index');

describe('Health Check Endpoints', () => {
  let app;
  let server;

  beforeAll(async () => {
    app = new Application();
    await app.initialize();
    server = await app.start();
  });

  afterAll(async () => {
    if (app) {
      await app.gracefulShutdown('TEST_CLEANUP');
    }
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(server)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: expect.stringMatching(/^(healthy|degraded)$/),
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String),
        environment: expect.any(String),
        services: expect.any(Object),
        responseTime: expect.stringMatching(/^\d+ms$/)
      });

      expect(response.body.services).toHaveProperty('database');
      expect(response.body.services).toHaveProperty('redis');
    });

    it('should include service status information', async () => {
      const response = await request(server)
        .get('/health')
        .expect(200);

      const { services } = response.body;
      
      expect(services.database).toMatchObject({
        status: expect.stringMatching(/^(healthy|unhealthy)$/),
        timestamp: expect.any(String)
      });

      expect(services.redis).toMatchObject({
        status: expect.stringMatching(/^(healthy|unhealthy|disconnected)$/),
        timestamp: expect.any(String)
      });
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health information', async () => {
      const response = await request(server)
        .get('/health/detailed')
        .expect(200);

      expect(response.body).toMatchObject({
        status: expect.stringMatching(/^(healthy|degraded)$/),
        timestamp: expect.any(String),
        version: expect.any(String),
        environment: expect.any(String),
        platform: expect.any(Object),
        services: expect.any(Object),
        system: expect.any(Object),
        performance: expect.any(Object)
      });

      expect(response.body.platform).toHaveProperty('platform');
      expect(response.body.platform).toHaveProperty('container');
      expect(response.body.platform).toHaveProperty('memory');
      expect(response.body.platform).toHaveProperty('cpu');
    });

    it('should include performance metrics', async () => {
      const response = await request(server)
        .get('/health/detailed')
        .expect(200);

      const { performance } = response.body;
      
      expect(performance).toMatchObject({
        memoryUsage: {
          rss: expect.stringMatching(/^\d+(\.\d+)?\s[KMGT]?B$/),
          heapTotal: expect.stringMatching(/^\d+(\.\d+)?\s[KMGT]?B$/),
          heapUsed: expect.stringMatching(/^\d+(\.\d+)?\s[KMGT]?B$/),
          external: expect.stringMatching(/^\d+(\.\d+)?\s[KMGT]?B$/)
        },
        uptime: {
          process: expect.any(Number),
          system: expect.any(Number)
        },
        responseTime: expect.stringMatching(/^\d+ms$/)
      });
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness status', async () => {
      const response = await request(server)
        .get('/health/live')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'alive',
        timestamp: expect.any(String),
        uptime: expect.any(Number)
      });
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(server)
        .get('/health/ready');

      expect([200, 503]).toContain(response.status);

      expect(response.body).toMatchObject({
        status: expect.stringMatching(/^(ready|not_ready)$/),
        timestamp: expect.any(String),
        checks: expect.any(Array)
      });

      const checks = response.body.checks;
      const dbCheck = checks.find(check => check.service === 'database');
      const redisCheck = checks.find(check => check.service === 'redis');

      expect(dbCheck).toBeDefined();
      expect(dbCheck.status).toMatch(/^(ready|not_ready)$/);
      
      if (redisCheck) {
        expect(redisCheck.status).toMatch(/^(ready|not_ready)$/);
      }
    });
  });

  describe('GET /health/startup', () => {
    it('should return startup status', async () => {
      const response = await request(server)
        .get('/health/startup');

      expect([200, 503]).toContain(response.status);

      expect(response.body).toMatchObject({
        status: expect.stringMatching(/^(started|starting|failed)$/),
        timestamp: expect.any(String),
        checks: expect.any(Object)
      });

      const { checks } = response.body;
      expect(checks).toHaveProperty('database');
      expect(checks).toHaveProperty('redis');
      expect(checks).toHaveProperty('platform');
      expect(checks.platform).toBe(true);
    });
  });

  describe('GET /health/ping', () => {
    it('should return pong', async () => {
      const response = await request(server)
        .get('/health/ping')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'pong',
        timestamp: expect.any(String)
      });
    });
  });

  describe('GET /health/version', () => {
    it('should return version information', async () => {
      const response = await request(server)
        .get('/health/version')
        .expect(200);

      expect(response.body).toMatchObject({
        version: expect.any(String),
        name: expect.any(String),
        environment: expect.any(String),
        nodeVersion: expect.any(String),
        platform: expect.any(String),
        timestamp: expect.any(String)
      });

      expect(response.body.name).toBe('my-multiplatform-app');
      expect(response.body.nodeVersion).toMatch(/^v\d+\.\d+\.\d+/);
    });
  });
});