// =====================================================
// WINDOWS SERVER MANAGEMENT ROUTES
// API endpoints para gestión remota de servidores Windows
// =====================================================

const express = require('express');
const router = express.Router();
const remoteWindowsService = require('../services/remoteWindowsService');
const logger = require('../config/logger');

// Middleware para manejar errores async
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// =====================================================
// CONECTIVIDAD Y DIAGNÓSTICO
// =====================================================

/**
 * GET /api/windows/connectivity
 * Verificar conectividad con el servidor Windows
 */
router.get('/connectivity', asyncHandler(async (req, res) => {
    logger.info('Verificando conectividad con servidor Windows');

    const result = await remoteWindowsService.checkConnectivity();

    res.json(result);
}));

/**
 * GET /api/windows/system-info
 * Obtener información del sistema Windows
 */
router.get('/system-info', asyncHandler(async (req, res) => {
    logger.info('Obteniendo información del sistema Windows');

    const result = await remoteWindowsService.getSystemInfo();

    if (!result.success) {
        return res.status(500).json(result);
    }

    res.json(result);
}));

/**
 * GET /api/windows/resources
 * Obtener uso de CPU y memoria
 */
router.get('/resources', asyncHandler(async (req, res) => {
    logger.info('Obteniendo uso de recursos del servidor Windows');

    const result = await remoteWindowsService.getResourceUsage();

    if (!result.success) {
        return res.status(500).json(result);
    }

    res.json(result);
}));

/**
 * GET /api/windows/disk-space
 * Obtener espacio en disco
 */
router.get('/disk-space', asyncHandler(async (req, res) => {
    logger.info('Obteniendo espacio en disco del servidor Windows');

    const result = await remoteWindowsService.getDiskSpace();

    if (!result.success) {
        return res.status(500).json(result);
    }

    res.json(result);
}));

// =====================================================
// GESTIÓN DE SERVICIOS
// =====================================================

/**
 * GET /api/windows/services
 * Obtener estado de servicios
 * Query params: ?names=service1,service2,service3
 */
router.get('/services', asyncHandler(async (req, res) => {
    const serviceNames = req.query.names ? req.query.names.split(',') : [];

    logger.info('Obteniendo estado de servicios', { serviceNames });

    const result = await remoteWindowsService.getServicesStatus(serviceNames);

    if (!result.success) {
        return res.status(500).json(result);
    }

    res.json(result);
}));

/**
 * POST /api/windows/services/:serviceName/restart
 * Reiniciar un servicio
 */
router.post('/services/:serviceName/restart', asyncHandler(async (req, res) => {
    const { serviceName } = req.params;

    logger.info('Solicitud de reinicio de servicio', { serviceName });

    const result = await remoteWindowsService.restartService(serviceName);

    if (!result.success) {
        return res.status(500).json(result);
    }

    res.json(result);
}));

// =====================================================
// GESTIÓN DE PROCESOS
// =====================================================

/**
 * GET /api/windows/processes
 * Obtener procesos en ejecución
 * Query params: ?name=processName
 */
router.get('/processes', asyncHandler(async (req, res) => {
    const processName = req.query.name || null;

    logger.info('Obteniendo procesos en ejecución', { processName });

    const result = await remoteWindowsService.getProcesses(processName);

    if (!result.success) {
        return res.status(500).json(result);
    }

    res.json(result);
}));

/**
 * DELETE /api/windows/processes/:processId
 * Detener un proceso
 */
router.delete('/processes/:processId', asyncHandler(async (req, res) => {
    const processId = parseInt(req.params.processId, 10);

    if (isNaN(processId)) {
        return res.status(400).json({
            success: false,
            error: 'ID de proceso inválido'
        });
    }

    logger.info('Solicitud de detención de proceso', { processId });

    const result = await remoteWindowsService.killProcess(processId);

    if (!result.success) {
        return res.status(500).json(result);
    }

    res.json(result);
}));

// =====================================================
// LOGS Y EVENTOS
// =====================================================

/**
 * GET /api/windows/event-logs
 * Obtener logs del Event Viewer
 * Query params: ?logName=Application&maxEvents=50
 */
router.get('/event-logs', asyncHandler(async (req, res) => {
    const logName = req.query.logName || 'Application';
    const maxEvents = parseInt(req.query.maxEvents, 10) || 50;

    logger.info('Obteniendo logs de eventos', { logName, maxEvents });

    const result = await remoteWindowsService.getEventLogs(logName, maxEvents);

    if (!result.success) {
        return res.status(500).json(result);
    }

    res.json(result);
}));

// =====================================================
// EJECUCIÓN DE COMANDOS PERSONALIZADOS
// =====================================================

/**
 * POST /api/windows/execute
 * Ejecutar comando personalizado
 * Body: { command: string, type: 'cmd' | 'powershell' }
 */
router.post('/execute', asyncHandler(async (req, res) => {
    const { command, type = 'cmd' } = req.body;

    if (!command) {
        return res.status(400).json({
            success: false,
            error: 'Comando requerido'
        });
    }

    logger.info('Ejecutando comando personalizado', { command: command.substring(0, 100), type });

    let result;
    if (type === 'powershell') {
        result = await remoteWindowsService.executePowerShell(command);
    } else {
        result = await remoteWindowsService.executeCommand(command);
    }

    if (!result.success) {
        return res.status(500).json(result);
    }

    res.json(result);
}));

// =====================================================
// HEALTH CHECK
// =====================================================

/**
 * GET /api/windows/health
 * Health check completo del servidor Windows
 */
router.get('/health', asyncHandler(async (req, res) => {
    logger.info('Ejecutando health check del servidor Windows');

    try {
        // Ejecutar múltiples checks en paralelo
        const [connectivity, systemInfo, resources, diskSpace] = await Promise.all([
            remoteWindowsService.checkConnectivity(),
            remoteWindowsService.getSystemInfo(),
            remoteWindowsService.getResourceUsage(),
            remoteWindowsService.getDiskSpace()
        ]);

        const healthStatus = {
            success: connectivity.success && connectivity.reachable,
            timestamp: new Date().toISOString(),
            connectivity: {
                reachable: connectivity.reachable,
                message: connectivity.message
            },
            system: systemInfo.success ? systemInfo.data : { error: systemInfo.error },
            resources: resources.success ? resources.data : { error: resources.error },
            diskSpace: diskSpace.success ? diskSpace.data : { error: diskSpace.error }
        };

        // Evaluar salud general
        healthStatus.overall = 'healthy';
        if (!connectivity.reachable) {
            healthStatus.overall = 'unreachable';
        } else if (resources.success && resources.data.cpu > 90) {
            healthStatus.overall = 'warning';
        } else if (diskSpace.success) {
            const criticalDisk = diskSpace.data.find(disk => disk.UsedPercent > 90);
            if (criticalDisk) {
                healthStatus.overall = 'warning';
            }
        }

        res.json(healthStatus);
    } catch (error) {
        logger.error('Error en health check', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
            overall: 'error'
        });
    }
}));

// =====================================================
// ERROR HANDLER
// =====================================================

router.use((error, req, res, next) => {
    logger.error('Error en ruta de Windows', {
        error: error.message,
        stack: error.stack,
        path: req.path
    });

    res.status(500).json({
        success: false,
        error: error.message,
        message: 'Error en operación de servidor Windows'
    });
});

module.exports = router;
