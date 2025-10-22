// =====================================================
// GESTOR DE INACTIVIDAD - AUTO LOGOUT
// Cierra sesión automáticamente después de inactividad
// =====================================================

(function() {
    'use strict';

    const InactivityManager = {
        config: {
            // Tiempo de inactividad antes de logout (5 minutos)
            inactivityTimeout: 5 * 60 * 1000, // 5 minutos en ms

            // Tiempo para mostrar advertencia antes del logout (4 minutos)
            warningTimeout: 4 * 60 * 1000, // 4 minutos en ms

            // URL de redirección al hacer logout
            loginUrl: '/login',

            // Debug mode
            debug: false
        },

        // Timers
        inactivityTimer: null,
        warningTimer: null,

        // Estado
        isWarningShown: false,
        isActive: false,

        /**
         * Log condicional
         */
        log(...args) {
            if (this.config.debug) {
                console.log('[InactivityManager]', ...args);
            }
        },

        /**
         * Inicializar el gestor de inactividad
         */
        init() {
            if (this.isActive) {
                this.log('Already initialized');
                return;
            }

            this.log('Initializing inactivity manager...');
            this.log(`Inactivity timeout: ${this.config.inactivityTimeout / 1000 / 60} minutes`);
            this.log(`Warning timeout: ${this.config.warningTimeout / 1000 / 60} minutes`);

            // Eventos a monitorear
            const events = [
                'mousedown',
                'mousemove',
                'keypress',
                'scroll',
                'touchstart',
                'click'
            ];

            // Agregar listeners para todos los eventos
            events.forEach(event => {
                document.addEventListener(event, () => this.resetTimer(), true);
            });

            // Iniciar timer
            this.resetTimer();
            this.isActive = true;

            this.log('✅ Inactivity manager initialized');
        },

        /**
         * Resetear el timer de inactividad
         */
        resetTimer() {
            // Limpiar timers existentes
            if (this.inactivityTimer) {
                clearTimeout(this.inactivityTimer);
            }
            if (this.warningTimer) {
                clearTimeout(this.warningTimer);
            }

            // Ocultar advertencia si estaba visible
            if (this.isWarningShown) {
                this.hideWarning();
            }

            // Iniciar nuevo timer de advertencia
            this.warningTimer = setTimeout(() => {
                this.showWarning();
            }, this.config.warningTimeout);

            // Iniciar nuevo timer de logout
            this.inactivityTimer = setTimeout(() => {
                this.handleInactivity();
            }, this.config.inactivityTimeout);

            // Log solo cada 30 segundos para evitar spam
            if (!this.lastLogTime || Date.now() - this.lastLogTime > 30000) {
                this.log('⏱️  Inactivity timer reset');
                this.lastLogTime = Date.now();
            }
        },

        /**
         * Mostrar advertencia de inactividad
         */
        showWarning() {
            this.log('⚠️  Showing inactivity warning');
            this.isWarningShown = true;

            // Calcular tiempo restante
            const remainingMinutes = Math.ceil(
                (this.config.inactivityTimeout - this.config.warningTimeout) / 1000 / 60
            );

            // Crear modal de advertencia
            const warningDiv = document.createElement('div');
            warningDiv.id = 'inactivity-warning';
            warningDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px 25px;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 350px;
                animation: slideIn 0.3s ease-out;
            `;

            warningDiv.innerHTML = `
                <div style="display: flex; align-items: start; gap: 15px;">
                    <div style="font-size: 32px;">⏰</div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 16px; margin-bottom: 8px;">
                            Inactividad Detectada
                        </div>
                        <div style="font-size: 14px; opacity: 0.95; line-height: 1.4;">
                            Su sesión se cerrará en <strong>${remainingMinutes} minutos</strong> por inactividad.
                        </div>
                        <button id="stay-logged-in-btn" style="
                            margin-top: 12px;
                            background: white;
                            color: #667eea;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 6px;
                            font-weight: 600;
                            cursor: pointer;
                            font-size: 13px;
                            transition: transform 0.2s;
                        ">
                            Mantener Sesión Activa
                        </button>
                    </div>
                    <button id="close-warning-btn" style="
                        background: transparent;
                        border: none;
                        color: white;
                        font-size: 20px;
                        cursor: pointer;
                        padding: 0;
                        line-height: 1;
                        opacity: 0.7;
                        transition: opacity 0.2s;
                    ">×</button>
                </div>
            `;

            // Agregar animación CSS
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                #stay-logged-in-btn:hover {
                    transform: scale(1.05);
                }
                #close-warning-btn:hover {
                    opacity: 1;
                }
            `;
            document.head.appendChild(style);

            document.body.appendChild(warningDiv);

            // Botón para mantener sesión activa
            document.getElementById('stay-logged-in-btn').addEventListener('click', () => {
                this.log('User clicked "Stay Logged In"');
                this.hideWarning();
                this.resetTimer();
            });

            // Botón para cerrar advertencia
            document.getElementById('close-warning-btn').addEventListener('click', () => {
                this.hideWarning();
            });
        },

        /**
         * Ocultar advertencia de inactividad
         */
        hideWarning() {
            const warningDiv = document.getElementById('inactivity-warning');
            if (warningDiv) {
                warningDiv.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => {
                    warningDiv.remove();
                }, 300);
            }
            this.isWarningShown = false;
            this.log('Warning hidden');
        },

        /**
         * Manejar inactividad - Hacer logout
         */
        handleInactivity() {
            this.log('⏱️  Inactivity timeout reached - Logging out...');

            // Mostrar notificación de logout
            this.showLogoutNotification();

            // Esperar 2 segundos antes de hacer logout
            setTimeout(() => {
                this.performLogout();
            }, 2000);
        },

        /**
         * Mostrar notificación de logout
         */
        showLogoutNotification() {
            const notification = document.createElement('div');
            notification.id = 'logout-notification';
            notification.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
                padding: 30px 40px;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.4);
                z-index: 10001;
                text-align: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                min-width: 300px;
                animation: fadeIn 0.3s ease-out;
            `;

            notification.innerHTML = `
                <div style="font-size: 48px; margin-bottom: 15px;">🔒</div>
                <div style="font-weight: 600; font-size: 20px; margin-bottom: 10px;">
                    Sesión Cerrada
                </div>
                <div style="font-size: 14px; opacity: 0.95;">
                    Su sesión ha sido cerrada por inactividad
                </div>
                <div style="margin-top: 15px; font-size: 12px; opacity: 0.8;">
                    Redirigiendo al login...
                </div>
            `;

            // Overlay oscuro
            const overlay = document.createElement('div');
            overlay.id = 'logout-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
                z-index: 10000;
                animation: fadeIn 0.3s ease-out;
            `;

            document.body.appendChild(overlay);
            document.body.appendChild(notification);

            // Agregar animación
            const style = document.createElement('style');
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideOut {
                    to {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        },

        /**
         * Ejecutar logout y limpiar todo
         */
        performLogout() {
            this.log('🚪 Performing logout...');

            // Limpiar localStorage
            try {
                // Guardar datos que queramos preservar (opcional)
                // const preserveData = localStorage.getItem('somePreservedData');

                // Limpiar todo
                localStorage.clear();
                sessionStorage.clear();

                // Restaurar datos preservados (opcional)
                // if (preserveData) localStorage.setItem('somePreservedData', preserveData);

                this.log('✅ LocalStorage cleared');
            } catch (error) {
                console.error('Error clearing localStorage:', error);
            }

            // Detener timers
            if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
            if (this.warningTimer) clearTimeout(this.warningTimer);

            // Redirigir al login
            this.log(`Redirecting to ${this.config.loginUrl}`);
            window.location.href = this.config.loginUrl;
        },

        /**
         * Detener el gestor de inactividad
         */
        stop() {
            this.log('Stopping inactivity manager...');

            if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
            if (this.warningTimer) clearTimeout(this.warningTimer);

            this.isActive = false;
            this.log('✅ Inactivity manager stopped');
        },

        /**
         * Configurar tiempos personalizados (en minutos)
         */
        configure(options = {}) {
            if (options.inactivityMinutes) {
                this.config.inactivityTimeout = options.inactivityMinutes * 60 * 1000;
            }
            if (options.warningMinutes) {
                this.config.warningTimeout = options.warningMinutes * 60 * 1000;
            }
            if (options.loginUrl) {
                this.config.loginUrl = options.loginUrl;
            }
            if (typeof options.debug !== 'undefined') {
                this.config.debug = options.debug;
            }

            this.log('Configuration updated:', this.config);
        },

        /**
         * Obtener tiempo restante hasta logout (en segundos)
         */
        getRemainingTime() {
            // Este método puede ser usado para mostrar un contador en la UI
            return this.config.inactivityTimeout / 1000;
        }
    };

    // Exponer globalmente
    window.InactivityManager = InactivityManager;

    console.log('[InactivityManager] Module loaded');

    // Auto-inicializar si la página no es el login
    if (!window.location.pathname.includes('login')) {
        // Esperar a que el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                InactivityManager.init();
            });
        } else {
            InactivityManager.init();
        }
    }

})();
