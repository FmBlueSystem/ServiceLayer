// =====================================================
// REMOTE WINDOWS SERVER MANAGEMENT SERVICE
// Gestión remota de servidores Windows via SSH
// =====================================================

const { Client } = require('ssh2');
const logger = require('../config/logger');

class RemoteWindowsService {
    constructor() {
        // Configuración de servidores Windows
        this.servers = {
            production: {
                host: '10.13.0.29',
                port: 22,
                username: 'fmolinam',
                password: process.env.WINDOWS_SSH_PASSWORD || 'Fmvidayo28@',
                readyTimeout: 10000,
                keepaliveInterval: 10000
            }
        };

        this.defaultServer = 'production';
    }

    /**
     * Ejecutar comando en servidor Windows via SSH
     * @param {string} command - Comando a ejecutar
     * @param {string} serverName - Nombre del servidor (default: 'production')
     * @returns {Promise<{success: boolean, stdout: string, stderr: string, exitCode: number}>}
     */
    async executeCommand(command, serverName = null) {
        const server = serverName ? this.servers[serverName] : this.servers[this.defaultServer];

        if (!server) {
            throw new Error(`Servidor no encontrado: ${serverName}`);
        }

        return new Promise((resolve, reject) => {
            const conn = new Client();
            let stdout = '';
            let stderr = '';
            let exitCode = null;

            logger.info('Conectando a servidor Windows...', {
                host: server.host,
                username: server.username
            });

            conn.on('ready', () => {
                logger.info('Conexión SSH establecida');

                conn.exec(command, (err, stream) => {
                    if (err) {
                        conn.end();
                        return reject(new Error(`Error ejecutando comando: ${err.message}`));
                    }

                    stream.on('close', (code, signal) => {
                        exitCode = code;
                        conn.end();

                        logger.info('Comando ejecutado', {
                            command: command.substring(0, 100),
                            exitCode,
                            stdoutLength: stdout.length,
                            stderrLength: stderr.length
                        });

                        resolve({
                            success: exitCode === 0,
                            stdout,
                            stderr,
                            exitCode
                        });
                    });

                    stream.on('data', (data) => {
                        stdout += data.toString('utf8');
                    });

                    stream.stderr.on('data', (data) => {
                        stderr += data.toString('utf8');
                    });
                });
            });

            conn.on('error', (err) => {
                logger.error('Error de conexión SSH', {
                    host: server.host,
                    error: err.message
                });
                reject(new Error(`Error de conexión SSH: ${err.message}`));
            });

            conn.on('timeout', () => {
                logger.error('Timeout de conexión SSH', { host: server.host });
                reject(new Error('Timeout de conexión SSH'));
            });

            // Conectar
            conn.connect(server);
        });
    }

    /**
     * Ejecutar comando PowerShell
     * @param {string} psCommand - Comando PowerShell
     * @param {string} serverName - Nombre del servidor
     */
    async executePowerShell(psCommand, serverName = null) {
        const command = `powershell -Command "${psCommand.replace(/"/g, '\\"')}"`;
        return this.executeCommand(command, serverName);
    }

    /**
     * Verificar conectividad con el servidor
     */
    async checkConnectivity(serverName = null) {
        try {
            const result = await this.executeCommand('echo OK', serverName);
            return {
                success: true,
                reachable: result.success,
                message: 'Servidor accesible via SSH'
            };
        } catch (error) {
            return {
                success: false,
                reachable: false,
                message: error.message
            };
        }
    }

    /**
     * Obtener información del sistema Windows
     */
    async getSystemInfo(serverName = null) {
        try {
            const result = await this.executeCommand('systeminfo', serverName);

            if (!result.success) {
                throw new Error('No se pudo obtener información del sistema');
            }

            // Parsear información básica
            const info = this._parseSystemInfo(result.stdout);

            return {
                success: true,
                data: info
            };
        } catch (error) {
            logger.error('Error obteniendo información del sistema', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener estado de servicios de Windows
     */
    async getServicesStatus(serviceNames = [], serverName = null) {
        try {
            const services = serviceNames.length > 0
                ? serviceNames
                : ['*'];  // Todos los servicios si no se especifican

            const psCommand = `Get-Service ${services.join(',')} | Select-Object Name, Status, DisplayName | ConvertTo-Json`;
            const result = await this.executePowerShell(psCommand, serverName);

            if (!result.success) {
                throw new Error('No se pudo obtener estado de servicios');
            }

            const servicesData = JSON.parse(result.stdout);

            return {
                success: true,
                data: Array.isArray(servicesData) ? servicesData : [servicesData]
            };
        } catch (error) {
            logger.error('Error obteniendo estado de servicios', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Reiniciar un servicio de Windows
     */
    async restartService(serviceName, serverName = null) {
        try {
            logger.info(`Reiniciando servicio: ${serviceName}`);

            const psCommand = `Restart-Service -Name "${serviceName}" -Force`;
            const result = await this.executePowerShell(psCommand, serverName);

            if (!result.success) {
                throw new Error(`No se pudo reiniciar el servicio: ${result.stderr}`);
            }

            return {
                success: true,
                message: `Servicio ${serviceName} reiniciado correctamente`
            };
        } catch (error) {
            logger.error('Error reiniciando servicio', { serviceName, error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener procesos en ejecución
     */
    async getProcesses(processName = null, serverName = null) {
        try {
            const filter = processName ? `-Name "${processName}"` : '';
            const psCommand = `Get-Process ${filter} | Select-Object ProcessName, Id, CPU, WorkingSet | ConvertTo-Json`;

            const result = await this.executePowerShell(psCommand, serverName);

            if (!result.success) {
                throw new Error('No se pudo obtener lista de procesos');
            }

            const processes = JSON.parse(result.stdout);

            return {
                success: true,
                data: Array.isArray(processes) ? processes : [processes]
            };
        } catch (error) {
            logger.error('Error obteniendo procesos', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Detener un proceso
     */
    async killProcess(processId, serverName = null) {
        try {
            logger.info(`Deteniendo proceso: ${processId}`);

            const psCommand = `Stop-Process -Id ${processId} -Force`;
            const result = await this.executePowerShell(psCommand, serverName);

            if (!result.success) {
                throw new Error(`No se pudo detener el proceso: ${result.stderr}`);
            }

            return {
                success: true,
                message: `Proceso ${processId} detenido correctamente`
            };
        } catch (error) {
            logger.error('Error deteniendo proceso', { processId, error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener uso de CPU y memoria
     */
    async getResourceUsage(serverName = null) {
        try {
            const psCommand = `
                $cpu = (Get-Counter '\\Processor(_Total)\\% Processor Time').CounterSamples.CookedValue;
                $mem = Get-WmiObject Win32_OperatingSystem;
                $memUsed = [math]::Round(($mem.TotalVisibleMemorySize - $mem.FreePhysicalMemory) / 1MB, 2);
                $memTotal = [math]::Round($mem.TotalVisibleMemorySize / 1MB, 2);
                $memPercent = [math]::Round(($memUsed / $memTotal) * 100, 2);
                @{
                    cpu = [math]::Round($cpu, 2);
                    memoryUsedGB = $memUsed;
                    memoryTotalGB = $memTotal;
                    memoryPercent = $memPercent;
                } | ConvertTo-Json
            `;

            const result = await this.executePowerShell(psCommand, serverName);

            if (!result.success) {
                throw new Error('No se pudo obtener uso de recursos');
            }

            const usage = JSON.parse(result.stdout);

            return {
                success: true,
                data: usage
            };
        } catch (error) {
            logger.error('Error obteniendo uso de recursos', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener logs de Windows Event Viewer
     */
    async getEventLogs(logName = 'Application', maxEvents = 50, serverName = null) {
        try {
            const psCommand = `
                Get-EventLog -LogName ${logName} -Newest ${maxEvents} |
                Select-Object TimeGenerated, EntryType, Source, Message |
                ConvertTo-Json
            `;

            const result = await this.executePowerShell(psCommand, serverName);

            if (!result.success) {
                throw new Error('No se pudo obtener logs de eventos');
            }

            const logs = JSON.parse(result.stdout);

            return {
                success: true,
                data: Array.isArray(logs) ? logs : [logs]
            };
        } catch (error) {
            logger.error('Error obteniendo logs de eventos', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verificar espacio en disco
     */
    async getDiskSpace(serverName = null) {
        try {
            const psCommand = `
                Get-WmiObject Win32_LogicalDisk -Filter "DriveType=3" |
                Select-Object DeviceID, VolumeName,
                    @{Name="SizeGB";Expression={[math]::Round($_.Size/1GB,2)}},
                    @{Name="FreeGB";Expression={[math]::Round($_.FreeSpace/1GB,2)}},
                    @{Name="UsedPercent";Expression={[math]::Round((($_.Size-$_.FreeSpace)/$_.Size)*100,2)}} |
                ConvertTo-Json
            `;

            const result = await this.executePowerShell(psCommand, serverName);

            if (!result.success) {
                throw new Error('No se pudo obtener información de discos');
            }

            const disks = JSON.parse(result.stdout);

            return {
                success: true,
                data: Array.isArray(disks) ? disks : [disks]
            };
        } catch (error) {
            logger.error('Error obteniendo espacio en disco', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Parsear información de systeminfo
     */
    _parseSystemInfo(systemInfoOutput) {
        const lines = systemInfoOutput.split('\n');
        const info = {};

        lines.forEach(line => {
            const match = line.match(/^([^:]+):\s+(.+)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim();
                info[key] = value;
            }
        });

        return {
            hostname: info['Host Name'] || info['Nombre de host'],
            os: info['OS Name'] || info['Nombre del sistema operativo'],
            osVersion: info['OS Version'] || info['Versión del sistema operativo'],
            systemType: info['System Type'] || info['Tipo de sistema'],
            totalPhysicalMemory: info['Total Physical Memory'] || info['Memoria física total'],
            availablePhysicalMemory: info['Available Physical Memory'] || info['Memoria física disponible']
        };
    }
}

module.exports = new RemoteWindowsService();
