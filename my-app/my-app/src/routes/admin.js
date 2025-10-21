// =====================================================
// RUTAS DE ADMINISTRACIÓN DE USUARIOS Y PERMISOS
// =====================================================

const express = require('express');
const router = express.Router();
const userSyncService = require('../services/userSyncService');
const permissionService = require('../services/permissionService');
const { checkPermission, requireAuth, RESOURCES, ACTIONS } = require('../middleware/authorization');
const logger = require('../config/logger');

// =====================================================
// GESTIÓN DE USUARIOS
// =====================================================

/**
 * Sincronizar usuarios desde SAP Costa Rica
 * Solo usuarios con permiso 'usuarios:sync'
 */
router.post('/users/sync',
    checkPermission(RESOURCES.USUARIOS, ACTIONS.SYNC),
    async (req, res) => {
        try {
            const { companyDB, sessionId, username } = req.body;

            // Validar que tenemos la información necesaria
            if (!sessionId || !username) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requiere sessionId y username'
                });
            }

            // Usar sessionId directamente del body
            const crSession = { sessionId };

            if (!crSession || !crSession.sessionId) {
                return res.status(400).json({
                    success: false,
                    error: 'No hay sesión activa para SAP Costa Rica. Inicia sesión primero.'
                });
            }

            logger.info('Iniciando sincronización de usuarios', {
                requestedBy: username,
                companyDB: companyDB || 'SBO_STIACR_PROD'
            });

            const result = await userSyncService.syncUsersFromSAP(
                crSession.sessionId,
                companyDB || 'SBO_STIACR_PROD'
            );

            res.json(result);

        } catch (error) {
            logger.error('Error en sincronización de usuarios:', error);
            res.status(500).json({
                success: false,
                error: 'Error al sincronizar usuarios',
                details: error.message
            });
        }
    }
);

/**
 * Listar todos los usuarios
 */
router.get('/users',
    checkPermission(RESOURCES.USUARIOS, ACTIONS.VIEW),
    async (req, res) => {
        try {
            const { is_active, search } = req.query;

            const filters = {};
            if (is_active !== undefined) {
                filters.is_active = is_active === 'true';
            }
            if (search) {
                filters.search = search;
            }

            const users = await userSyncService.getUsers(filters);

            res.json({
                success: true,
                users
            });

        } catch (error) {
            logger.error('Error obteniendo usuarios:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener usuarios'
            });
        }
    }
);

/**
 * Obtener un usuario específico con sus permisos
 */
router.get('/users/:username',
    checkPermission(RESOURCES.USUARIOS, ACTIONS.VIEW),
    async (req, res) => {
        try {
            const { username } = req.params;

            const user = await userSyncService.getUserWithPermissions(username);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Usuario no encontrado'
                });
            }

            res.json({
                success: true,
                user
            });

        } catch (error) {
            logger.error('Error obteniendo usuario:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener usuario'
            });
        }
    }
);

/**
 * Desactivar un usuario
 */
router.post('/users/:username/deactivate',
    checkPermission(RESOURCES.USUARIOS, ACTIONS.MANAGE),
    async (req, res) => {
        try {
            const { username } = req.params;
            const requestedBy = req.session.sapUsername;

            const user = await userSyncService.deactivateUser(username);

            logger.info('Usuario desactivado', {
                username,
                requestedBy
            });

            res.json({
                success: true,
                user
            });

        } catch (error) {
            logger.error('Error desactivando usuario:', error);
            res.status(500).json({
                success: false,
                error: 'Error al desactivar usuario'
            });
        }
    }
);

/**
 * Activar un usuario
 */
router.post('/users/:username/activate',
    checkPermission(RESOURCES.USUARIOS, ACTIONS.MANAGE),
    async (req, res) => {
        try {
            const { username } = req.params;
            const requestedBy = req.session.sapUsername;

            const user = await userSyncService.activateUser(username);

            logger.info('Usuario activado', {
                username,
                requestedBy
            });

            res.json({
                success: true,
                user
            });

        } catch (error) {
            logger.error('Error activando usuario:', error);
            res.status(500).json({
                success: false,
                error: 'Error al activar usuario'
            });
        }
    }
);

// =====================================================
// GESTIÓN DE ROLES
// =====================================================

/**
 * Listar todos los roles
 */
router.get('/roles',
    checkPermission(RESOURCES.USUARIOS, ACTIONS.VIEW),
    async (req, res) => {
        try {
            const roles = await permissionService.getRoles();

            res.json({
                success: true,
                roles
            });

        } catch (error) {
            logger.error('Error obteniendo roles:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener roles'
            });
        }
    }
);

/**
 * Obtener permisos de un rol específico
 */
router.get('/roles/:roleId/permissions',
    checkPermission(RESOURCES.USUARIOS, ACTIONS.VIEW),
    async (req, res) => {
        try {
            const { roleId } = req.params;

            const permissions = await permissionService.getRolePermissions(roleId);

            res.json({
                success: true,
                permissions
            });

        } catch (error) {
            logger.error('Error obteniendo permisos de rol:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener permisos'
            });
        }
    }
);

/**
 * Crear un nuevo rol
 */
router.post('/roles',
    checkPermission(RESOURCES.USUARIOS, ACTIONS.MANAGE),
    async (req, res) => {
        try {
            const { name, description, permissionIds } = req.body;
            const requestedBy = req.session.sapUsername;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    error: 'El nombre del rol es requerido'
                });
            }

            const role = await permissionService.createRole(name, description);

            if (permissionIds && permissionIds.length > 0) {
                await permissionService.assignPermissionsToRole(role.id, permissionIds);
            }

            logger.info('Rol creado', {
                roleId: role.id,
                name,
                requestedBy
            });

            res.json({
                success: true,
                role
            });

        } catch (error) {
            logger.error('Error creando rol:', error);
            res.status(500).json({
                success: false,
                error: 'Error al crear rol',
                details: error.message
            });
        }
    }
);

/**
 * Asignar permisos a un rol
 */
router.put('/roles/:roleId/permissions',
    checkPermission(RESOURCES.USUARIOS, ACTIONS.MANAGE),
    async (req, res) => {
        try {
            const { roleId } = req.params;
            const { permissionIds } = req.body;
            const requestedBy = req.session.sapUsername;

            await permissionService.assignPermissionsToRole(roleId, permissionIds);

            logger.info('Permisos asignados a rol', {
                roleId,
                permissionCount: permissionIds.length,
                requestedBy
            });

            res.json({
                success: true,
                message: 'Permisos asignados correctamente'
            });

        } catch (error) {
            logger.error('Error asignando permisos a rol:', error);
            res.status(500).json({
                success: false,
                error: 'Error al asignar permisos'
            });
        }
    }
);

// =====================================================
// ASIGNACIÓN DE ROLES A USUARIOS
// =====================================================

/**
 * Asignar rol a un usuario
 */
router.post('/users/:username/roles',
    checkPermission(RESOURCES.USUARIOS, ACTIONS.MANAGE),
    async (req, res) => {
        try {
            const { username } = req.params;
            const { roleId, companyDB } = req.body;
            const grantedBy = req.session.sapUsername;

            if (!roleId) {
                return res.status(400).json({
                    success: false,
                    error: 'El roleId es requerido'
                });
            }

            const assignment = await permissionService.assignRole(
                username,
                roleId,
                companyDB,
                grantedBy
            );

            res.json({
                success: true,
                assignment
            });

        } catch (error) {
            logger.error('Error asignando rol a usuario:', error);
            res.status(500).json({
                success: false,
                error: 'Error al asignar rol',
                details: error.message
            });
        }
    }
);

/**
 * Remover rol de un usuario
 */
router.delete('/users/:username/roles/:roleId',
    checkPermission(RESOURCES.USUARIOS, ACTIONS.MANAGE),
    async (req, res) => {
        try {
            const { username, roleId } = req.params;
            const { companyDB } = req.query;
            const requestedBy = req.session.sapUsername;

            await permissionService.removeRole(username, roleId, companyDB);

            logger.info('Rol removido de usuario', {
                username,
                roleId,
                companyDB,
                requestedBy
            });

            res.json({
                success: true,
                message: 'Rol removido correctamente'
            });

        } catch (error) {
            logger.error('Error removiendo rol de usuario:', error);
            res.status(500).json({
                success: false,
                error: 'Error al remover rol'
            });
        }
    }
);

// =====================================================
// PERMISOS
// =====================================================

/**
 * Listar todos los permisos disponibles
 */
router.get('/permissions',
    checkPermission(RESOURCES.USUARIOS, ACTIONS.VIEW),
    async (req, res) => {
        try {
            const permissions = await permissionService.getAllPermissions();

            res.json({
                success: true,
                permissions
            });

        } catch (error) {
            logger.error('Error obteniendo permisos:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener permisos'
            });
        }
    }
);

// =====================================================
// AUDITORÍA
// =====================================================

/**
 * Obtener logs de auditoría
 */
router.get('/audit-logs',
    checkPermission(RESOURCES.AUDITORIA, ACTIONS.VIEW),
    async (req, res) => {
        try {
            const { username, resource, success, from_date, to_date, limit } = req.query;

            const filters = {};
            if (username) filters.username = username;
            if (resource) filters.resource = resource;
            if (success !== undefined) filters.success = success === 'true';
            if (from_date) filters.from_date = from_date;
            if (to_date) filters.to_date = to_date;
            if (limit) filters.limit = parseInt(limit);

            const logs = await permissionService.getAuditLogs(filters);

            res.json({
                success: true,
                logs
            });

        } catch (error) {
            logger.error('Error obteniendo logs de auditoría:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener logs'
            });
        }
    }
);

// =====================================================
// CONFIGURACIÓN DEL SISTEMA
// =====================================================

const configService = require('../services/configService');

/**
 * Obtener todas las configuraciones del sistema
 */
router.get('/config',
    checkPermission(RESOURCES.CONFIGURACION, ACTIONS.VIEW),
    async (req, res) => {
        try {
            const { category } = req.query;

            let configs;
            if (category) {
                configs = await configService.getByCategory(category);
            } else {
                configs = await configService.getAll(true); // Ocultar valores sensibles
            }

            res.json({
                success: true,
                configs
            });

        } catch (error) {
            logger.error('Error obteniendo configuración del sistema:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener configuración'
            });
        }
    }
);

/**
 * Actualizar una configuración
 */
router.put('/config/:key',
    checkPermission(RESOURCES.CONFIGURACION, ACTIONS.UPDATE),
    async (req, res) => {
        try {
            const { key } = req.params;
            const { value } = req.body;
            const updatedBy = req.session.sapUsername;

            if (!value) {
                return res.status(400).json({
                    success: false,
                    error: 'El valor es requerido'
                });
            }

            const auditInfo = {
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.get('user-agent')
            };

            await configService.set(key, value, updatedBy, auditInfo);

            // Si se actualiza la configuración de SAP, limpiar cache del servicio SAP
            if (key.startsWith('sap_')) {
                const sapService = require('../services/sapService');
                if (sapService.clearCache) {
                    sapService.clearCache();
                }
            }

            logger.info('Configuración actualizada', {
                key,
                updatedBy,
                ip: auditInfo.ip
            });

            res.json({
                success: true,
                message: 'Configuración actualizada correctamente'
            });

        } catch (error) {
            logger.error('Error actualizando configuración:', error);
            res.status(500).json({
                success: false,
                error: 'Error al actualizar configuración',
                details: error.message
            });
        }
    }
);

/**
 * Actualizar múltiples configuraciones
 */
router.put('/config',
    checkPermission(RESOURCES.CONFIGURACION, ACTIONS.UPDATE),
    async (req, res) => {
        try {
            const { configs } = req.body;
            const updatedBy = req.session.sapUsername;

            if (!configs || !Array.isArray(configs)) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requiere un array de configuraciones'
                });
            }

            const auditInfo = {
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.get('user-agent')
            };

            const results = await configService.setMany(configs, updatedBy, auditInfo);

            res.json({
                success: true,
                message: 'Configuraciones actualizadas',
                results
            });

        } catch (error) {
            logger.error('Error actualizando configuraciones:', error);
            res.status(500).json({
                success: false,
                error: 'Error al actualizar configuraciones',
                details: error.message
            });
        }
    }
);

/**
 * Obtener historial de cambios de una configuración
 */
router.get('/config/:key/audit',
    checkPermission(RESOURCES.CONFIGURACION, ACTIONS.VIEW),
    async (req, res) => {
        try {
            const { key } = req.params;
            const limit = parseInt(req.query.limit) || 50;

            const audit = await configService.getAuditLog(key, limit);

            res.json({
                success: true,
                key,
                audit
            });

        } catch (error) {
            logger.error('Error obteniendo historial de configuración:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener historial'
            });
        }
    }
);

// =====================================================
// GESTIÓN DE PÁGINAS Y NAVEGACIÓN
// =====================================================

const db = require('../config/database');

/**
 * Obtener todas las páginas disponibles
 */
router.get('/pages',
    checkPermission(RESOURCES.CONFIGURACION, ACTIONS.VIEW),
    async (req, res) => {
        try {
            const result = await db.query(`
                SELECT id, name, path, icon, description, display_order, is_active
                FROM pages
                ORDER BY display_order, name
            `);

            res.json({
                success: true,
                pages: result.rows
            });

        } catch (error) {
            logger.error('Error obteniendo páginas:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener páginas'
            });
        }
    }
);

/**
 * Actualizar el orden de visualización de las páginas
 */
router.put('/pages/reorder',
    checkPermission(RESOURCES.CONFIGURACION, ACTIONS.UPDATE),
    async (req, res) => {
        try {
            const { pages } = req.body;
            const updatedBy = req.session.sapUsername;

            if (!Array.isArray(pages)) {
                return res.status(400).json({
                    success: false,
                    error: 'pages debe ser un array'
                });
            }

            if (pages.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'El array de páginas no puede estar vacío'
                });
            }

            // Validar que cada página tenga id y display_order
            for (const page of pages) {
                if (!page.id || page.display_order === undefined) {
                    return res.status(400).json({
                        success: false,
                        error: 'Cada página debe tener id y display_order'
                    });
                }
            }

            // Actualizar display_order en una transacción
            await db.transaction(async (client) => {
                for (const page of pages) {
                    await client.query(
                        'UPDATE pages SET display_order = $1 WHERE id = $2',
                        [page.display_order, page.id]
                    );
                }
            });

            logger.info('Orden de páginas actualizado', {
                pageCount: pages.length,
                updatedBy
            });

            res.json({
                success: true,
                message: 'Orden de páginas actualizado correctamente'
            });

        } catch (error) {
            logger.error('Error actualizando orden de páginas:', error);
            res.status(500).json({
                success: false,
                error: 'Error al actualizar orden de páginas',
                details: error.message
            });
        }
    }
);

/**
 * Obtener páginas asignadas a un rol/grupo
 */
router.get('/roles/:roleId/pages',
    checkPermission(RESOURCES.USUARIOS, ACTIONS.VIEW),
    async (req, res) => {
        try {
            const { roleId } = req.params;

            const result = await db.query(`
                SELECT p.id, p.name, p.path, p.icon, p.description, p.display_order
                FROM pages p
                INNER JOIN role_pages rp ON p.id = rp.page_id
                WHERE rp.role_id = $1 AND p.is_active = true
                ORDER BY p.display_order, p.name
            `, [roleId]);

            res.json({
                success: true,
                pages: result.rows
            });

        } catch (error) {
            logger.error('Error obteniendo páginas del rol:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener páginas del rol'
            });
        }
    }
);

/**
 * Asignar páginas a un rol/grupo
 */
router.put('/roles/:roleId/pages',
    checkPermission(RESOURCES.USUARIOS, ACTIONS.MANAGE),
    async (req, res) => {
        try {
            const { roleId } = req.params;
            const { pageIds } = req.body;
            const grantedBy = req.session.sapUsername;

            if (!Array.isArray(pageIds)) {
                return res.status(400).json({
                    success: false,
                    error: 'pageIds debe ser un array'
                });
            }

            await db.transaction(async (client) => {
                // Eliminar asignaciones actuales
                await client.query('DELETE FROM role_pages WHERE role_id = $1', [roleId]);

                // Insertar nuevas asignaciones
                if (pageIds.length > 0) {
                    const values = pageIds.map((pageId, idx) =>
                        `($1, $${idx + 2}, $${pageIds.length + 2})`
                    ).join(',');

                    await client.query(`
                        INSERT INTO role_pages (role_id, page_id, granted_by)
                        VALUES ${values}
                    `, [roleId, ...pageIds, grantedBy]);
                }
            });

            logger.info('Páginas asignadas a rol', {
                roleId,
                pageCount: pageIds.length,
                grantedBy
            });

            res.json({
                success: true,
                message: 'Páginas asignadas correctamente'
            });

        } catch (error) {
            logger.error('Error asignando páginas a rol:', error);
            res.status(500).json({
                success: false,
                error: 'Error al asignar páginas',
                details: error.message
            });
        }
    }
);

/**
 * Obtener páginas permitidas para el usuario autenticado
 * (Para mostrar en el dashboard)
 */
router.get('/menu/my-pages',
    requireAuth,
    async (req, res) => {
        try {
            const username = req.session.sapUsername;

            // Obtener páginas basadas en los roles del usuario
            const result = await db.query(`
                SELECT DISTINCT p.id, p.name, p.path, p.icon, p.description, p.display_order
                FROM pages p
                INNER JOIN role_pages rp ON p.id = rp.page_id
                INNER JOIN user_roles ur ON rp.role_id = ur.role_id
                WHERE ur.username = $1
                  AND p.is_active = true
                ORDER BY p.display_order, p.name
            `, [username]);

            res.json({
                success: true,
                pages: result.rows
            });

        } catch (error) {
            logger.error('Error obteniendo menú del usuario:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener menú'
            });
        }
    }
);

module.exports = router;
