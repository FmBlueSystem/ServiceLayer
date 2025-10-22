# Rate Limiting - Guía de Configuración

## 📋 Resumen

Este documento describe la solución definitiva implementada para el rate limiting en el sistema SAP Service Layer.

## ✅ Solución Implementada

### Características Principales

1. **Whitelist de IPs Internas**: IPs específicas completamente exentas del rate limiting
2. **Redes Confiables (CIDR)**: Rangos de red completos exentos del rate limiting
3. **Límites Aumentados**: Límites significativamente más altos para operaciones normales
4. **Configuración Flexible**: Todo configurable mediante variables de entorno

### Configuración Actual

**Archivo: `.env`**

```env
# Rate Limiting Configuration
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000                    # 15 minutos
RATE_LIMIT_MAX_REQUESTS=10000                  # 10,000 peticiones por ventana
API_RATE_LIMIT_MAX=50000                       # 50,000 peticiones para APIs
# Whitelist de IPs internas (separadas por comas)
RATE_LIMIT_WHITELIST=10.13.0.29,10.13.1.83,127.0.0.1,::1,localhost
# Rangos de red permitidos (formato CIDR)
RATE_LIMIT_TRUSTED_NETWORKS=10.13.0.0/16,192.168.0.0/16,172.16.0.0/12
```

### Límites por Tipo de Endpoint

| Endpoint Type | Límite | Ventana | Notas |
|--------------|--------|---------|-------|
| General | 10,000 | 15 min | Para la mayoría de peticiones |
| API Endpoints | 50,000 | 15 min | Para endpoints /api/* |
| Autenticación | 100 | 15 min | Para /api/sap/login-* |
| Uploads | 10 | 1 hora | Para subida de archivos |
| Password Reset | 3 | 1 hora | Para reseteo de contraseña |

### IPs/Redes Confiables

Las siguientes IPs y redes están **completamente exentas** del rate limiting:

**IPs Específicas:**
- 10.13.0.29 (Servidor)
- 10.13.1.83 (Cliente interno)
- 127.0.0.1 / ::1 (Localhost)

**Rangos de Red (CIDR):**
- 10.13.0.0/16 (Red interna principal)
- 192.168.0.0/16 (Redes privadas clase C)
- 172.16.0.0/12 (Redes privadas clase B)

## 🔧 Cómo Modificar la Configuración

### Agregar una IP a la Whitelist

Edita el archivo `.env`:

```env
RATE_LIMIT_WHITELIST=10.13.0.29,10.13.1.83,127.0.0.1,::1,localhost,NUEVA_IP_AQUI
```

### Agregar un Rango de Red

Edita el archivo `.env`:

```env
RATE_LIMIT_TRUSTED_NETWORKS=10.13.0.0/16,192.168.0.0/16,172.16.0.0/12,NUEVO_RANGO_AQUI
```

### Aumentar Límites Globales

Edita el archivo `.env`:

```env
RATE_LIMIT_MAX_REQUESTS=20000    # Duplicar el límite
API_RATE_LIMIT_MAX=100000        # Duplicar el límite de API
```

### Desactivar Rate Limiting Completamente

```env
RATE_LIMIT_ENABLED=false
```

**⚠️ Advertencia:** Solo desactivar en desarrollo. NO desactivar en producción.

## 🔄 Aplicar Cambios

Después de modificar el archivo `.env`:

```powershell
# Opción 1: Usar el script de reinicio
cd C:\Projects\ServiceLayer
.\restart-server.ps1

# Opción 2: Manual
Get-Process -Name node | Stop-Process -Force
npm start
```

## 🛠️ Solución de Problemas

### Error: "Rate limit exceeded"

**Causa**: La IP no está en la whitelist o los límites son muy bajos.

**Solución**:
1. Agregar la IP a `RATE_LIMIT_WHITELIST` en `.env`
2. O agregar el rango de red a `RATE_LIMIT_TRUSTED_NETWORKS`
3. Reiniciar el servidor

### Verificar Configuración Actual

```powershell
# Ver los logs del servidor
Get-Content C:\Projects\ServiceLayer\logs\combined.log | Select-String "Rate limiting configuration"
```

Busca una línea similar a:
```json
{
  "message": "Rate limiting configuration loaded",
  "enabled": true,
  "windowMs": 900000,
  "maxRequests": 10000,
  "apiMaxRequests": 50000,
  "whitelistedIPs": 5,
  "trustedNetworks": 3
}
```

### Limpiar Cache de Rate Limiting

Si necesitas resetear los contadores manualmente:

```powershell
# Reiniciar Redis (limpia todos los contadores)
Restart-Service Redis
```

O si Redis no es un servicio:
```powershell
Get-Process redis-server | Stop-Process -Force
Start-Process "C:\Program Files\Redis\redis-server.exe" -WindowStyle Hidden
```

## 📊 Monitoreo

### Ver Rate Limits en Tiempo Real

Los logs muestran cuando se excede un límite:

```json
{
  "level": "warn",
  "message": "Rate limit exceeded",
  "ip": "10.13.1.83",
  "endpoint": "/api/sap/login-all",
  "limit": 500,
  "windowMs": 900000
}
```

### Headers HTTP

Las respuestas incluyen información de rate limiting:

```
RateLimit-Limit: 10000
RateLimit-Remaining: 9990
RateLimit-Reset: 1634567890
```

## 🔐 Seguridad

**Mejores Prácticas:**

1. ✅ Mantener rate limiting activado en producción
2. ✅ Solo agregar IPs/redes internas confiables a la whitelist
3. ✅ Revisar logs regularmente para detectar abusos
4. ✅ Ajustar límites según el uso real del sistema
5. ❌ NO desactivar rate limiting en producción
6. ❌ NO agregar IPs externas a la whitelist

## 📝 Historial de Cambios

### 2025-10-21 - Solución Definitiva
- ✅ Implementada whitelist de IPs
- ✅ Implementado soporte para rangos CIDR
- ✅ Aumentados límites: 500 → 10,000 (general), 1,000 → 50,000 (API)
- ✅ Agregado bypass para redes internas (10.13.0.0/16)
- ✅ Mejorado logging de configuración

## 🆘 Soporte

Si continúan los problemas después de aplicar esta configuración:

1. Verificar que el archivo `.env` fue modificado correctamente
2. Verificar que el servidor se reinició después de los cambios
3. Revisar los logs en `C:\Projects\ServiceLayer\logs\`
4. Contactar al equipo de desarrollo

---

**Última actualización:** 21 de octubre de 2025
**Versión:** 1.0.0
**Autor:** BlueSystemIO
