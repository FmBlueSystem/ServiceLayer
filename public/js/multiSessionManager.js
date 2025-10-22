// =====================================================
// GESTOR DE MÚLTIPLES SESIONES SAP
// Para páginas que manejan múltiples sesiones simultáneas
// =====================================================

(function() {
    'use strict';

    const MultiSessionManager = {
        config: {
            renewalEndpoint: '/api/sap/renew-session',
            debug: true
        },

        /**
         * Log condicional
         */
        log(...args) {
            if (this.config.debug) {
                console.log('[MultiSessionManager]', ...args);
            }
        },

        /**
         * Obtener datos de autenticación
         */
        getAuthData() {
            try {
                const sapAuth = localStorage.getItem('sapAuth');
                if (!sapAuth) return null;
                return JSON.parse(sapAuth);
            } catch (error) {
                console.error('[MultiSessionManager] Error getting auth data:', error);
                return null;
            }
        },

        /**
         * Actualizar una sesión específica en localStorage
         */
        updateSession(companyDB, newSessionId) {
            try {
                const authData = this.getAuthData();
                if (!authData || !authData.sessions || !authData.sessions[companyDB]) {
                    return false;
                }

                authData.sessions[companyDB].sessionId = newSessionId;
                localStorage.setItem('sapAuth', JSON.stringify(authData));
                this.log(`Session updated for ${companyDB}`);
                return true;
            } catch (error) {
                console.error('[MultiSessionManager] Error updating session:', error);
                return false;
            }
        },

        /**
         * Renovar una sesión específica
         */
        async renewSession(companyDB) {
            const authData = this.getAuthData();
            if (!authData || !authData.username) {
                this.log('No auth data available');
                return { success: false, error: 'NO_AUTH_DATA' };
            }

            this.log(`Renewing session for ${companyDB}...`);

            try {
                const response = await fetch(this.config.renewalEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: authData.username,
                        companyDB: companyDB
                    })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    this.log(`✅ Session renewed for ${companyDB}`);
                    this.updateSession(companyDB, data.sessionId);

                    return {
                        success: true,
                        sessionId: data.sessionId,
                        companyDB: data.companyDB
                    };
                } else {
                    this.log(`❌ Renewal failed for ${companyDB}:`, data.error);
                    return {
                        success: false,
                        error: data.error,
                        message: data.message
                    };
                }
            } catch (error) {
                console.error('[MultiSessionManager] Renewal error:', error);
                return {
                    success: false,
                    error: 'RENEWAL_ERROR',
                    message: error.message
                };
            }
        },

        /**
         * Fetch con renovación automática para contexto multi-database
         * Detecta qué companyDB se está usando y renueva solo esa sesión
         */
        async fetchWithRenewal(url, options = {}) {
            try {
                // Intentar la petición original
                let response = await fetch(url, options);

                // Si recibimos 401, intentar renovar la sesión específica
                if (response.status === 401) {
                    // Extraer companyDB del body de la petición
                    let companyDB = null;
                    let originalBody = null;

                    if (options.body && typeof options.body === 'string') {
                        try {
                            originalBody = JSON.parse(options.body);
                            companyDB = originalBody.companyDB;
                        } catch (e) {
                            this.log('Could not parse request body');
                        }
                    }

                    if (!companyDB) {
                        this.log('❌ Cannot determine which session to renew (no companyDB in request)');
                        return response; // Retornar el 401 original
                    }

                    this.log(`🔄 Received 401 for ${companyDB}, attempting renewal...`);

                    // Intentar renovar la sesión
                    const renewalResult = await this.renewSession(companyDB);

                    if (renewalResult.success) {
                        this.log(`✅ Session renewed, retrying request for ${companyDB}...`);

                        // Actualizar sessionId en el body de la petición
                        if (originalBody) {
                            originalBody.sessionId = renewalResult.sessionId;
                            options.body = JSON.stringify(originalBody);
                        }

                        // Reintentar la petición con la nueva sesión
                        response = await fetch(url, options);

                        if (response.ok) {
                            this.log(`✅ Retry successful for ${companyDB}`);
                        } else {
                            this.log(`⚠️  Retry failed for ${companyDB} with status ${response.status}`);
                        }
                    } else {
                        this.log(`❌ Renewal failed for ${companyDB}`);
                    }
                }

                return response;

            } catch (error) {
                console.error('[MultiSessionManager] Fetch error:', error);
                throw error;
            }
        }
    };

    // Exponer globalmente
    window.MultiSessionManager = MultiSessionManager;

    // Crear un fetch global para multi-sesiones
    window.fetchWithMultiSessionRenewal = MultiSessionManager.fetchWithRenewal.bind(MultiSessionManager);

    console.log('[MultiSessionManager] Module loaded and ready');

})();
