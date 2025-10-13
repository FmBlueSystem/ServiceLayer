const os = require('os');
const fs = require('fs');
const path = require('path');

class PlatformUtils {
  constructor() {
    this.platformInfo = this.detectPlatform();
  }

  safeOsCall(fn, fallback = null) {
    try {
      return fn();
    } catch (error) {
      return fallback;
    }
  }

  detectPlatform() {
    const platform = process.platform;
    const arch = process.arch;
    const nodeVersion = process.version;
    const containerInfo = this.detectContainer();
    const cpuInfo = this.safeOsCall(() => os.cpus(), []);

    return {
      os: {
        platform,
        arch,
        type: this.safeOsCall(() => os.type()),
        release: this.safeOsCall(() => os.release()),
        version: this.safeOsCall(() => os.version()),
        hostname: this.safeOsCall(() => os.hostname()),
        uptime: this.safeOsCall(() => os.uptime()),
        loadavg: this.safeOsCall(() => os.loadavg(), []),
        totalmem: this.safeOsCall(() => os.totalmem()),
        freemem: this.safeOsCall(() => os.freemem()),
        cpus: Array.isArray(cpuInfo) ? cpuInfo.length : null
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
    const interfaces = this.safeOsCall(() => os.networkInterfaces(), {});
    
    if (!interfaces || typeof interfaces !== 'object') {
      return {};
    }

    const networkInfo = {};

    for (const [name, addresses] of Object.entries(interfaces)) {
      networkInfo[name] = (addresses || []).map(addr => ({
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
    const total = this.safeOsCall(() => os.totalmem(), 0);
    const free = this.safeOsCall(() => os.freemem(), 0);
    const used = total > 0 ? total - free : 0;
    const systemMemory = {
      total,
      free,
      used
    };

    const usedPercent = total > 0 ? ((used / total) * 100).toFixed(2) : '0.00';
    const processPercent = total > 0 ? ((memoryUsage.rss / total) * 100).toFixed(2) : '0.00';

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
        used: usedPercent,
        processOfTotal: processPercent
      }
    };
  }

  getCPUInfo() {
    const cpus = this.safeOsCall(() => os.cpus(), []);
    const loadavg = this.safeOsCall(() => os.loadavg(), [0, 0, 0]);
    const cpu = Array.isArray(cpus) && cpus.length > 0 ? cpus[0] : null;

    return {
      count: Array.isArray(cpus) ? cpus.length : 0,
      model: cpu?.model || 'Unknown',
      speed: cpu?.speed || 0,
      loadAverage: {
        '1min': Array.isArray(loadavg) ? loadavg[0] || 0 : 0,
        '5min': Array.isArray(loadavg) ? loadavg[1] || 0 : 0,
        '15min': Array.isArray(loadavg) ? loadavg[2] || 0 : 0
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
    const systemUptime = this.safeOsCall(() => os.uptime(), 0);

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
        loadAverage: cpu.loadAverage['1min'].toFixed ? cpu.loadAverage['1min'].toFixed(2) : cpu.loadAverage['1min']
      },
      uptime: {
        system: Math.floor(systemUptime || 0),
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
