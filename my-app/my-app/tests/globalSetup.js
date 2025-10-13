const { execSync } = require('child_process');

module.exports = async () => {
  console.log('🔧 Setting up global test environment...');
  
  // Ensure test database exists
  try {
    execSync('createdb myapp_test 2>/dev/null || true', { stdio: 'inherit' });
  } catch (error) {
    // Database might already exist
  }
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.POSTGRES_DB = 'myapp_test';
  process.env.REDIS_DB = '1';
  
  console.log('✅ Global test setup completed');
};