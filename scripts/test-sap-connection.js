#!/usr/bin/env node

require('dotenv').config();
const sapService = require('../src/services/sapService');

async function testSAPConnection() {
  console.log('🧪 Testing SAP Connection');
  console.log('=' * 50);
  console.log(`📍 Endpoint: ${process.env.SAP_ENDPOINT}`);
  console.log(`👤 Username: ${process.env.SAP_USERNAME}`);
  console.log(`🔒 SSL Verification: ${process.env.SAP_VERIFY_SSL !== 'false'}`);
  console.log(`⏱️  Timeout: ${process.env.SAP_TIMEOUT}ms`);
  console.log('=' * 50);

  try {
    console.log('\n1️⃣ Testing basic connection...');
    const connectionResult = await sapService.testConnection();
    
    if (connectionResult.success) {
      console.log(`✅ Connection successful!`);
      console.log(`   Response Time: ${connectionResult.responseTime}`);
      console.log(`   Status Code: ${connectionResult.statusCode}`);
    } else {
      console.log(`❌ Connection failed: ${connectionResult.error}`);
    }

    console.log('\n2️⃣ Testing system info...');
    try {
      const systemInfo = await sapService.getSystemInfo();
      console.log(`✅ System info retrieved`);
      console.log(`   Status Code: ${systemInfo.statusCode}`);
      console.log(`   Success: ${systemInfo.success}`);
      if (systemInfo.data) {
        console.log(`   Data available: ${typeof systemInfo.data === 'string' ? systemInfo.data.slice(0, 100) + '...' : 'Object'}`);
      }
    } catch (error) {
      console.log(`⚠️  System info failed: ${error.userMessage || error.message}`);
    }

    console.log('\n3️⃣ Testing authentication...');
    try {
      if (process.env.SAP_USERNAME && process.env.SAP_PASSWORD) {
        const authResult = await sapService.authenticate(
          process.env.SAP_USERNAME,
          process.env.SAP_PASSWORD
        );
        console.log(`✅ Authentication test completed`);
        console.log(`   Status Code: ${authResult.statusCode}`);
        console.log(`   Success: ${authResult.success}`);
      } else {
        console.log(`⚠️  No SAP credentials provided, skipping auth test`);
      }
    } catch (error) {
      console.log(`⚠️  Authentication failed: ${error.userMessage || error.message}`);
    }

    console.log('\n4️⃣ Testing multiple endpoints...');
    const endpoints = [
      { path: '/', name: 'Root' },
      { path: '/sap/public/ping', name: 'Public Ping' },
      { path: '/sap/bc/ping', name: 'BC Ping' },
      { path: '/sap/bc/rest/system/info', name: 'System Info' },
      { path: '/sap/opu/odata/sap/', name: 'OData Services' }
    ];

    const results = [];
    for (const endpoint of endpoints) {
      try {
        const result = await sapService.callSAPAPI(endpoint.path);
        results.push({
          name: endpoint.name,
          path: endpoint.path,
          success: result.success,
          statusCode: result.statusCode,
          available: result.statusCode < 500
        });
        
        const status = result.success ? '✅' : result.statusCode < 500 ? '⚠️' : '❌';
        console.log(`   ${status} ${endpoint.name} (${endpoint.path}): ${result.statusCode}`);
      } catch (error) {
        results.push({
          name: endpoint.name,
          path: endpoint.path,
          success: false,
          error: error.userMessage || error.message,
          available: false
        });
        
        console.log(`   ❌ ${endpoint.name} (${endpoint.path}): ${error.userMessage || error.message}`);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const availableCount = results.filter(r => r.available).length;

    console.log('\n📊 SUMMARY:');
    console.log('=' * 30);
    console.log(`Total Endpoints: ${endpoints.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Available: ${availableCount}`);
    console.log(`Connection Score: ${Math.round((availableCount / endpoints.length) * 100)}%`);

    if (connectionResult.success || availableCount > 0) {
      console.log('\n🎉 SAP server is accessible!');
      process.exit(0);
    } else {
      console.log('\n❌ SAP server is not accessible');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Critical error during SAP testing:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the test
if (require.main === module) {
  testSAPConnection();
}