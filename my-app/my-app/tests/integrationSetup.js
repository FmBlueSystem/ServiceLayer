const { execSync } = require('child_process');

module.exports = async () => {
  console.log('🔧 Setting up integration test environment...');
  
  // Start Docker services for integration tests
  try {
    execSync('docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis', {
      stdio: 'inherit'
    });
    
    // Wait for services to be ready
    console.log('⏳ Waiting for services to be ready...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.warn('⚠️  Could not start Docker services for integration tests');
  }
  
  console.log('✅ Integration test setup completed');
};