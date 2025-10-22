#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../src/config/logger');

class ImageValidator {
  constructor() {
    this.imageName = process.argv[2] || 'my-app:latest';
    this.containerName = 'validation-container';
    this.testPort = 3001;
    this.timeout = 60000; // 60 seconds
  }

  async executeCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      console.log(`🔧 Executing: ${command}`);
      
      const child = spawn('sh', ['-c', command], {
        stdio: options.silent ? 'pipe' : 'inherit',
        ...options
      });

      let stdout = '';
      let stderr = '';

      if (options.silent) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
        }
      });

      child.on('error', reject);
    });
  }

  async validateImageExists() {
    console.log(`🔍 Checking if image ${this.imageName} exists...`);
    
    try {
      await this.executeCommand(`docker inspect ${this.imageName}`, { silent: true });
      console.log('✅ Image exists');
      return true;
    } catch (error) {
      console.error(`❌ Image ${this.imageName} not found`);
      return false;
    }
  }

  async validateImageLayers() {
    console.log('🔍 Validating image layers...');
    
    try {
      const result = await this.executeCommand(`docker history ${this.imageName}`, { silent: true });
      const layers = result.stdout.split('\n').filter(line => line.trim());
      
      console.log(`✅ Image has ${layers.length - 1} layers`);
      
      // Check for expected layers
      const historyText = result.stdout.toLowerCase();
      const expectedCommands = ['from', 'workdir', 'copy', 'run', 'expose', 'cmd'];
      const foundCommands = expectedCommands.filter(cmd => historyText.includes(cmd));
      
      console.log(`📋 Found Docker commands: ${foundCommands.join(', ')}`);
      
      if (foundCommands.length < 4) {
        console.warn('⚠️  Image may be missing expected layers');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to validate image layers:', error.message);
      return false;
    }
  }

  async validateImageSecurity() {
    console.log('🔒 Running security validation...');
    
    try {
      // Check if image runs as non-root user
      const result = await this.executeCommand(
        `docker run --rm ${this.imageName} whoami`,
        { silent: true }
      );
      
      const user = result.stdout.trim();
      if (user === 'root') {
        console.warn('⚠️  Image runs as root user (security concern)');
        return false;
      } else {
        console.log(`✅ Image runs as user: ${user}`);
        return true;
      }
    } catch (error) {
      console.error('❌ Failed to validate image security:', error.message);
      return false;
    }
  }

  async validateImageSize() {
    console.log('📏 Checking image size...');
    
    try {
      const result = await this.executeCommand(
        `docker images ${this.imageName} --format "table {{.Size}}"`,
        { silent: true }
      );
      
      const sizeLines = result.stdout.split('\n').filter(line => line.trim() && !line.includes('SIZE'));
      if (sizeLines.length > 0) {
        const size = sizeLines[0].trim();
        console.log(`📦 Image size: ${size}`);
        
        // Warn if image is too large (over 1GB)
        if (size.includes('GB') && parseFloat(size) > 1) {
          console.warn(`⚠️  Large image size: ${size}`);
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Failed to check image size:', error.message);
      return false;
    }
  }

  async validateApplicationStart() {
    console.log('🚀 Testing application startup...');
    
    try {
      // Start container
      await this.executeCommand(
        `docker run -d --name ${this.containerName} -p ${this.testPort}:3000 ${this.imageName}`,
        { silent: true }
      );
      
      console.log(`📦 Container ${this.containerName} started`);
      
      // Wait for application to start
      await this.waitForHealthy();
      
      console.log('✅ Application started successfully');
      return true;
    } catch (error) {
      console.error('❌ Application failed to start:', error.message);
      return false;
    }
  }

  async waitForHealthy() {
    const maxAttempts = 30;
    const interval = 2000;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.executeCommand(
          `curl -f http://localhost:${this.testPort}/health`,
          { silent: true }
        );
        
        const healthData = JSON.parse(result.stdout);
        if (healthData.status === 'healthy' || healthData.status === 'degraded') {
          console.log(`✅ Health check passed (attempt ${attempt})`);
          return true;
        }
      } catch (error) {
        console.log(`⏳ Health check attempt ${attempt}/${maxAttempts} failed, retrying...`);
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error('Application did not become healthy within timeout');
  }

  async validateApiEndpoints() {
    console.log('🌐 Testing API endpoints...');
    
    const endpoints = [
      { path: '/health', expected: 200 },
      { path: '/health/ping', expected: 200 },
      { path: '/api', expected: 200 },
      { path: '/nonexistent', expected: 404 }
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
      try {
        const result = await this.executeCommand(
          `curl -s -o /dev/null -w "%{http_code}" http://localhost:${this.testPort}${endpoint.path}`,
          { silent: true }
        );
        
        const statusCode = parseInt(result.stdout.trim());
        const success = statusCode === endpoint.expected;
        
        results.push({
          path: endpoint.path,
          expected: endpoint.expected,
          actual: statusCode,
          success
        });
        
        if (success) {
          console.log(`✅ ${endpoint.path}: ${statusCode}`);
        } else {
          console.log(`❌ ${endpoint.path}: expected ${endpoint.expected}, got ${statusCode}`);
        }
      } catch (error) {
        console.error(`❌ Failed to test ${endpoint.path}:`, error.message);
        results.push({
          path: endpoint.path,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`📊 API endpoints: ${successCount}/${endpoints.length} passed`);
    
    return successCount === endpoints.length;
  }

  async validateContainerLogs() {
    console.log('📜 Checking container logs...');
    
    try {
      const result = await this.executeCommand(
        `docker logs ${this.containerName}`,
        { silent: true }
      );
      
      const logs = result.stdout;
      const errorCount = (logs.match(/ERROR/gi) || []).length;
      const warningCount = (logs.match /WARN/gi) || []).length;
      
      console.log(`📋 Log analysis: ${errorCount} errors, ${warningCount} warnings`);
      
      if (errorCount > 0) {
        console.warn('⚠️  Container logs contain errors');
        console.log('Recent logs:');
        console.log(logs.split('\n').slice(-10).join('\n'));
      }
      
      return errorCount === 0;
    } catch (error) {
      console.error('❌ Failed to check container logs:', error.message);
      return false;
    }
  }

  async validatePlatformCompatibility() {
    console.log('🏗️  Validating platform compatibility...');
    
    try {
      const result = await this.executeCommand(
        `docker run --rm ${this.imageName} node -e "console.log(JSON.stringify({platform: process.platform, arch: process.arch, nodeVersion: process.version}))"`,
        { silent: true }
      );
      
      const platformInfo = JSON.parse(result.stdout.trim());
      console.log(`✅ Platform: ${platformInfo.platform}`);
      console.log(`✅ Architecture: ${platformInfo.arch}`);
      console.log(`✅ Node.js: ${platformInfo.nodeVersion}`);
      
      // Validate expected platform
      if (platformInfo.platform !== 'linux') {
        console.warn(`⚠️  Unexpected platform: ${platformInfo.platform} (expected: linux)`);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to validate platform compatibility:', error.message);
      return false;
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up test resources...');
    
    try {
      // Stop and remove container
      await this.executeCommand(`docker stop ${this.containerName}`, { silent: true });
      await this.executeCommand(`docker rm ${this.containerName}`, { silent: true });
      console.log('✅ Test container cleaned up');
    } catch (error) {
      console.warn('⚠️  Cleanup warning:', error.message);
    }
  }

  async validateImage() {
    console.log(`🧪 Starting validation of Docker image: ${this.imageName}`);
    console.log('=' * 60);
    
    const validations = [
      { name: 'Image Exists', test: () => this.validateImageExists() },
      { name: 'Image Layers', test: () => this.validateImageLayers() },
      { name: 'Image Security', test: () => this.validateImageSecurity() },
      { name: 'Image Size', test: () => this.validateImageSize() },
      { name: 'Application Start', test: () => this.validateApplicationStart() },
      { name: 'API Endpoints', test: () => this.validateApiEndpoints() },
      { name: 'Container Logs', test: () => this.validateContainerLogs() },
      { name: 'Platform Compatibility', test: () => this.validatePlatformCompatibility() }
    ];
    
    const results = [];
    
    for (const validation of validations) {
      console.log(`\n🔍 Running: ${validation.name}`);
      console.log('-'.repeat(40));
      
      try {
        const success = await validation.test();
        results.push({ name: validation.name, success, error: null });
      } catch (error) {
        console.error(`❌ ${validation.name} failed:`, error.message);
        results.push({ name: validation.name, success: false, error: error.message });
      }
    }
    
    // Cleanup regardless of results
    await this.cleanup();
    
    // Generate report
    console.log('\n📊 VALIDATION REPORT');
    console.log('=' * 60);
    
    const passed = results.filter(r => r.success).length;
    const total = results.length;
    
    results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.name}`);
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }
    });
    
    console.log('-'.repeat(60));
    console.log(`📈 Overall: ${passed}/${total} validations passed`);
    
    if (passed === total) {
      console.log('🎉 All validations passed! Image is ready for deployment.');
      process.exit(0);
    } else {
      console.log('⚠️  Some validations failed. Please review and fix issues.');
      process.exit(1);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new ImageValidator();
  validator.validateImage().catch(error => {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  });
}

module.exports = ImageValidator;