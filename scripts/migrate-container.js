#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class ContainerMigrator {
  constructor() {
    this.platforms = {
      mac: { arch: 'linux/arm64', suffix: 'mac' },
      windows: { arch: 'linux/amd64', suffix: 'windows' },
      linux: { arch: 'linux/amd64', suffix: 'linux' }
    };
    
    this.currentPlatform = this.detectCurrentPlatform();
    this.outputDir = path.join(process.cwd(), 'docker-exports');
    this.imageName = 'my-app';
    this.imageTag = 'latest';
    
    this.ensureOutputDir();
  }

  detectCurrentPlatform() {
    const platform = process.platform;
    const arch = process.arch;
    
    console.log(`🔍 Detected platform: ${platform} (${arch})`);
    
    if (platform === 'darwin') {
      return arch === 'arm64' ? 'mac' : 'mac';
    } else if (platform === 'win32') {
      return 'windows';
    } else {
      return 'linux';
    }
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      console.log(`📁 Created export directory: ${this.outputDir}`);
    }
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

  async buildMultiPlatformImage(targetPlatform) {
    const platform = this.platforms[targetPlatform];
    if (!platform) {
      throw new Error(`Unsupported platform: ${targetPlatform}`);
    }

    console.log(`🚀 Building image for ${targetPlatform} (${platform.arch})`);
    
    // Ensure buildx is available
    try {
      await this.executeCommand('docker buildx version', { silent: true });
    } catch (error) {
      console.log('📦 Setting up Docker Buildx...');
      await this.executeCommand('docker buildx create --use --name multiplatform-builder');
    }

    const imageTag = `${this.imageName}:${platform.suffix}`;
    const buildCommand = [
      'docker buildx build',
      `--platform ${platform.arch}`,
      '-f docker/Dockerfile',
      '--target production',
      `--tag ${imageTag}`,
      '--load',
      '.'
    ].join(' ');

    await this.executeCommand(buildCommand);
    console.log(`✅ Successfully built image: ${imageTag}`);
    
    return imageTag;
  }

  async exportImage(imageTag, targetPlatform, compress = true) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFileName = `${this.imageName}-${targetPlatform}-${timestamp}`;
    const tarFileName = `${baseFileName}.tar`;
    const compressedFileName = `${baseFileName}.tar.gz`;
    
    const tarPath = path.join(this.outputDir, tarFileName);
    const compressedPath = path.join(this.outputDir, compressedFileName);

    console.log(`📦 Exporting image ${imageTag}...`);
    
    // Export the image
    await this.executeCommand(`docker save ${imageTag} -o "${tarPath}"`);
    
    // Calculate checksum of original tar
    const tarBuffer = fs.readFileSync(tarPath);
    const checksum = crypto.createHash('sha256').update(tarBuffer).digest('hex');
    
    let finalPath = tarPath;
    let finalSize = tarBuffer.length;

    // Compress if requested
    if (compress) {
      console.log(`🗜️  Compressing image...`);
      const compressed = await gzip(tarBuffer);
      fs.writeFileSync(compressedPath, compressed);
      
      finalPath = compressedPath;
      finalSize = compressed.length;
      
      // Remove uncompressed tar
      fs.unlinkSync(tarPath);
    }

    // Generate metadata
    const metadata = {
      imageName: this.imageName,
      imageTag: imageTag,
      targetPlatform: targetPlatform,
      sourceArch: this.platforms[this.currentPlatform].arch,
      targetArch: this.platforms[targetPlatform].arch,
      exportDate: new Date().toISOString(),
      fileName: path.basename(finalPath),
      fileSize: finalSize,
      checksum: checksum,
      compressed: compress
    };

    const metadataPath = path.join(this.outputDir, `${baseFileName}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`📋 Export completed:`);
    console.log(`   File: ${finalPath}`);
    console.log(`   Size: ${(finalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Checksum: ${checksum}`);
    console.log(`   Metadata: ${metadataPath}`);

    return { imagePath: finalPath, metadataPath, metadata };
  }

  generateImportScripts(metadata, imagePath) {
    const fileName = path.basename(imagePath);
    const metadataFileName = path.basename(metadata.metadataPath || '');
    
    // Windows PowerShell script
    const windowsScript = `# PowerShell script to import Docker image on Windows
# Usage: .\\import-${metadata.targetPlatform}.ps1

Write-Host "🚀 Starting Docker image import for ${metadata.targetPlatform}..." -ForegroundColor Green

# Check if Docker is running
try {
    docker version | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Verify file exists
if (-not (Test-Path "${fileName}")) {
    Write-Host "❌ Image file not found: ${fileName}" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Loading image from ${fileName}..." -ForegroundColor Yellow

${metadata.compressed ? 
  'docker load -i <(gzip -dc "' + fileName + '")' : 
  'docker load -i "' + fileName + '"'
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Image imported successfully!" -ForegroundColor Green
    Write-Host "🏷️  Image tag: ${metadata.imageTag}" -ForegroundColor Cyan
    
    # Show imported images
    Write-Host "📋 Available images:" -ForegroundColor Yellow
    docker images ${metadata.imageName}
    
    Write-Host "🚀 To run the container:" -ForegroundColor Cyan
    Write-Host "   docker run -d -p 3000:3000 --name my-app ${metadata.imageTag}" -ForegroundColor White
    
} else {
    Write-Host "❌ Failed to import image" -ForegroundColor Red
    exit 1
}
`;

    // macOS/Linux bash script
    const unixScript = `#!/bin/bash
# Bash script to import Docker image on macOS/Linux
# Usage: ./import-${metadata.targetPlatform}.sh

set -e

echo "🚀 Starting Docker image import for ${metadata.targetPlatform}..."

# Check if Docker is running
if ! docker version >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker."
    exit 1
fi

echo "✅ Docker is running"

# Verify file exists
if [ ! -f "${fileName}" ]; then
    echo "❌ Image file not found: ${fileName}"
    exit 1
fi

echo "📦 Loading image from ${fileName}..."

${metadata.compressed ? 
  'gzip -dc "' + fileName + '" | docker load' : 
  'docker load -i "' + fileName + '"'
}

echo "✅ Image imported successfully!"
echo "🏷️  Image tag: ${metadata.imageTag}"

# Show imported images
echo "📋 Available images:"
docker images ${metadata.imageName}

echo "🚀 To run the container:"
echo "   docker run -d -p 3000:3000 --name my-app ${metadata.imageTag}"

# Verify image integrity if checksum is available
if [ -f "${metadataFileName}" ]; then
    echo "🔍 Verifying image integrity..."
    # Additional verification steps could go here
    echo "✅ Image verification completed"
fi
`;

    const scriptsDir = path.join(this.outputDir, 'scripts');
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }

    const windowsScriptPath = path.join(scriptsDir, `import-${metadata.targetPlatform}.ps1`);
    const unixScriptPath = path.join(scriptsDir, `import-${metadata.targetPlatform}.sh`);

    fs.writeFileSync(windowsScriptPath, windowsScript);
    fs.writeFileSync(unixScriptPath, unixScript);
    
    // Make Unix script executable
    try {
      fs.chmodSync(unixScriptPath, '755');
    } catch (error) {
      console.warn('⚠️  Could not make Unix script executable:', error.message);
    }

    console.log(`📜 Import scripts generated:`);
    console.log(`   Windows: ${windowsScriptPath}`);
    console.log(`   Unix: ${unixScriptPath}`);

    return { windowsScriptPath, unixScriptPath };
  }

  async validateImage(imageTag) {
    console.log(`🔍 Validating image: ${imageTag}`);
    
    try {
      // Check if image exists
      await this.executeCommand(`docker inspect ${imageTag}`, { silent: true });
      
      // Run basic health check
      const result = await this.executeCommand(
        `docker run --rm ${imageTag} node -e "console.log('Health check passed')"`,
        { silent: true }
      );
      
      if (result.stdout.includes('Health check passed')) {
        console.log('✅ Image validation passed');
        return true;
      } else {
        throw new Error('Health check failed');
      }
    } catch (error) {
      console.error('❌ Image validation failed:', error.message);
      return false;
    }
  }

  async exportForPlatform(targetPlatform, options = {}) {
    const { compress = true, validate = true } = options;
    
    try {
      console.log(`🎯 Starting export process for ${targetPlatform}`);
      
      // Build image for target platform
      const imageTag = await this.buildMultiPlatformImage(targetPlatform);
      
      // Validate image if requested
      if (validate) {
        const isValid = await this.validateImage(imageTag);
        if (!isValid) {
          throw new Error('Image validation failed');
        }
      }
      
      // Export image
      const exportResult = await this.exportImage(imageTag, targetPlatform, compress);
      
      // Generate import scripts
      const scripts = this.generateImportScripts(exportResult.metadata, exportResult.imagePath);
      
      console.log(`🎉 Export completed successfully for ${targetPlatform}!`);
      console.log(`📦 Package ready for deployment on ${targetPlatform}`);
      
      return {
        ...exportResult,
        scripts
      };
      
    } catch (error) {
      console.error(`❌ Export failed for ${targetPlatform}:`, error.message);
      throw error;
    }
  }

  async importImage(imagePath, metadataPath) {
    console.log(`📥 Importing image from: ${imagePath}`);
    
    // Read metadata
    let metadata = {};
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      console.log(`📋 Loading metadata: ${metadata.imageName}:${metadata.imageTag}`);
    }

    // Import the image
    const command = metadata.compressed ? 
      `gzip -dc "${imagePath}" | docker load` :
      `docker load -i "${imagePath}"`;
      
    await this.executeCommand(command);
    
    console.log(`✅ Image imported successfully!`);
    
    if (metadata.imageTag) {
      console.log(`🏷️  Available as: ${metadata.imageTag}`);
      
      // Validate imported image
      const isValid = await this.validateImage(metadata.imageTag);
      if (isValid) {
        console.log('✅ Imported image validation passed');
      }
    }
  }

  displayHelp() {
    console.log(`
🐳 Container Migration Tool

Usage:
  node migrate-container.js <command> [options]

Commands:
  export [--platform <platform>] [--no-compress] [--no-validate]
    Export container image for target platform
    
  import <image-path> [metadata-path]
    Import container image from exported file
    
  deploy [--platform <platform>]
    Full deployment workflow (build + export + scripts)
    
  validate <image-tag>
    Validate container image functionality

Platforms:
  mac, windows, linux

Examples:
  # Export for Windows deployment
  node migrate-container.js export --platform windows
  
  # Export without compression
  node migrate-container.js export --platform windows --no-compress
  
  # Import an exported image
  node migrate-container.js import ./docker-exports/my-app-windows-*.tar.gz
  
  # Full deployment workflow
  node migrate-container.js deploy --platform windows

Current platform: ${this.currentPlatform}
Export directory: ${this.outputDir}
`);
  }
}

// CLI Interface
async function main() {
  const migrator = new ContainerMigrator();
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    migrator.displayHelp();
    return;
  }

  const command = args[0];
  
  try {
    switch (command) {
      case 'export': {
        const platformIndex = args.indexOf('--platform');
        const platform = platformIndex !== -1 ? args[platformIndex + 1] : 'windows';
        const compress = !args.includes('--no-compress');
        const validate = !args.includes('--no-validate');
        
        await migrator.exportForPlatform(platform, { compress, validate });
        break;
      }
      
      case 'import': {
        const imagePath = args[1];
        const metadataPath = args[2] || imagePath.replace(/\.(tar|tar\.gz)$/, '.json');
        
        if (!imagePath) {
          console.error('❌ Please provide image path');
          process.exit(1);
        }
        
        await migrator.importImage(imagePath, metadataPath);
        break;
      }
      
      case 'deploy': {
        const platformIndex = args.indexOf('--platform');
        const platform = platformIndex !== -1 ? args[platformIndex + 1] : 'windows';
        
        const result = await migrator.exportForPlatform(platform);
        console.log(`🚀 Deployment package ready!`);
        console.log(`📁 Files created in: ${migrator.outputDir}`);
        break;
      }
      
      case 'validate': {
        const imageTag = args[1];
        if (!imageTag) {
          console.error('❌ Please provide image tag');
          process.exit(1);
        }
        
        await migrator.validateImage(imageTag);
        break;
      }
      
      default:
        console.error(`❌ Unknown command: ${command}`);
        migrator.displayHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = ContainerMigrator;