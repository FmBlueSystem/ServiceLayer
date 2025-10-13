const { execSync } = require('child_process');

module.exports = async () => {
  console.log('🧹 Cleaning up integration test environment...');
  
  // Stop Docker services
  try {
    execSync('docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v', {
      stdio: 'inherit'
    });
  } catch (error) {
    console.warn('⚠️  Could not stop Docker services');
  }
  
  console.log('✅ Integration test cleanup completed');
};