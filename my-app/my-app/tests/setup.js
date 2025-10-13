const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test environment setup
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.POSTGRES_DB = 'myapp_test';
process.env.REDIS_DB = '1';

// Setup test database
beforeAll(async () => {
  console.log('Setting up test environment...');
  
  // Create test database if it doesn't exist
  try {
    execSync('createdb myapp_test', { stdio: 'ignore' });
  } catch (error) {
    // Database might already exist
  }
});

// Cleanup after tests
afterAll(async () => {
  console.log('Cleaning up test environment...');
  
  // Clean up test database
  try {
    execSync('dropdb myapp_test', { stdio: 'ignore' });
  } catch (error) {
    // Database might not exist
  }
});

// Extend Jest matchers
expect.extend({
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },
  
  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false,
      };
    }
  },
  
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  }
});

// Global test utilities
global.testUtils = {
  generateTestUser: () => ({
    email: `test${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User'
  }),
  
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  randomString: (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
};