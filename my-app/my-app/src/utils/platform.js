const os = require('os');
const fs = require('fs');
const path = require('path');

class PlatformUtils {
  constructor() {
    this.platformInfo = this.detectPlatform();
  }

  detectPlatform() {
    const platform = process.platform;
    const arch = process.arch;
    const nodeVersion = process.version;
    const containerInfo = this.detectContainer();

    return {
      os: {
        platform,
        arch,
        type: os.type(),
        release: os.release(),
        version: os.version(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        loadavg: os.loadavg(),
        totalmem: os.totalmem(),
        freemem: os.freemem(),
        cpus: os.cpus().length
      },
      node: {
        version: nodeVersion,
        execPath: process.execPath,
        argv: process.argv,
        pid: process.pid,
        ppid: process.ppid,
        env: process.env.NODE_ENV || 'development'
      },
      container: containerInfo,
      docker: {
        buildPlatform: process.env.BUILD_PLATFORM,
        targetPlatform: process.env.TARGET_PLATFORM,
        isInContainer: this.isInContainer()
      }
    };
  }

  detectContainer() {
    const containerInfo = {
      isContainer: false,
      runtime: null,
      id: null,
      image: null
    };

    try {
      // Check for Docker container
      if (fs.existsSync('/.dockerenv')) {
        containerInfo.isContainer = true;
        containerInfo.runtime = 'docker';
      }

      // Check cgroup for container info
      if (fs.existsSync('/proc/1/cgroup')) {
        const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
        
        if (cgroup.includes('docker')) {
          containerInfo.isContainer = true;
          containerInfo.runtime = 'docker';
          
          // Extract container ID
          const dockerMatch = cgroup.match(/docker\/([a-f0-9]{64})/);
          if (dockerMatch) {
            containerInfo.id = dockerMatch[1];
          }
        } else if (cgroup.includes('kubepods')) {
          containerInfo.isContainer = true;
          containerInfo.runtime = 'kubernetes';
        } else if (cgroup.includes('lxc')) {
          containerInfo.isContainer = true;
          containerInfo.runtime = 'lxc';
        }
      }

      // Check for Kubernetes
      if (process.env.KUBERNETES_SERVICE_HOST) {
        containerInfo.runtime = 'kubernetes';
        containerInfo.isContainer = true;
      }

    } catch (error) {
      // Ignore errors in container detection
    }

    return containerInfo;
  }

  isInContainer() {
    try {
      return this.platformInfo && 
             this.platformInfo.container && 
             this.platformInfo.container.isContainer === true;
    } catch (error) {
      return false;
    }
  }

  isMac() {
    return this.platformInfo.os.platform === 'darwin';
  }

  isWindows() {
    return this.platformInfo.os.platform === 'win32';
  }

  isLinux() {
    return this.platformInfo.os.platform === 'linux';
  }

  isArm64() {
    return this.platformInfo.os.arch === 'arm64';
  }

  isX64() {
    return this.platformInfo.os.arch === 'x64';
  }

  getPlatformInfo() {
    return this.platformInfo;
  }

  getArchitecture() {
    return this.platformInfo.os.arch;
  }

  getPlatformName() {
    const { platform, arch } = this.platformInfo.os;
    
    switch (platform) {
      case 'darwin':
        return arch === 'arm64' ? 'macOS (Apple Silicon)' : 'macOS (Intel)';
      case 'win32':
        return `Windows (${arch})`;
      case 'linux':
        return `Linux (${arch})`;
      default:
        return `${platform} (${arch})`;
    }
  }

  normalizedPath(...segments) {
    // Always use POSIX paths inside containers
    if (this.isInContainer()) {
      return path.posix.join(...segments);
    }
    
    // Use platform-specific paths on host
    return path.join(...segments);
  }

  getPathSeparator() {
    if (this.isInContainer()) {
      return '/';
    }
    return path.sep;
  }

  getFileSystemInfo() {
    const info = {
      pathSeparator: this.getPathSeparator(),
      caseSensitive: this.isLinux() || (this.isMac() && this.isInContainer()),
      maxPathLength: this.isWindows() ? 260 : 4096,
      supportSymlinks: !this.isWindows() || this.isInContainer()
    };

    return info;
  }

  getEnvironmentVariables() {
    const sensitiveKeys = [
      'PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'AUTH', 'PRIVATE'
    ];

    const env = {};
    for (const [key, value] of Object.entries(process.env)) {
      // Mask sensitive environment variables
      if (sensitiveKeys.some(sensitive => key.toUpperCase().includes(sensitive))) {
        env[key] = '***MASKED***';
      } else {
        env[key] = value;
      }
    }

    return env;
  }

  getNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const networkInfo = {};

    for (const [name, addresses] of Object.entries(interfaces)) {
      networkInfo[name] = addresses.map(addr => ({
        address: addr.address,
        netmask: addr.netmask,
        family: addr.family,
        internal: addr.internal
      }));
    }

    return networkInfo;
  }

  getMemoryInfo() {
    const memoryUsage = process.memoryUsage();
    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    };

    return {
      process: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers
      },
      system: systemMemory,
      percentage: {
        used: ((systemMemory.used / systemMemory.total) * 100).toFixed(2),
        processOfTotal: ((memoryUsage.rss / systemMemory.total) * 100).toFixed(2)
      }
    };
  }

  getCPUInfo() {
    const cpus = os.cpus();
    const loadavg = os.loadavg();

    return {
      count: cpus.length,
      model: cpus[0]?.model || 'Unknown',
      speed: cpus[0]?.speed || 0,
      loadAverage: {
        '1min': loadavg[0],
        '5min': loadavg[1],
        '15min': loadavg[2]
      },
      architecture: this.platformInfo.os.arch
    };
  }

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  getSystemSummary() {
    const memory = this.getMemoryInfo();
    const cpu = this.getCPUInfo();

    return {
      platform: this.getPlatformName(),
      container: this.isInContainer(),
      runtime: this.platformInfo.container.runtime,
      node: this.platformInfo.node.version,
      memory: {
        total: this.formatBytes(memory.system.total),
        free: this.formatBytes(memory.system.free),
        processUsage: this.formatBytes(memory.process.rss)
      },
      cpu: {
        count: cpu.count,
        model: cpu.model,
        loadAverage: cpu.loadAverage['1min'].toFixed(2)
      },
      uptime: {
        system: Math.floor(os.uptime()),
        process: Math.floor(process.uptime())
      }
    };
  }
}

// Create singleton instance
const platformUtils = new PlatformUtils();

// CLI interface for testing
if (require.main === module) {
  console.log('Platform Detection Results:');
  console.log('============================');
  console.log(JSON.stringify(platformUtils.getSystemSummary(), null, 2));
}

module.exports = platformUtils;