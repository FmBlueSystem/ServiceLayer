# 🔄 Sistema de Renovación Automática de Sesión SAP

## Descripción

Sistema automático que renueva la sesión de SAP Service Layer cuando expira, evitando que el usuario tenga que hacer login nuevamente. Funciona de manera transparente en el background.

## Problema Resuelto

**Antes:** Cuando el usuario dejaba de usar la app por unas horas, la sesión de SAP expiraba (B1SESSION) y las peticiones fallaban con error 401. El usuario tenía que volver a hacer login manualmente.

**Ahora:** El sistema detecta automáticamente cuando la sesión expiró, la renueva usando las credenciales guardadas de forma segura, y reintenta la petición original. El usuario nunca se entera.

## Componentes Implementados

### 1. Backend - Servicio de Renovación (`sessionRenewalService.js`)

**Ubicación:** `/src/services/sessionRenewalService.js`

**Funcionalidades:**
- Almacena credenciales encriptadas en memoria
- Detecta errores 401 (sesión expirada)
- Reautentica automáticamente con SAP
- Reintenta la petición fallida
- Limpia credenciales expiradas (>24 horas)

**Seguridad:**
- Encriptación AES-256-CBC para credenciales
- Almacenamiento solo en memoria (no disco)
- Cleanup automático de credenciales antiguas

### 2. Backend - Endpoints Actualizados

**Login (`POST /api/sap/login`):**
- Ahora guarda credenciales automáticamente en login exitoso
- Retorna `sessionTimeout` en la respuesta

**Logout (`POST /api/sap/logout`):**
- Ahora elimina credenciales guardadas al cerrar sesión
- Requiere `username` en el body

**Renovar Sesión (`POST /api/sap/renew-session`):**
- Endpoint nuevo para renovación manual
- Body: `{ "username": "nombre_usuario" }`
- Response: `{ "success": true, "sessionId": "...", "companyDB": "..." }`

### 3. Frontend - Session Manager (`sessionManager.js`)

**Ubicación:** `/public/js/sessionManager.js`

**Funcionalidades:**
- Intercepta peticiones fetch
- Detecta errores 401
- Llama al backend para renovar sesión
- Actualiza sessionId en localStorage
- Reintenta petición automáticamente

## Uso en el Frontend

### Opción 1: Usar `fetchWithAutoRenewal()` (Recomendado)

```html
<!-- Incluir el script en tu página -->
<script src="/js/sessionManager.js"></script>

<script>
// Inicializar (opcional, con configuración personalizada)
SessionManager.init({
    debug: true,  // Mostrar logs en consola
    maxRetries: 1,
    retryDelay: 1000
});

// Usar fetchWithAutoRenewal en lugar de fetch
async function cargarArticulos() {
    try {
        const response = await fetchWithAutoRenewal('/api/sap/items', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId: auth.sessionId,
                companyDB: auth.companyDB,
                filters: {}
            })
        });

        const data = await response.json();

        if (data.success) {
            console.log('Artículos:', data.data);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}
</script>
```

### Opción 2: Usar el método de Session Manager directamente

```javascript
async function hacerPeticionSAP() {
    const authData = JSON.parse(localStorage.getItem('sapAuth'));

    const response = await SessionManager.fetchWithRenewal('/api/sap/items', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            sessionId: authData.sessionId,
            companyDB: authData.companyDB
        })
    });

    return await response.json();
}
```

### Opción 3: Escuchar evento de renovación

```javascript
// Escuchar cuando la sesión se renueva
window.addEventListener('sessionRenewed', (event) => {
    console.log('Sesión renovada:', event.detail);
    // event.detail contiene: { sessionId, companyDB, timestamp }

    // Actualizar UI si es necesario
    actualizarInterfaz();
});
```

## Flujo de Funcionamiento

```
1. Usuario hace login
   └─> Backend guarda credenciales encriptadas

2. Usuario usa la app normalmente
   └─> Peticiones SAP funcionan con sessionId actual

3. Usuario está inactivo por horas
   └─> Sesión de SAP expira (B1SESSION)

4. Usuario intenta usar la app
   └─> Petición SAP falla con 401
       └─> SessionManager detecta 401
           └─> Llama a /api/sap/renew-session
               └─> Backend reautentica con SAP
                   └─> Backend retorna nuevo sessionId
                       └─> SessionManager actualiza localStorage
                           └─> SessionManager reintenta petición original
                               └─> ✅ Petición exitosa (transparente para usuario)

5. Usuario hace logout
   └─> Backend elimina credenciales guardadas
```

## Ejemplo Completo en una Página

```html
<!DOCTYPE html>
<html>
<head>
    <title>Artículos SAP</title>
    <!-- Incluir SessionManager -->
    <script src="/js/sessionManager.js"></script>
</head>
<body>
    <h1>Lista de Artículos</h1>
    <button onclick="cargarArticulos()">Cargar Artículos</button>
    <div id="articulos"></div>

    <script>
        // Inicializar con debug activado
        SessionManager.init({ debug: true });

        // Función para cargar artículos
        async function cargarArticulos() {
            const auth = JSON.parse(localStorage.getItem('sapAuth'));

            if (!auth) {
                alert('No estás autenticado');
                window.location.href = '/login.html';
                return;
            }

            try {
                // Usar fetchWithAutoRenewal para renovación automática
                const response = await fetchWithAutoRenewal('/api/sap/items', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        sessionId: auth.sessionId,
                        companyDB: auth.companyDB,
                        filters: {
                            top: 10
                        }
                    })
                });

                const data = await response.json();

                if (data.success) {
                    mostrarArticulos(data.data.value);
                } else {
                    console.error('Error:', data.error);
                }

            } catch (error) {
                console.error('Error cargando artículos:', error);
                alert('Error al cargar artículos');
            }
        }

        function mostrarArticulos(articulos) {
            const container = document.getElementById('articulos');
            container.innerHTML = articulos.map(art =>
                `<div>${art.ItemCode} - ${art.ItemName}</div>`
            ).join('');
        }

        // Escuchar evento de sesión renovada
        window.addEventListener('sessionRenewed', (event) => {
            console.log('✅ Sesión renovada automáticamente!', event.detail);

            // Opcional: Mostrar notificación al usuario
            // showNotification('Sesión renovada automáticamente', 'success');
        });
    </script>
</body>
</html>
```

## Configuración Avanzada

### Personalizar Configuración

```javascript
SessionManager.init({
    renewalEndpoint: '/api/sap/renew-session',  // Endpoint de renovación
    maxRetries: 1,                               // Número de reintentos
    retryDelay: 1000,                           // Delay en ms antes de reintentar
    debug: false                                 // Activar logs de debug
});
```

### Renovación Manual

```javascript
// Renovar sesión manualmente (sin esperar error 401)
async function renovarSesionManual() {
    const result = await SessionManager.renewSession();

    if (result.success) {
        console.log('Sesión renovada:', result.sessionId);
    } else {
        console.error('Error renovando sesión:', result.error);
    }
}
```

## Seguridad

### ¿Dónde se guardan las credenciales?

- **Backend:** En memoria del servidor (encriptadas con AES-256-CBC)
- **Frontend:** Solo sessionId en localStorage (no guarda password)

### ¿Cuánto tiempo se guardan?

- **Backend:** 24 horas desde el último login (cleanup automático)
- **Frontend:** Hasta que el usuario haga logout

### ¿Qué pasa si reinicio el servidor?

- Las credenciales en memoria se pierden
- Usuario tendrá que hacer login nuevamente
- En producción, se recomienda usar Redis para persistencia

## Limitaciones

1. **Credenciales en memoria:** Si reinicia el servidor, se pierden las credenciales guardadas
2. **Sin persistencia:** No se guardan en base de datos por seguridad
3. **Renovación limitada:** Solo 1 reintento por defecto
4. **Requiere login inicial:** El usuario debe hacer login al menos una vez

## Mejoras Futuras

1. **Heartbeat:** Hacer ping periódico para mantener sesión viva
2. **Redis:** Almacenar credenciales en Redis para persistencia entre reinicios
3. **Token Refresh:** Implementar refresh tokens para mayor seguridad
4. **Multi-sesión:** Permitir múltiples sesiones simultáneas por usuario

## Testing

### Probar Renovación Automática

1. Hacer login en la app
2. Esperar a que expire la sesión SAP (30 minutos por defecto)
3. Intentar hacer una operación (ej: cargar artículos)
4. El sistema debe renovar automáticamente y completar la operación

### Simular Sesión Expirada

```javascript
// En la consola del navegador:
const auth = JSON.parse(localStorage.getItem('sapAuth'));
auth.sessionId = 'SESION_INVALIDA_PARA_TESTING';
localStorage.setItem('sapAuth', JSON.stringify(auth));

// Ahora intentar cargar artículos
// Debería renovar automáticamente
```

## Troubleshooting

### La renovación no funciona

- ✅ Verificar que `sessionManager.js` esté incluido
- ✅ Verificar que estés usando `fetchWithAutoRenewal()`
- ✅ Verificar que el usuario hizo login correctamente
- ✅ Verificar logs del servidor para errores de renovación

### Usuario es redirigido a login

- Las credenciales guardadas expiraron (>24 horas)
- El servidor fue reiniciado
- El password del usuario cambió en SAP

### Error "NO_CREDENTIALS"

- El backend no tiene credenciales guardadas para ese usuario
- Usuario debe hacer login nuevamente

## Soporte

Para problemas o preguntas:
1. Revisar logs del servidor (`LOG_LEVEL=debug`)
2. Activar debug en SessionManager: `SessionManager.init({ debug: true })`
3. Revisar consola del navegador

---

**Versión:** 1.0
**Fecha:** Octubre 2025
**Autor:** Sistema de Integración SAP Service Layer
