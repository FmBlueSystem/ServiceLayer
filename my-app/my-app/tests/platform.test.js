const platform = require('../src/utils/platform');

describe('Platform Detection Utilities', () => {
  describe('Platform Information', () => {
    it('should detect platform information', () => {
      const platformInfo = platform.getPlatformInfo();

      expect(platformInfo).toMatchObject({
        os: {
          platform: expect.any(String),
          arch: expect.any(String),
          type: expect.any(String),
          release: expect.any(String),
          hostname: expect.any(String),
          uptime: expect.any(Number),
          loadavg: expect.any(Array),
          totalmem: expect.any(Number),
          freemem: expect.any(Number),
          cpus: expect.any(Number)
        },
        node: {
          version: expect.any(String),
          execPath: expect.any(String),
          argv: expect.any(Array),
          pid: expect.any(Number),
          env: expect.any(String)
        },
        container: {
          isContainer: expect.any(Boolean),
          runtime: expect.any([String, null]),
          id: expect.any([String, null]),
          image: expect.any([String, null])
        },
        docker: {
          buildPlatform: expect.any([String, undefined]),
          targetPlatform: expect.any([String, undefined]),
          isInContainer: expect.any(Boolean)
        }
      });
    });

    it('should detect architecture correctly', () => {
      const arch = platform.getArchitecture();
      expect(arch).toMatch(/^(x64|arm64|arm|ia32|s390x|ppc64)$/);
    });

    it('should provide platform name', () => {
      const platformName = platform.getPlatformName();
      expect(platformName).toMatch(/^(macOS|Windows|Linux)/);
    });
  });

  describe('Platform Type Detection', () => {
    it('should detect platform types', () => {
      const isMac = platform.isMac();
      const isWindows = platform.isWindows();
      const isLinux = platform.isLinux();

      expect(typeof isMac).toBe('boolean');
      expect(typeof isWindows).toBe('boolean');
      expect(typeof isLinux).toBe('boolean');

      // Exactly one should be true
      const trueCount = [isMac, isWindows, isLinux].filter(Boolean).length;
      expect(trueCount).toBe(1);
    });

    it('should detect architecture types', () => {
      const isArm64 = platform.isArm64();
      const isX64 = platform.isX64();

      expect(typeof isArm64).toBe('boolean');
      expect(typeof isX64).toBe('boolean');
    });

    it('should detect container environment', () => {
      const inContainer = platform.isInContainer();
      expect(typeof inContainer).toBe('boolean');
    });
  });

  describe('Path Utilities', () => {
    it('should normalize paths correctly', () => {
      const normalizedPath = platform.normalizedPath('path', 'to', 'file.txt');
      expect(typeof normalizedPath).toBe('string');
      expect(normalizedPath).toContain('file.txt');
    });

    it('should provide correct path separator', () => {
      const separator = platform.getPathSeparator();
      expect(separator).toMatch(/^[\/\\]$/);
    });

    it('should provide file system information', () => {
      const fsInfo = platform.getFileSystemInfo();

      expect(fsInfo).toMatchObject({
        pathSeparator: expect.stringMatching(/^[\/\\]$/),
        caseSensitive: expect.any(Boolean),
        maxPathLength: expect.any(Number),
        supportSymlinks: expect.any(Boolean)
      });

      expect(fsInfo.maxPathLength).toBeGreaterThan(0);
    });
  });

  describe('System Information', () => {
    it('should provide memory information', () => {
      const memInfo = platform.getMemoryInfo();

      expect(memInfo).toMatchObject({
        process: {
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
          external: expect.any(Number),
          arrayBuffers: expect.any(Number)
        },
        system: {
          total: expect.any(Number),
          free: expect.any(Number),
          used: expect.any(Number)
        },
        percentage: {
          used: expect.any(String),
          processOfTotal: expect.any(String)
        }
      });

      expect(memInfo.system.total).toBeGreaterThan(0);
      expect(memInfo.system.free).toBeGreaterThanOrEqual(0);
      expect(memInfo.system.used).toBeGreaterThanOrEqual(0);
      expect(parseFloat(memInfo.percentage.used)).toBeWithinRange(0, 100);
    });

    it('should provide CPU information', () => {
      const cpuInfo = platform.getCPUInfo();

      expect(cpuInfo).toMatchObject({
        count: expect.any(Number),
        model: expect.any(String),
        speed: expect.any(Number),
        loadAverage: {
          '1min': expect.any(Number),
          '5min': expect.any(Number),
          '15min': expect.any(Number)
        },
        architecture: expect.any(String)
      });

      expect(cpuInfo.count).toBeGreaterThan(0);
      expect(cpuInfo.speed).toBeGreaterThanOrEqual(0);
    });

    it('should provide network information', () => {
      const networkInfo = platform.getNetworkInfo();
      expect(typeof networkInfo).toBe('object');
      expect(Object.keys(networkInfo).length).toBeGreaterThan(0);

      // Check structure of network interfaces
      Object.values(networkInfo).forEach(interfaces => {
        expect(Array.isArray(interfaces)).toBe(true);
        
        interfaces.forEach(iface => {
          expect(iface).toMatchObject({
            address: expect.any(String),
            netmask: expect.any(String),
            family: expect.stringMatching(/^IPv[46]$/),
            internal: expect.any(Boolean)
          });
        });
      });
    });
  });

  describe('Environment Variables', () => {
    it('should mask sensitive environment variables', () => {
      // Set a test sensitive variable
      process.env.TEST_PASSWORD = 'secret123';
      process.env.TEST_API_KEY = 'api_key_123';
      process.env.TEST_NORMAL = 'normal_value';

      const envVars = platform.getEnvironmentVariables();

      expect(envVars.TEST_PASSWORD).toBe('***MASKED***');
      expect(envVars.TEST_API_KEY).toBe('***MASKED***');
      expect(envVars.TEST_NORMAL).toBe('normal_value');

      // Cleanup
      delete process.env.TEST_PASSWORD;
      delete process.env.TEST_API_KEY;
      delete process.env.TEST_NORMAL;
    });
  });

  describe('Utility Functions', () => {
    it('should format bytes correctly', () => {
      expect(platform.formatBytes(0)).toBe('0 Bytes');
      expect(platform.formatBytes(1024)).toBe('1 KB');
      expect(platform.formatBytes(1048576)).toBe('1 MB');
      expect(platform.formatBytes(1073741824)).toBe('1 GB');
      expect(platform.formatBytes(1234567890)).toMatch(/^\d+(\.\d+)?\s[KMGT]B$/);
    });

    it('should provide system summary', () => {
      const summary = platform.getSystemSummary();

      expect(summary).toMatchObject({
        platform: expect.any(String),
        container: expect.any(Boolean),
        runtime: expect.any([String, null]),
        node: expect.any(String),
        memory: {
          total: expect.stringMatching(/^\d+(\.\d+)?\s[KMGT]?B$/),
          free: expect.stringMatching(/^\d+(\.\d+)?\s[KMGT]?B$/),
          processUsage: expect.stringMatching(/^\d+(\.\d+)?\s[KMGT]?B$/)
        },
        cpu: {
          count: expect.any(Number),
          model: expect.any(String),
          loadAverage: expect.any(String)
        },
        uptime: {
          system: expect.any(Number),
          process: expect.any(Number)
        }
      });

      expect(summary.cpu.count).toBeGreaterThan(0);
      expect(summary.uptime.system).toBeGreaterThanOrEqual(0);
      expect(summary.uptime.process).toBeGreaterThanOrEqual(0);
    });
  });
});