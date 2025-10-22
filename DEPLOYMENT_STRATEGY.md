# 🚀 Estrategia de Despliegue - ServiceLayer

## 📁 Estructura de Entornos

```
C:\Projects\
├── ServiceLayer\           # 🔴 PRODUCCIÓN (Puerto 3443)
└── ServiceLayer-Staging\   # 🟡 STAGING (Puerto 3444)
```

## 🌳 Estrategia de Branching

```
master/windows (producción) ← Código estable en producción
    ↑
    merge cuando esté probado
    ↑
development (desarrollo) ← Cambios en progreso
    ↑
    feature branches
    ↑
feature/nombre-funcionalidad ← Características específicas
```

## 🔄 Flujo de Trabajo Recomendado

### 1️⃣ Desarrollo Local

```powershell
# Crear rama de feature
cd C:\Projects\ServiceLayer
git checkout development
git pull origin development
git checkout -b feature/nueva-funcionalidad

# Hacer cambios
# ... editar código ...

# Commit
git add .
git commit -m "feat: descripción del cambio"
```

### 2️⃣ Pruebas en Staging

```powershell
# Desplegar a staging
.\scripts\deploy-to-staging.ps1

# Probar funcionalidad en:
# https://10.13.0.29:3444

# Si hay errores, arreglar y repetir
```

### 3️⃣ Merge a Development

```powershell
git checkout development
git merge feature/nueva-funcionalidad
git push origin development

# Probar en staging nuevamente
.\scripts\deploy-to-staging.ps1
```

### 4️⃣ Despliegue a Producción

```powershell
# Cuando staging esté estable
git checkout windows
git merge development
git push origin windows

# Backup automático de producción
.\scripts\deploy-to-production.ps1
```

## 🛡️ Estrategias de Despliegue Seguro

### Opción A: Despliegue con Downtime Mínimo (Actual)
```powershell
# 1. Detener servidor
.\stop-server.ps1

# 2. Actualizar código
git pull origin windows

# 3. Instalar dependencias (si cambiaron)
npm install

# 4. Reiniciar servidor
.\start-server.ps1
```
**Downtime**: ~10-30 segundos

### Opción B: Despliegue Blue-Green (Recomendado)
```
Puerto 3443: Versión AZUL (actual en producción)
Puerto 3445: Versión VERDE (nueva versión)

1. Desplegar nueva versión en puerto 3445
2. Probar que funcione correctamente
3. Cambiar puerto 3443 → 3445
4. Detener versión antigua
```
**Downtime**: 0 segundos

### Opción C: Rolling Update con PM2
```powershell
# Instalar PM2
npm install -g pm2

# Iniciar con PM2
pm2 start src/index.js --name "servicelayer"

# Actualizar sin downtime
git pull origin windows
npm install
pm2 reload servicelayer --update-env
```
**Downtime**: 0 segundos

## 📝 Checklist Pre-Despliegue

Antes de desplegar a producción, verificar:

- [ ] ✅ Código probado en staging
- [ ] ✅ Tests pasando (si existen)
- [ ] ✅ No hay errores en console del navegador
- [ ] ✅ Backup de base de datos realizado
- [ ] ✅ Variables de entorno revisadas
- [ ] ✅ Usuarios notificados (si hay downtime)
- [ ] ✅ Plan de rollback listo

## 🔙 Rollback Rápido

Si algo sale mal en producción:

```powershell
# Opción 1: Git revert
cd C:\Projects\ServiceLayer
git log --oneline -5  # Ver últimos commits
git revert HEAD       # Revertir último commit
.\restart-server.ps1

# Opción 2: Volver a commit anterior
git reset --hard HEAD~1
.\restart-server.ps1

# Opción 3: Volver a una versión específica
git checkout 3b76324  # Hash del commit estable
.\restart-server.ps1
```

## 📊 Monitoreo Post-Despliegue

Después de desplegar, monitorear por 15-30 minutos:

1. **Logs del servidor**
   ```powershell
   Get-Content C:\Projects\ServiceLayer\logs\app.log -Tail 50 -Wait
   ```

2. **Procesos Node.js**
   ```powershell
   Get-Process -Name node | Select-Object Id, CPU, WorkingSet
   ```

3. **Pruebas funcionales**
   - Login ✓
   - Consulta de ofertas ✓
   - Búsqueda de artículos ✓
   - Generación de reportes ✓

4. **Métricas**
   - Tiempo de respuesta
   - Errores HTTP
   - Uso de memoria
   - Conexiones a base de datos

## 🚨 Plan de Contingencia

| Problema | Solución Inmediata | Solución Permanente |
|----------|-------------------|---------------------|
| Servidor no inicia | `git reset --hard HEAD~1` | Revisar logs, corregir código |
| Error 500 en endpoint | Rollback a versión anterior | Debug y fix en staging |
| Base de datos corrupta | Restaurar desde backup | Revisar migraciones |
| Performance lenta | Reiniciar servidor | Optimizar queries |
| Sesiones SAP fallan | Verificar credenciales | Actualizar sessionManager |

## 🔐 Backups Automáticos

```powershell
# Programar backup diario en Task Scheduler
# Nombre: "ServiceLayer Daily Backup"
# Trigger: Diario a las 2:00 AM
# Action: C:\Projects\ServiceLayer\scripts\backup-daily.ps1
```

## 📱 Notificaciones

Configurar alertas para:
- ❌ Servidor caído
- ⚠️ Errores críticos en logs
- 📈 Uso de memoria > 80%
- 🔴 Espacio en disco < 10%

## 📚 Recursos Adicionales

- **Git Flow**: https://nvie.com/posts/a-successful-git-branching-model/
- **PM2 Documentation**: https://pm2.keymetrics.io/docs/usage/quick-start/
- **Node.js Best Practices**: https://github.com/goldbergyoni/nodebestpractices
