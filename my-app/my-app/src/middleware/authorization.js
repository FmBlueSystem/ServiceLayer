// =====================================================
// MIDDLEWARE DE AUTORIZACIÓN
// Verifica permisos antes de ejecutar rutas
// =====================================================

const permissionService = require('../services/permissionService');
const logger = require('../config/logger');

/**
 * Middleware para verificar permisos
 * @param {string} resource - Recurso a verificar (ej: 'tipos_cambio')
 * @param {string} action - Acción a verificar (ej: 'view', 'create')
 * @param {object} options - Opciones adicionales
 */
const checkPermission = (resource, action, options = {}) => {
    return async (req, res, next) => {
        try {
            // Obtener username desde la sesión, header o body (en ese orden de preferencia)
            const username = req.session?.sapUsername || req.headers['x-sap-username'] || req.body?.username;
            const companyDB = req.body?.companyDB || req.query?.companyDB || req.params?.companyDB;

            // Verificar que el usuario está autenticado
            if (!username) {
                logger.warn('Intento de acceso sin autenticación', {
                    path: req.path,
                    ip: req.ip
                });

                return res.status(401).json({
                    success: false,
                    error: 'No autenticado. Por favor inicia sesión.',
                    code: 'UNAUTHORIZED'
                });
            }

            // Verificar permiso
            const hasPermission = await permissionService.hasPermission(
                username,
                resource,
                action,
                companyDB
            );

            if (!hasPermission) {
                // Registrar intento no autorizado
                await permissionService.logAuditEvent({
                    username,
                    action: 'UNAUTHORIZED_ACCESS',
                    resource,
                    company_db: companyDB,
                    details: {
                        attempted_action: action,
                        path: req.path,
                        method: req.method
                    },
                    ip_address: req.ip,
                    user_agent: req.get('user-agent'),
                    success: false,
                    error_message: `Sin permiso para ${action} en ${resource}`
                });

                logger.warn('Acceso denegado', {
                    username,
                    resource,
                    action,
                    companyDB,
                    path: req.path
                });

                return res.status(403).json({
                    success: false,
                    error: 'No tienes permisos para realizar esta acción',
                    code: 'FORBIDDEN',
                    details: {
                        resource,
                        action,
                        company: companyDB
                    }
                });
            }

            // Registrar acción autorizada (si audit está habilitado)
            if (options.audit !== false) {
                // No esperar el log para no retrasar la respuesta
                permissionService.logAuditEvent({
                    username,
                    action,
                    resource,
                    company_db: companyDB,
                    details: {
                        path: req.path,
                        method: req.method,
                        body: req.body
                    },
                    ip_address: req.ip,
                    user_agent: req.get('user-agent'),
                    success: true
                }).catch(err => {
                    logger.error('Error logging audit event:', err);
                });
            }

            // Permiso concedido - guardar username en req para uso en las rutas
            req.sapUsername = username;
            req.session = req.session || {};
            req.session.sapUsername = username;

            next();

        } catch (error) {
            logger.error('Error en middleware de autorización:', error);
            res.status(500).json({
                success: false,
                error: 'Error al verificar permisos',
                code: 'INTERNAL_ERROR'
            });
        }
    };
};

/**
 * Middleware para verificar que el usuario está autenticado
 */
const requireAuth = (req, res, next) => {
    const username = req.session?.sapUsername || req.headers['x-sap-username'] || req.body?.username;

    if (!username) {
        return res.status(401).json({
            success: false,
            error: 'No autenticado. Por favor inicia sesión.',
            code: 'UNAUTHORIZED'
        });
    }

    // Guardar username en req para uso en las rutas
    req.sapUsername = username;
    req.session = req.session || {};
    req.session.sapUsername = username;

    next();
};

/**
 * Middleware para verificar acceso a una compañía específica
 */
const checkCompanyAccess = async (req, res, next) => {
    try {
        const username = req.session?.sapUsername;
        const companyDB = req.body?.companyDB || req.query?.companyDB || req.params?.companyDB;

        if (!username) {
            return res.status(401).json({
                success: false,
                error: 'No autenticado',
                code: 'UNAUTHORIZED'
            });
        }

        if (!companyDB) {
            return next(); // Si no se especifica compañía, continuar
        }

        const authorizedCompanies = await permissionService.getUserAuthorizedCompanies(username);

        // Si tiene acceso a todas las compañías
        if (authorizedCompanies.includes('*')) {
            return next();
        }

        // Verificar si tiene acceso a la compañía específica
        if (!authorizedCompanies.includes(companyDB)) {
            logger.warn('Acceso denegado a compañía', {
                username,
                companyDB,
                authorizedCompanies
            });

            return res.status(403).json({
                success: false,
                error: 'No tienes acceso a esta compañía',
                code: 'COMPANY_ACCESS_DENIED',
                details: {
                    company: companyDB
                }
            });
        }

        next();

    } catch (error) {
        logger.error('Error verificando acceso a compañía:', error);
        res.status(500).json({
            success: false,
            error: 'Error al verificar acceso',
            code: 'INTERNAL_ERROR'
        });
    }
};

// Constantes de recursos y acciones para usar en las rutas
const RESOURCES = {
    DASHBOARD: 'dashboard',
    TIPOS_CAMBIO: 'tipos_cambio',
    ORDENES_VENTA: 'ordenes_venta',
    OFERTAS_VENTA: 'ofertas_venta',
    FICHAS_TECNICAS: 'fichas_tecnicas',
    ARTICULOS: 'articulos',
    REPORTES_EEFF: 'reportes_eeff',
    UDO_TEST: 'udo_test',
    USUARIOS: 'usuarios',
    CONFIGURACION: 'configuracion',
    AUDITORIA: 'auditoria'
};

const ACTIONS = {
    VIEW: 'view',
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    EXPORT: 'export',
    MANAGE: 'manage',
    SYNC: 'sync',
    REFRESH: 'refresh',
    CANCEL: 'cancel'
};

module.exports = {
    checkPermission,
    requireAuth,
    checkCompanyAccess,
    RESOURCES,
    ACTIONS
};
