# Exportación de Base de Datos

**Generado:** 2025-10-25T10:48:45.338Z

## Archivos

### schema.sql
Estructura completa de la base de datos (tablas, índices, constraints, etc.)

### config-data.sql
Datos de configuración del sistema:
- Roles del sistema
- Permisos
- Asignación de permisos a roles
- Páginas del sistema
- Asignación de páginas a roles
- Configuración del sistema
- Usuarios (sin contraseñas)
- Asignación de roles a usuarios

## Cómo restaurar en un nuevo ambiente

### 1. Crear base de datos
```bash
createdb -h localhost -U postgres myapp
```

### 2. Aplicar estructura
```bash
psql -h localhost -U myapp_user -d myapp -f schema.sql
```

### 3. Importar datos de configuración
```bash
psql -h localhost -U myapp_user -d myapp -f config-data.sql
```

### 4. Verificar
```bash
# Verificar roles
psql -h localhost -U myapp_user -d myapp -c "SELECT * FROM roles;"

# Verificar páginas
psql -h localhost -U myapp_user -d myapp -c "SELECT * FROM pages;"

# Verificar usuarios
psql -h localhost -U myapp_user -d myapp -c "SELECT username, full_name, is_active FROM sap_users;"
```

## Notas importantes

⚠️ **Este export NO incluye:**
- Contraseñas de usuarios
- Logs de auditoría
- Sesiones activas
- Datos sensibles de producción

✅ **Este export SÍ incluye:**
- Toda la estructura de base de datos
- Roles y permisos del sistema
- Configuración de páginas
- Lista de usuarios (sin contraseñas)
- Asignaciones de roles a usuarios

## Regenerar exports

Para regenerar estos archivos:

```bash
node scripts/export-database-config.js
```
