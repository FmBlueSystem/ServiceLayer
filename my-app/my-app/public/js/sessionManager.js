// =====================================================
// GESTOR DE SESIONES SAP CON RENOVACIÓN AUTOMÁTICA
// =====================================================

(function() {
    'use strict';

    const SessionManager = {
        // Configuración
        config: {
            renewalEndpoint: '/api/sap/renew-session',
            maxRetries: 1,
            retryDelay: 1000,
            debug: false
        },

        // Estado interno
        state: {
            isRenewing: false,
            renewalPromise: null,
            failedRequests: []
        },

        /**
         * Inicializar el gestor de sesiones
         */
        init(options = {}) {
            this.config = { ...this.config, ...options };
            this.log('SessionManager initialized', this.config);
        },

        /**
         * Log condicional
         */
        log(...args) {
            if (this.config.debug) {
                console.log('[SessionManager]', ...args);
            }
        },

        /**
         * Obtener datos de autenticación desde localStorage
         */
        getAuthData() {
            try {
                const authData = localStorage.getItem('sapAuth');
                if (!authData) {
                    return null;
                }
                return JSON.parse(authData);
            } catch (error) {
                console.error('[SessionManager] Error getting auth data:', error);
                return null;
            }
        },

        /**
         * Actualizar sessionId en localStorage
         */
        updateSessionId(newSessionId) {
            try {
                const authData = this.getAuthData();
                if (authData) {
                    authData.sessionId = newSessionId;
                    localStorage.setItem('sapAuth', JSON.stringify(authData));
                    this.log('SessionId updated in localStorage');
                    return true;
                }
                return false;
            } catch (error) {
                console.error('[SessionManager] Error updating sessionId:', error);
                return false;
            }
        },

        /**
         * Renovar sesión llamando al backend
         */
        async renewSession() {
            // Si ya estamos renovando, devolver la promesa existente
            if (this.state.isRenewing && this.state.renewalPromise) {
                this.log('Session renewal already in progress, waiting...');
                return this.state.renewalPromise;
            }

            const authData = this.getAuthData();
            if (!authData || !authData.username) {
                this.log('No auth data available for renewal');
                return {
                    success: false,
                    error: 'NO_AUTH_DATA',
                    message: 'No authentication data available'
                };
            }

            this.log('Starting session renewal for user:', authData.username);

            this.state.isRenewing = true;

            // Crear la promesa de renovación
            this.state.renewalPromise = (async () => {
                try {
                    const response = await fetch(this.config.renewalEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            username: authData.username
                        })
                    });

                    const data = await response.json();

                    if (response.ok && data.success) {
                        this.log('Session renewed successfully');

                        // Actualizar sessionId en localStorage
                        this.updateSessionId(data.sessionId);

                        // Emitir evento personalizado
                        window.dispatchEvent(new CustomEvent('sessionRenewed', {
                            detail: {
                                sessionId: data.sessionId,
                                companyDB: data.companyDB,
                                timestamp: data.timestamp
                            }
                        }));

                        return {
                            success: true,
                            sessionId: data.sessionId,
                            companyDB: data.companyDB
                        };
                    } else {
                        this.log('Session renewal failed:', data.error);

                        // Si falla la renovación, redirigir al login
                        if (data.error === 'NO_CREDENTIALS' || data.error === 'LOGIN_FAILED') {
                            this.handleExpiredCredentials();
                        }

                        return {
                            success: false,
                            error: data.error,
                            message: data.message
                        };
                    }
                } catch (error) {
                    console.error('[SessionManager] Session renewal error:', error);
                    return {
                        success: false,
                        error: 'RENEWAL_ERROR',
                        message: error.message
                    };
                } finally {
                    this.state.isRenewing = false;
                    this.state.renewalPromise = null;
                }
            })();

            return this.state.renewalPromise;
        },

        /**
         * Manejar credenciales expiradas - redirigir al login
         */
        handleExpiredCredentials() {
            this.log('Credentials expired, redirecting to login...');

            // Limpiar localStorage
            localStorage.removeItem('sapAuth');

            // Mostrar mensaje al usuario
            if (typeof showNotification === 'function') {
                showNotification('Tu sesión ha expirado. Por favor inicia sesión nuevamente.', 'warning');
            } else {
                alert('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
            }

            // Redirigir al login después de 2 segundos
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
        },

        /**
         * Interceptor de fetch para detectar 401 y renovar sesión automáticamente
         */
        async fetchWithRenewal(url, options = {}) {
            const authData = this.getAuthData();

            // Si no hay datos de autenticación, hacer request normal
            if (!authData) {
                return fetch(url, options);
            }

            // Agregar sessionId y companyDB a la petición si no están presentes
            if (options.body && typeof options.body === 'string') {
                try {
                    const bodyData = JSON.parse(options.body);
                    if (!bodyData.sessionId && authData.sessionId) {
                        bodyData.sessionId = authData.sessionId;
                    }
                    if (!bodyData.companyDB && authData.companyDB) {
                        bodyData.companyDB = authData.companyDB;
                    }
                    options.body = JSON.stringify(bodyData);
                } catch (e) {
                    // Body no es JSON, ignorar
                }
            }

            try {
                // Hacer la petición original
                let response = await fetch(url, options);

                // Si recibimos 401, intentar renovar sesión
                if (response.status === 401) {
                    this.log('Received 401, attempting session renewal...');

                    // Intentar renovar sesión
                    const renewalResult = await this.renewSession();

                    if (renewalResult.success) {
                        this.log('Session renewed, retrying original request...');

                        // Actualizar sessionId en el body de la petición
                        if (options.body && typeof options.body === 'string') {
                            try {
                                const bodyData = JSON.parse(options.body);
                                bodyData.sessionId = renewalResult.sessionId;
                                if (renewalResult.companyDB) {
                                    bodyData.companyDB = renewalResult.companyDB;
                                }
                                options.body = JSON.stringify(bodyData);
                            } catch (e) {
                                // Body no es JSON, ignorar
                            }
                        }

                        // Reintentar la petición original con la nueva sesión
                        response = await fetch(url, options);

                        this.log('Retry request status:', response.status);
                    } else {
                        this.log('Session renewal failed, cannot retry request');
                    }
                }

                return response;

            } catch (error) {
                console.error('[SessionManager] Fetch with renewal error:', error);
                throw error;
            }
        },

        /**
         * Wrapper para XMLHttpRequest (para compatibilidad)
         */
        createXHRWithRenewal() {
            const originalXHR = window.XMLHttpRequest;
            const sessionManager = this;

            return function XMLHttpRequestWithRenewal() {
                const xhr = new originalXHR();
                const originalSend = xhr.send;

                xhr.send = function(body) {
                    const originalOnLoad = xhr.onload;
                    const originalOnError = xhr.onerror;

                    xhr.onload = async function() {
                        if (xhr.status === 401) {
                            sessionManager.log('XHR received 401, attempting session renewal...');

                            const renewalResult = await sessionManager.renewSession();

                            if (renewalResult.success && body) {
                                try {
                                    const bodyData = JSON.parse(body);
                                    bodyData.sessionId = renewalResult.sessionId;
                                    const newBody = JSON.stringify(bodyData);

                                    // Recrear la petición con la nueva sesión
                                    const newXHR = new originalXHR();
                                    newXHR.open(xhr._method, xhr._url, true);

                                    // Copiar headers
                                    for (const header in xhr._headers) {
                                        newXHR.setRequestHeader(header, xhr._headers[header]);
                                    }

                                    newXHR.onload = originalOnLoad;
                                    newXHR.onerror = originalOnError;
                                    newXHR.send(newBody);

                                    return;
                                } catch (e) {
                                    sessionManager.log('Error parsing XHR body:', e);
                                }
                            }
                        }

                        if (originalOnLoad) {
                            originalOnLoad.apply(this, arguments);
                        }
                    };

                    xhr.onerror = originalOnError;

                    originalSend.call(this, body);
                };

                return xhr;
            };
        }
    };

    // Exponer globalmente
    window.SessionManager = SessionManager;

    // Crear un fetch global que usa el SessionManager automáticamente
    window.fetchWithAutoRenewal = SessionManager.fetchWithRenewal.bind(SessionManager);

    // Agregar listener para el evento de sesión renovada
    window.addEventListener('sessionRenewed', (event) => {
        console.log('[SessionManager] Session renewed:', event.detail);
    });

    // Log de inicialización
    console.log('[SessionManager] Module loaded. Use SessionManager.init() to configure.');

})();
