const { execSync } = require('child_process');

module.exports = async () => {
  console.log('🧹 Cleaning up global test environment...');
  
  // Clean up test database
  try {
    execSync('dropdb myapp_test 2>/dev/null || true', { stdio: 'inherit' });
  } catch (error) {
    // Database might not exist
  }
  
  console.log('✅ Global test cleanup completed');
};