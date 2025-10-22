// =====================================================
// SERVICIO DE CONFIGURACIÓN DINÁMICA DEL SISTEMA
// =====================================================

const database = require('../config/database');
const logger = require('../config/logger');

class ConfigService {
    constructor() {
        this.cache = new Map(); // Cache en memoria para configuraciones
        this.cacheTimeout = 60000; // 1 minuto
        this.lastCacheUpdate = null;
    }

    /**
     * Obtener un valor de configuración
     * @param {string} key - Clave de configuración
     * @param {*} defaultValue - Valor por defecto si no existe
     * @returns {Promise<string>}
     */
    async get(key, defaultValue = null) {
        try {
            // Intentar obtener desde cache
            if (this.cache.has(key) && this.isCacheValid()) {
                return this.cache.get(key);
            }

            // Obtener desde base de datos
            const result = await database.query(
                'SELECT value FROM system_config WHERE key = $1',
                [key]
            );

            if (result.rows.length > 0) {
                const value = result.rows[0].value;
                this.cache.set(key, value);
                return value;
            }

            // Retornar valor por defecto si no existe
            return defaultValue;

        } catch (error) {
            logger.warn('Error al obtener configuración desde DB, usando valor por defecto', {
                key,
                error: error.message
            });
            return defaultValue;
        }
    }

    /**
     * Obtener múltiples configuraciones por categoría
     * @param {string} category - Categoría de configuración
     * @returns {Promise<Array>}
     */
    async getByCategory(category) {
        try {
            const result = await database.query(
                `SELECT key, value, description, category, is_sensitive, updated_at
                 FROM system_config
                 WHERE category = $1
                 ORDER BY key`,
                [category]
            );

            return result.rows.map(row => ({
                key: row.key,
                value: row.is_sensitive ? '********' : row.value, // Ocultar valores sensibles
                description: row.description,
                category: row.category,
                isSensitive: row.is_sensitive,
                updatedAt: row.updated_at
            }));

        } catch (error) {
            logger.error('Error al obtener configuraciones por categoría', {
                category,
                error: error.message
            });
            return [];
        }
    }

    /**
     * Obtener todas las configuraciones
     * @param {boolean} hideSensitive - Ocultar valores sensibles
     * @returns {Promise<Array>}
     */
    async getAll(hideSensitive = true) {
        try {
            const result = await database.query(
                `SELECT key, value, description, category, is_sensitive, updated_by, updated_at
                 FROM system_config
                 ORDER BY category, key`
            );

            return result.rows.map(row => ({
                key: row.key,
                value: (hideSensitive && row.is_sensitive) ? '********' : row.value,
                description: row.description,
                category: row.category,
                isSensitive: row.is_sensitive,
                updatedBy: row.updated_by,
                updatedAt: row.updated_at
            }));

        } catch (error) {
            logger.error('Error al obtener todas las configuraciones', {
                error: error.message
            });
            return [];
        }
    }

    /**
     * Establecer un valor de configuración
     * @param {string} key - Clave de configuración
     * @param {string} value - Nuevo valor
     * @param {string} updatedBy - Usuario que realiza el cambio
     * @param {object} auditInfo - Información adicional de auditoría (IP, user agent)
     * @returns {Promise<boolean>}
     */
    async set(key, value, updatedBy, auditInfo = {}) {
        try {
            const result = await database.transaction(async (client) => {
                // Obtener valor anterior para auditoría
                const oldValueResult = await client.query(
                    'SELECT value FROM system_config WHERE key = $1',
                    [key]
                );
                const oldValue = oldValueResult.rows.length > 0 ? oldValueResult.rows[0].value : null;

                // Actualizar o insertar configuración
                await client.query(
                    `INSERT INTO system_config (key, value, updated_by)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (key)
                     DO UPDATE SET value = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP`,
                    [key, value, updatedBy]
                );

                // Registrar en log de auditoría
                await client.query(
                    `INSERT INTO config_audit_log (config_key, old_value, new_value, changed_by, ip_address, user_agent)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [key, oldValue, value, updatedBy, auditInfo.ip || null, auditInfo.userAgent || null]
                );

                return oldValue;
            });

            // Invalidar cache
            this.cache.delete(key);
            this.lastCacheUpdate = Date.now();

            logger.info('Configuración actualizada', {
                key,
                updatedBy,
                oldValue: result?.substring(0, 50), // Log parcial para no exponer valores completos
                newValue: value?.substring(0, 50)
            });

            return true;

        } catch (error) {
            logger.error('Error al establecer configuración', {
                key,
                updatedBy,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Actualizar múltiples configuraciones
     * @param {Array} configs - Array de {key, value}
     * @param {string} updatedBy - Usuario que realiza los cambios
     * @param {object} auditInfo - Información de auditoría
     * @returns {Promise<object>}
     */
    async setMany(configs, updatedBy, auditInfo = {}) {
        const results = {
            success: [],
            failed: []
        };

        for (const config of configs) {
            try {
                await this.set(config.key, config.value, updatedBy, auditInfo);
                results.success.push(config.key);
            } catch (error) {
                results.failed.push({
                    key: config.key,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Obtener historial de cambios de una configuración
     * @param {string} key - Clave de configuración
     * @param {number} limit - Límite de resultados
     * @returns {Promise<Array>}
     */
    async getAuditLog(key, limit = 50) {
        try {
            const result = await database.query(
                `SELECT config_key, old_value, new_value, changed_by, ip_address, created_at
                 FROM config_audit_log
                 WHERE config_key = $1
                 ORDER BY created_at DESC
                 LIMIT $2`,
                [key, limit]
            );

            return result.rows.map(row => ({
                key: row.config_key,
                oldValue: row.old_value?.substring(0, 100),
                newValue: row.new_value?.substring(0, 100),
                changedBy: row.changed_by,
                ipAddress: row.ip_address,
                createdAt: row.created_at
            }));

        } catch (error) {
            logger.error('Error al obtener log de auditoría de configuración', {
                key,
                error: error.message
            });
            return [];
        }
    }

    /**
     * Verificar si el cache es válido
     * @returns {boolean}
     */
    isCacheValid() {
        if (!this.lastCacheUpdate) return false;
        return (Date.now() - this.lastCacheUpdate) < this.cacheTimeout;
    }

    /**
     * Limpiar cache
     */
    clearCache() {
        this.cache.clear();
        this.lastCacheUpdate = null;
        logger.info('Cache de configuración limpiado');
    }

    /**
     * Recargar toda la configuración en cache
     */
    async preloadCache() {
        try {
            const result = await database.query('SELECT key, value FROM system_config');

            this.cache.clear();
            result.rows.forEach(row => {
                this.cache.set(row.key, row.value);
            });

            this.lastCacheUpdate = Date.now();

            logger.info('Cache de configuración precargado', {
                itemsLoaded: result.rows.length
            });

        } catch (error) {
            logger.error('Error al precargar cache de configuración', {
                error: error.message
            });
        }
    }
}

// Exportar instancia singleton
const configService = new ConfigService();
module.exports = configService;
