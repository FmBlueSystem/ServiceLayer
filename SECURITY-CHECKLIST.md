# 🔒 CHECKLIST DE SEGURIDAD URGENTE

**Fecha:** ${new Date().toISOString()}

## ⚠️ CONTRASEÑAS EXPUESTAS EN REPOSITORIO PÚBLICO

El archivo `public/windows.env` estuvo expuesto en el repositorio público con las siguientes credenciales:

- ❌ Contraseña de PostgreSQL: `FmDiosMio1`
- ❌ Contraseña SSH Windows: `Fmvidayo28@`
- ❌ JWT Secret: `generated-jwt-secret-key-change-this`
- ❌ Endpoint SAP: `https://sap-stiacmzdr-sl.skyinone.net:50000/`

---

## 🚨 ACCIONES INMEDIATAS REQUERIDAS

### 1. Hacer el repositorio PRIVADO (5 minutos)

**Pasos:**
1. Ir a: https://github.com/FmBlueSystem/ServiceLayer/settings
2. Scroll hasta "Danger Zone" (al final)
3. Click en "Change visibility"
4. Seleccionar "Make private"
5. Confirmar escribiendo: `FmBlueSystem/ServiceLayer`

### 2. Cambiar TODAS las contraseñas expuestas

#### A. Cambiar contraseña de PostgreSQL

```bash
# Conectar a PostgreSQL
sudo -u postgres psql

# Cambiar contraseña del usuario
ALTER USER myapp_user WITH PASSWORD 'NUEVA_CONTRASEÑA_SEGURA';

# Salir
\q

# Actualizar .env con la nueva contraseña
nano .env
# Cambiar: DB_PASSWORD=NUEVA_CONTRASEÑA_SEGURA
```

#### B. Cambiar contraseña SSH del servidor Windows

```powershell
# En el servidor Windows 10.13.0.29
# Abrir PowerShell como Administrador
net user USUARIO NUEVA_CONTRASEÑA

# Actualizar .env con la nueva contraseña
# WINDOWS_SSH_PASSWORD=NUEVA_CONTRASEÑA
```

#### C. Regenerar JWT Secret

```bash
# Generar nuevo JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Actualizar .env con el nuevo secret
nano .env
# Cambiar: JWT_SECRET=<nuevo_secret_generado>
```

### 3. Actualizar archivo .env

Editar `/mnt/c/Projects/ServiceLayer/.env` con las NUEVAS credenciales:

```bash
nano .env
```

**IMPORTANTE:** Nunca subir este archivo a Git (ya está protegido por .gitignore)

### 4. Reiniciar servicios

```bash
# Detener servidor actual
killall node

# Reiniciar con nuevas credenciales
npm start
```

---

## ✅ VERIFICACIÓN DE SEGURIDAD

Después de completar los pasos anteriores, verificar:

- [ ] Repositorio es PRIVADO en GitHub
- [ ] Contraseña de PostgreSQL cambiada
- [ ] Contraseña SSH Windows cambiada
- [ ] JWT_SECRET regenerado
- [ ] Archivo .env actualizado con nuevas credenciales
- [ ] Servicios reiniciados correctamente
- [ ] Aplicación funciona con nuevas credenciales

---

## 🛡️ MEDIDAS PREVENTIVAS IMPLEMENTADAS

### Archivos protegidos por .gitignore:

```
.env
.env.test
.env.production
.env.local
*.env (excepto .env.example)
*.key
*.pem
*.crt
*.pfx
*.p12
**/credentials*.json
**/secrets*.json
backups/
database/backups/
Capture*.PNG
```

### Archivos permitidos en Git:

- `.env.example` - Plantilla sin valores reales
- `database/exports/` - Configuración sin contraseñas
- Código fuente
- Documentación

---

## 📞 CONTACTO DE EMERGENCIA

Si sospechas de acceso no autorizado:

1. Cambiar TODAS las contraseñas inmediatamente
2. Revisar logs de acceso: `cat logs/app.log`
3. Revisar conexiones a base de datos
4. Revisar audit_log en PostgreSQL

---

## 🔐 MEJORES PRÁCTICAS

1. **NUNCA** commitear archivos con contraseñas
2. **SIEMPRE** usar variables de entorno
3. **VERIFICAR** .gitignore antes de cada commit
4. **ROTAR** contraseñas regularmente (cada 90 días)
5. Usar contraseñas fuertes (mínimo 16 caracteres, alfanuméricos + símbolos)
6. Habilitar autenticación de dos factores en GitHub
7. Limitar acceso al repositorio solo a usuarios necesarios

---

**Estado actual:**
- ✅ Archivo sensible eliminado del repositorio
- ✅ .gitignore actualizado
- ⏳ Pendiente: Hacer repositorio privado
- ⏳ Pendiente: Cambiar contraseñas

**Última actualización:** ${new Date().toISOString()}
