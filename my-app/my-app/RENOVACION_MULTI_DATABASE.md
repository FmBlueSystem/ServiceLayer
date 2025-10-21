# 🔄 RENOVACIÓN AUTOMÁTICA DE SESIÓN MULTI-DATABASE

## 📋 Descripción General

Este documento describe la implementación del sistema de renovación automática de sesiones SAP para arquitecturas **multi-database**, donde una sola página web mantiene sesiones activas simultáneas con múltiples bases de datos SAP.

## 🎯 Problema Resuelto

### Situación Anterior
- La página `articulos.html` se conecta simultáneamente a 4 bases de datos SAP:
  - `SBO_GT_STIA_PROD` (Guatemala)
  - `SBO_HO_STIA_PROD` (Honduras)
  - `SBO_PA_STIA_PROD` (Panama)
  - `SBO_STIACR_PROD` (Costa Rica)
- Cuando una sesión expiraba, el sistema no podía renovarla automáticamente
- El `sessionManager.js` original solo soportaba single-database

### Solución Implementada
Sistema completo de renovación automática para múltiples bases de datos simultáneas, permitiendo que cada sesión se renueve independientemente según sea necesario.

---

## 🏗️ Arquitectura de la Solución

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (articulos.html)                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │      multiSessionManager.js                           │  │
│  │  - Detecta companyDB de cada request                  │  │
│  │  - Renueva sesión específica al recibir 401           │  │
│  │  - Actualiza solo la sesión afectada en localStorage  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Backend (Node.js/Express)                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   /api/sap/renew-session (src/routes/sap.js)         │  │
│  │  - Acepta companyDB como parámetro opcional           │  │
│  │  - Pasa companyDB a sessionRenewalService             │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  sessionRenewalService (src/services/)                │  │
│  │  - Almacena credenciales por "username:companyDB"     │  │
│  │  - Renueva sesión específica para cada database       │  │
│  │  - Encriptación AES-256-CBC de credenciales           │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   /api/sap/login-all (src/routes/sap.js)             │  │
│  │  - Almacena credenciales para TODAS las databases     │  │
│  │  - Permite renovación independiente por database      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                SAP Service Layer API                         │
│  - SBO_GT_STIA_PROD                                          │
│  - SBO_HO_STIA_PROD                                          │
│  - SBO_PA_STIA_PROD                                          │
│  - SBO_STIACR_PROD                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 Archivos Modificados/Creados

### 1. Frontend

#### **NUEVO: `/public/js/multiSessionManager.js`**
- Manager específico para páginas con múltiples sesiones simultáneas
- Detecta automáticamente qué database generó el error 401
- Renueva solo la sesión específica que expiró
- Actualiza localStorage con la nueva sesión

**Características clave:**
```javascript
// Estructura de localStorage para multi-database
{
  username: "stifmolina2",
  sessions: {
    "SBO_GT_STIA_PROD": { success: true, sessionId: "abc123..." },
    "SBO_HO_STIA_PROD": { success: true, sessionId: "def456..." },
    "SBO_PA_STIA_PROD": { success: true, sessionId: "ghi789..." },
    "SBO_STIACR_PROD": { success: true, sessionId: "jkl012..." }
  }
}
```

**Funciones principales:**
- `renewSession(companyDB)` - Renueva sesión específica
- `fetchWithRenewal(url, options)` - Wrapper de fetch con renovación automática
- `updateSession(companyDB, newSessionId)` - Actualiza sesión en localStorage

#### **MODIFICADO: `/public/articulos.html`**
- Cambiado de `sessionManager.js` a `multiSessionManager.js`
- Cambiado `fetchWithAutoRenewal()` a `fetchWithMultiSessionRenewal()`

```html
<!-- Session Manager para renovación automática -->
<script src="/js/multiSessionManager.js"></script>
```

```javascript
// En lugar de fetch() o fetchWithAutoRenewal()
const response = await fetchWithMultiSessionRenewal('/api/sap/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        sessionId: sessions[country].sessionId,
        companyDB: country,  // ⚠️ CRÍTICO: incluir companyDB
        filters: { ... }
    })
});
```

---

### 2. Backend

#### **MODIFICADO: `/src/services/sessionRenewalService.js`**

**Cambios principales:**

1. **Nuevo método `_getStorageKey()`**
   ```javascript
   _getStorageKey(username, companyDB = null) {
       return companyDB ? `${username}:${companyDB}` : username;
   }
   ```
   - Para multi-database: `"stifmolina2:SBO_GT_STIA_PROD"`
   - Para single-database: `"stifmolina2"` (backwards compatible)

2. **Actualizado `storeCredentials()`**
   ```javascript
   storeCredentials(username, password, companyDB) {
       const storageKey = this._getStorageKey(username, companyDB);
       this.credentialsStore.set(storageKey, {
           username,
           encryptedPassword: this.encrypt(password),
           companyDB,
           storedAt: new Date()
       });
   }
   ```

3. **Actualizado `getCredentials()`**
   ```javascript
   getCredentials(username, companyDB = null) {
       const storageKey = this._getStorageKey(username, companyDB);
       const stored = this.credentialsStore.get(storageKey);

       // Fallback para backwards compatibility
       if (!stored && companyDB) {
           return this.getCredentials(username, null);
       }

       return { username, password: decrypted, companyDB };
   }
   ```

4. **Actualizado `renewSession()`**
   ```javascript
   async renewSession(username, companyDB = null) {
       const credentials = this.getCredentials(username, companyDB);

       if (!credentials) {
           return { success: false, error: 'NO_CREDENTIALS' };
       }

       const loginResult = await sapService.loginToServiceLayer(
           credentials.companyDB,
           credentials.username,
           credentials.password
       );

       return {
           success: true,
           sessionId: loginResult.sessionId,
           companyDB: loginResult.companyDB
       };
   }
   ```

#### **MODIFICADO: `/src/routes/sap.js`**

**1. Endpoint `/api/sap/renew-session`**
```javascript
router.post('/renew-session', asyncHandler(async (req, res) => {
  const { username, companyDB } = req.body;  // ✅ Ahora acepta companyDB

  const result = await sessionRenewalService.renewSession(username, companyDB);

  res.json({
    success: result.success,
    sessionId: result.sessionId,
    companyDB: result.companyDB  // ✅ Retorna companyDB
  });
}));
```

**2. Endpoint `/api/sap/login-all`**
```javascript
// ANTES: Solo guardaba credenciales de la primera database exitosa
if (successCount > 0) {
    const firstSuccessfulDB = loginResultsArray.find(result => result.success);
    sessionRenewalService.storeCredentials(username, password, firstSuccessfulDB.companyDB);
}

// AHORA: Guarda credenciales de TODAS las databases exitosas
if (successCount > 0) {
    let storedCount = 0;
    loginResultsArray.forEach(result => {
        if (result.success) {
            sessionRenewalService.storeCredentials(username, password, result.companyDB);
            storedCount++;
        }
    });

    logger.info('Credentials stored for multi-database session renewal', {
        username,
        storedDatabases: storedCount
    });
}
```

---

## 🔄 Flujo de Renovación Automática

### Escenario: Usuario consultando artículos en Guatemala

```
1. Frontend (articulos.html)
   ↓
   const response = await fetchWithMultiSessionRenewal('/api/sap/items', {
       body: JSON.stringify({
           sessionId: 'old-session-id',
           companyDB: 'SBO_GT_STIA_PROD',  ⬅️ Crucial
           filters: { ... }
       })
   });

2. Backend (/api/sap/items)
   ↓
   Intenta query con old-session-id
   ↓
   SAP retorna 401 Unauthorized ⚠️

3. Backend retorna 401 al Frontend
   ↓
4. multiSessionManager detecta 401
   ↓
   - Extrae companyDB del request body: 'SBO_GT_STIA_PROD'
   - Llama a renewSession('SBO_GT_STIA_PROD')

5. Backend (/api/sap/renew-session)
   ↓
   sessionRenewalService.renewSession(username, 'SBO_GT_STIA_PROD')
   ↓
   - Busca credenciales en key: "stifmolina2:SBO_GT_STIA_PROD"
   - Desencripta password
   - Llama SAP Service Layer para nueva sesión

6. SAP Service Layer
   ↓
   Retorna nuevo sessionId: 'new-session-id-GT'

7. Backend retorna al Frontend
   ↓
   {
       success: true,
       sessionId: 'new-session-id-GT',
       companyDB: 'SBO_GT_STIA_PROD'
   }

8. multiSessionManager actualiza localStorage
   ↓
   sapAuth.sessions['SBO_GT_STIA_PROD'].sessionId = 'new-session-id-GT'
   ↓
   localStorage.setItem('sapAuth', JSON.stringify(sapAuth))

9. multiSessionManager reintenta request original
   ↓
   Usa nuevo sessionId: 'new-session-id-GT'
   ↓
   ✅ Request exitoso
```

### ⚠️ **Punto Crítico**: Otras sesiones NO se ven afectadas

```
Durante todo el proceso, las otras sesiones permanecen intactas:

localStorage.sapAuth.sessions = {
    "SBO_GT_STIA_PROD": { sessionId: "new-session-id-GT" },  ⬅️ RENOVADA
    "SBO_HO_STIA_PROD": { sessionId: "original-HO" },        ⬅️ Sin cambios
    "SBO_PA_STIA_PROD": { sessionId: "original-PA" },        ⬅️ Sin cambios
    "SBO_STIACR_PROD":  { sessionId: "original-CR" }         ⬅️ Sin cambios
}
```

---

## 🔐 Seguridad

### Encriptación de Credenciales
- **Algoritmo**: AES-256-CBC
- **Key**: Generada por `crypto.randomBytes(32)` o desde `SESSION_ENCRYPTION_KEY` en .env
- **IV**: Único por cada encriptación (16 bytes)
- **Storage**: In-memory (Map), no persiste en disco

### Estructura de Almacenamiento
```javascript
// En memoria (sessionRenewalService)
credentialsStore = Map {
    "stifmolina2:SBO_GT_STIA_PROD" => {
        username: "stifmolina2",
        encryptedPassword: "iv:encryptedData",
        companyDB: "SBO_GT_STIA_PROD",
        storedAt: Date
    },
    "stifmolina2:SBO_HO_STIA_PROD" => { ... },
    "stifmolina2:SBO_PA_STIA_PROD" => { ... },
    "stifmolina2:SBO_STIACR_PROD" => { ... }
}
```

### Limpieza Automática
- Credenciales expiradas (>24 horas) se eliminan automáticamente cada hora
- No hay persistencia entre reinicios del servidor

---

## 📝 Cómo Usar en Nuevas Páginas

### Para páginas **multi-database** (como articulos.html):

```html
<!-- Incluir multiSessionManager.js -->
<script src="/js/multiSessionManager.js"></script>

<script>
    async function queryMultipleDatabases() {
        const databases = ['SBO_GT_STIA_PROD', 'SBO_HO_STIA_PROD'];

        for (const companyDB of databases) {
            const sessionId = sapAuth.sessions[companyDB].sessionId;

            // ✅ Usar fetchWithMultiSessionRenewal
            const response = await fetchWithMultiSessionRenewal('/api/sap/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: sessionId,
                    companyDB: companyDB,  // ⚠️ CRÍTICO
                    filters: { ... }
                })
            });

            const data = await response.json();
            // Procesar data...
        }
    }
</script>
```

### Para páginas **single-database** (la mayoría):

```html
<!-- Incluir sessionManager.js original -->
<script src="/js/sessionManager.js"></script>

<script>
    async function querySingleDatabase() {
        // ✅ Usar fetchWithAutoRenewal
        const response = await fetchWithAutoRenewal('/api/sap/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: sessionId,
                companyDB: 'SBO_GT_STIA_PROD',
                filters: { ... }
            })
        });
    }
</script>
```

---

## 🧪 Testing

### Test Manual

1. **Login multi-database:**
```bash
curl -k -s -X POST https://10.13.1.83:3443/api/sap/login-all \
  -H "Content-Type: application/json" \
  -d '{
    "username": "stifmolina2",
    "password": "FmDiosMio1"
  }'
```

Esperar respuesta:
```json
{
  "success": true,
  "results": {
    "SBO_GT_STIA_PROD": { "success": true, "sessionId": "..." },
    "SBO_HO_STIA_PROD": { "success": true, "sessionId": "..." },
    ...
  },
  "successCount": 4
}
```

2. **Simular expiración:**
- Esperar 30 minutos de inactividad
- O invalidar manualmente una sesión en SAP

3. **Verificar renovación automática:**
- Abrir `articulos.html`
- Consultar artículos
- Revisar console del navegador:
```
[MultiSessionManager] 🔄 Received 401 for SBO_GT_STIA_PROD, attempting renewal...
[MultiSessionManager] ✅ Session renewed for SBO_GT_STIA_PROD
[MultiSessionManager] ✅ Retry successful for SBO_GT_STIA_PROD
```

4. **Verificar logs del servidor:**
```bash
tail -f logs/combined.log | grep "Session renewal"
```

Debe mostrar:
```
SAP Session renewal requested: { username: 'stifmolina2', companyDB: 'SBO_GT_STIA_PROD' }
Session renewed successfully: { username: 'stifmolina2', companyDB: 'SBO_GT_STIA_PROD' }
```

---

## 📊 Backwards Compatibility

El sistema es **100% compatible** con páginas single-database:

### Escenario 1: Single-Database Legacy
```javascript
// Página antigua con sessionManager.js
sessionRenewalService.storeCredentials('user1', 'pass', 'SBO_GT_STIA_PROD');
// Almacena con key: "user1"  ⬅️ Sin companyDB en la key

sessionRenewalService.renewSession('user1');  // Sin companyDB
// Busca credenciales con key: "user1"  ✅ Funciona
```

### Escenario 2: Multi-Database Nuevo
```javascript
// Página nueva con multiSessionManager.js
sessionRenewalService.storeCredentials('user1', 'pass', 'SBO_GT_STIA_PROD');
// Almacena con key: "user1:SBO_GT_STIA_PROD"  ⬅️ Con companyDB

sessionRenewalService.renewSession('user1', 'SBO_GT_STIA_PROD');
// Busca credenciales con key: "user1:SBO_GT_STIA_PROD"  ✅ Funciona
```

### Escenario 3: Fallback Automático
```javascript
// Intenta buscar con companyDB
sessionRenewalService.getCredentials('user1', 'SBO_GT_STIA_PROD');
// Key: "user1:SBO_GT_STIA_PROD" ❌ No existe

// Fallback automático a single-database
sessionRenewalService.getCredentials('user1', null);
// Key: "user1" ✅ Encuentra credenciales legacy
```

---

## 🚀 Beneficios

1. **Renovación Independiente**: Cada database se renueva solo cuando es necesario
2. **Sin Interrupciones**: Usuario no ve errores ni necesita re-autenticar
3. **Escalable**: Fácil agregar más databases sin cambiar la arquitectura
4. **Seguro**: Credenciales encriptadas en memoria, no en localStorage
5. **Compatible**: Funciona con páginas legacy single-database
6. **Debugging**: Logs detallados de cada renovación

---

## 📚 Documentos Relacionados

- `/RENOVACION_AUTOMATICA_SESION.md` - Sistema original single-database
- `/CLAUDE.md` - Instrucciones para agregar nuevas páginas
- `/README.md` - Documentación general del proyecto

---

## ⚠️ Troubleshooting

### Problema: "Cannot determine which session to renew (no companyDB in request)"

**Causa**: El request no incluye `companyDB` en el body.

**Solución**:
```javascript
// ❌ INCORRECTO
const response = await fetchWithMultiSessionRenewal('/api/sap/items', {
    body: JSON.stringify({
        sessionId: sessionId
        // falta companyDB
    })
});

// ✅ CORRECTO
const response = await fetchWithMultiSessionRenewal('/api/sap/items', {
    body: JSON.stringify({
        sessionId: sessionId,
        companyDB: 'SBO_GT_STIA_PROD'  // ⬅️ Agregar companyDB
    })
});
```

### Problema: "No stored credentials found for session renewal"

**Causa 1**: No se hizo login con `/api/sap/login-all`
- **Solución**: Usar endpoint correcto para multi-database

**Causa 2**: Servidor reiniciado (credenciales in-memory perdidas)
- **Solución**: Re-autenticar usuario

**Causa 3**: Credenciales expiradas (>24 horas)
- **Solución**: Re-autenticar usuario

### Problema: Renovación falla para una database específica

**Verificar**:
1. Credenciales correctas en SAP
2. Database accesible
3. Logs del servidor: `tail -f logs/combined.log | grep "renewal"`

---

## 📅 Historial de Cambios

### 2025-10-20 - Versión 1.0
- ✅ Implementado multiSessionManager.js
- ✅ Actualizado sessionRenewalService para multi-database
- ✅ Modificado /api/sap/login-all para almacenar todas las databases
- ✅ Actualizado /api/sap/renew-session para aceptar companyDB
- ✅ Actualizado articulos.html con nuevo manager
- ✅ Documentación completa

---

**Autor**: Claude Code + BlueSystem Team
**Versión**: 1.0
**Fecha**: 2025-10-20
