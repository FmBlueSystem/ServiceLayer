// =====================================================
// SERVICIO DE RENOVACIÓN AUTOMÁTICA DE SESIÓN SAP
// =====================================================

const crypto = require('crypto');
const logger = require('../config/logger');
const sapService = require('./sapService');

// Algoritmo de encriptación
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.SESSION_ENCRYPTION_KEY || crypto.randomBytes(32);
const IV_LENGTH = 16;

class SessionRenewalService {
    constructor() {
        // Almacén de credenciales encriptadas por usuario
        this.credentialsStore = new Map();

        // Configuración de reintento
        this.maxRetries = 1; // Solo reintentar 1 vez
        this.retryDelay = 1000; // 1 segundo de delay
    }

    /**
     * Encriptar datos sensibles
     */
    encrypt(text) {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    }

    /**
     * Desencriptar datos sensibles
     */
    decrypt(text) {
        const parts = text.split(':');
        const iv = Buffer.from(parts.shift(), 'hex');
        const encryptedText = Buffer.from(parts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }

    /**
     * Guardar credenciales de usuario de forma segura
     * @param {string} username - Nombre de usuario
     * @param {string} password - Contraseña
     * @param {string} companyDB - Base de datos de la compañía
     */
    storeCredentials(username, password, companyDB) {
        try {
            const encryptedPassword = this.encrypt(password);

            this.credentialsStore.set(username, {
                username,
                encryptedPassword,
                companyDB,
                storedAt: new Date()
            });

            logger.info('User credentials stored securely for session renewal', {
                username,
                companyDB
            });

            return true;
        } catch (error) {
            logger.error('Error storing credentials', {
                username,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Obtener credenciales guardadas
     * @param {string} username - Nombre de usuario
     * @returns {Object|null} Credenciales desencriptadas
     */
    getCredentials(username) {
        try {
            const stored = this.credentialsStore.get(username);

            if (!stored) {
                return null;
            }

            const password = this.decrypt(stored.encryptedPassword);

            return {
                username: stored.username,
                password,
                companyDB: stored.companyDB
            };
        } catch (error) {
            logger.error('Error retrieving credentials', {
                username,
                error: error.message
            });
            return null;
        }
    }

    /**
     * Eliminar credenciales almacenadas
     * @param {string} username - Nombre de usuario
     */
    removeCredentials(username) {
        this.credentialsStore.delete(username);
        logger.info('User credentials removed', { username });
    }

    /**
     * Renovar sesión SAP automáticamente
     * @param {string} username - Nombre de usuario
     * @returns {Promise<Object>} Nueva sesión o error
     */
    async renewSession(username) {
        try {
            logger.info('Attempting automatic session renewal', { username });

            // Obtener credenciales guardadas
            const credentials = this.getCredentials(username);

            if (!credentials) {
                logger.warn('No stored credentials found for session renewal', { username });
                return {
                    success: false,
                    error: 'NO_CREDENTIALS',
                    message: 'No credentials available for automatic renewal'
                };
            }

            // Intentar login nuevamente con SAP
            const loginResult = await sapService.loginToServiceLayer(
                credentials.companyDB,
                credentials.username,
                credentials.password
            );

            if (loginResult.success) {
                logger.info('Session renewed successfully', {
                    username,
                    companyDB: credentials.companyDB,
                    newSessionId: loginResult.sessionId ? 'present' : 'missing'
                });

                return {
                    success: true,
                    sessionId: loginResult.sessionId,
                    sessionTimeout: loginResult.sessionTimeout,
                    companyDB: loginResult.companyDB,
                    username: loginResult.username
                };
            } else {
                logger.error('Session renewal failed - login unsuccessful', {
                    username,
                    error: loginResult.error
                });

                return {
                    success: false,
                    error: 'LOGIN_FAILED',
                    message: loginResult.error || 'Session renewal failed'
                };
            }

        } catch (error) {
            logger.error('Session renewal error', {
                username,
                error: error.message
            });

            return {
                success: false,
                error: 'RENEWAL_ERROR',
                message: error.message
            };
        }
    }

    /**
     * Ejecutar operación con renovación automática si falla la sesión
     * @param {Function} operation - Función a ejecutar
     * @param {string} username - Usuario para renovar sesión si es necesario
     * @param {number} retryCount - Contador de reintentos
     * @returns {Promise<any>} Resultado de la operación
     */
    async executeWithRenewal(operation, username, retryCount = 0) {
        try {
            // Intentar ejecutar la operación
            const result = await operation();

            return result;

        } catch (error) {
            // Verificar si es un error de sesión expirada (401)
            const is401Error = error.message?.includes('401') ||
                              error.statusCode === 401 ||
                              error.message?.includes('Unauthorized') ||
                              error.message?.includes('session');

            if (is401Error && retryCount < this.maxRetries) {
                logger.warn('Session expired, attempting automatic renewal', {
                    username,
                    retryCount: retryCount + 1,
                    error: error.message
                });

                // Esperar un poco antes de reintentar
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));

                // Intentar renovar la sesión
                const renewalResult = await this.renewSession(username);

                if (renewalResult.success) {
                    logger.info('Session renewed, retrying operation', {
                        username,
                        retryCount: retryCount + 1
                    });

                    // Reintentar la operación con la nueva sesión
                    return await this.executeWithRenewal(operation, username, retryCount + 1);
                } else {
                    // Renovación falló, lanzar error
                    throw new Error(`Session renewal failed: ${renewalResult.message}`);
                }
            } else {
                // No es error de sesión o ya se reintentó, lanzar error original
                throw error;
            }
        }
    }

    /**
     * Limpiar credenciales expiradas (más de 24 horas)
     */
    cleanupExpiredCredentials() {
        const now = new Date();
        const expirationTime = 24 * 60 * 60 * 1000; // 24 horas

        for (const [username, data] of this.credentialsStore.entries()) {
            const age = now - data.storedAt;

            if (age > expirationTime) {
                this.credentialsStore.delete(username);
                logger.info('Expired credentials removed', { username });
            }
        }
    }

    /**
     * Obtener estadísticas del servicio
     */
    getStats() {
        return {
            storedCredentials: this.credentialsStore.size,
            maxRetries: this.maxRetries,
            retryDelay: this.retryDelay
        };
    }
}

// Exportar instancia singleton
const sessionRenewalService = new SessionRenewalService();

// Limpiar credenciales expiradas cada hora
setInterval(() => {
    sessionRenewalService.cleanupExpiredCredentials();
}, 60 * 60 * 1000); // 1 hora

module.exports = sessionRenewalService;
