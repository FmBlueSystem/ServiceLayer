require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'myapp',
    user: process.env.POSTGRES_USER || 'myapp_user',
    password: process.env.POSTGRES_PASSWORD
});

async function exportDatabaseConfig() {
    const client = await pool.connect();

    try {
        console.log('📦 Exportando configuración de base de datos...\n');
        console.log('═'.repeat(70));

        const exportDir = path.join(__dirname, '../database/exports');

        // Crear directorio si no existe
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
            console.log(`✓ Directorio creado: ${exportDir}\n`);
        }

        // 1. Exportar ESTRUCTURA de todas las tablas (schema)
        console.log('1️⃣  Exportando estructura de base de datos...');

        // Obtener el schema SQL desde la base de datos directamente
        const tablesResult = await client.query(`
            SELECT
                schemaname,
                tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);

        let schemaSQL = `-- =============================================
-- SCHEMA DE BASE DE DATOS
-- Generado: ${new Date().toISOString()}
-- =============================================

`;

        console.log(`   Encontradas ${tablesResult.rows.length} tablas`);

        for (const table of tablesResult.rows) {
            // Obtener el DDL de cada tabla
            const ddlResult = await client.query(`
                SELECT
                    'CREATE TABLE ' || table_name || ' (' ||
                    array_to_string(
                        array_agg(
                            column_name || ' ' ||
                            data_type ||
                            CASE
                                WHEN character_maximum_length IS NOT NULL
                                THEN '(' || character_maximum_length || ')'
                                ELSE ''
                            END ||
                            CASE
                                WHEN is_nullable = 'NO' THEN ' NOT NULL'
                                ELSE ''
                            END
                        ),
                        ', '
                    ) ||
                    ');' as create_statement
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = $1
                GROUP BY table_name
            `, [table.tablename]);

            if (ddlResult.rows.length > 0) {
                schemaSQL += `\n-- Tabla: ${table.tablename}\n`;
                schemaSQL += ddlResult.rows[0].create_statement + '\n';
            }
        }

        const schemaFile = path.join(exportDir, 'schema.sql');
        fs.writeFileSync(schemaFile, schemaSQL);
        console.log(`   ✓ Schema exportado: ${schemaFile}`);

        // 2. Exportar DATOS de tablas de configuración
        console.log('\n2️⃣  Exportando datos de configuración...');

        const configTables = [
            { name: 'roles', description: 'Roles del sistema', orderBy: 'id' },
            { name: 'permissions', description: 'Permisos del sistema', orderBy: 'id' },
            { name: 'role_permissions', description: 'Asignación de permisos a roles', orderBy: 'role_id, permission_id' },
            { name: 'pages', description: 'Páginas del sistema', orderBy: 'id' },
            { name: 'role_pages', description: 'Asignación de páginas a roles', orderBy: 'role_id, page_id' },
            { name: 'system_config', description: 'Configuración del sistema', orderBy: 'key' }
        ];

        let dataSQL = `-- =============================================
-- DATOS DE CONFIGURACIÓN DEL SISTEMA
-- Generado: ${new Date().toISOString()}
-- =============================================

-- Deshabilitar triggers y constraints temporalmente
SET session_replication_role = 'replica';

-- Limpiar tablas de configuración (en orden correcto)
TRUNCATE TABLE role_pages CASCADE;
TRUNCATE TABLE role_permissions CASCADE;
TRUNCATE TABLE permissions CASCADE;
TRUNCATE TABLE pages CASCADE;
TRUNCATE TABLE roles CASCADE;
TRUNCATE TABLE system_config CASCADE;

`;

        for (const table of configTables) {
            const result = await client.query(`SELECT * FROM ${table.name} ORDER BY ${table.orderBy}`);

            if (result.rows.length > 0) {
                console.log(`   ✓ ${table.name}: ${result.rows.length} registro(s) - ${table.description}`);

                dataSQL += `\n-- ${table.description}\n`;
                dataSQL += `-- Tabla: ${table.name}\n`;

                for (const row of result.rows) {
                    const columns = Object.keys(row);
                    const values = columns.map(col => {
                        const val = row[col];
                        if (val === null) return 'NULL';
                        if (typeof val === 'boolean') return val ? 'true' : 'false';
                        if (typeof val === 'number') return val;
                        if (val instanceof Date) return `'${val.toISOString()}'`;
                        // Escapar comillas simples
                        return `'${String(val).replace(/'/g, "''")}'`;
                    });

                    dataSQL += `INSERT INTO ${table.name} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
                }
            } else {
                console.log(`   ⚠️  ${table.name}: 0 registros - ${table.description}`);
            }
        }

        // 3. Exportar USUARIOS (sin contraseñas sensibles)
        console.log('\n3️⃣  Exportando usuarios del sistema...');
        const usersResult = await client.query(`
            SELECT username, full_name, email, is_active, sap_company_db, last_sync_at, created_at
            FROM sap_users
            ORDER BY username
        `);

        if (usersResult.rows.length > 0) {
            console.log(`   ✓ sap_users: ${usersResult.rows.length} usuario(s)`);

            dataSQL += `\n-- Usuarios del sistema (sin contraseñas)\n`;
            dataSQL += `-- Tabla: sap_users\n`;

            for (const user of usersResult.rows) {
                const columns = Object.keys(user);
                const values = columns.map(col => {
                    const val = user[col];
                    if (val === null) return 'NULL';
                    if (typeof val === 'boolean') return val ? 'true' : 'false';
                    if (val instanceof Date) return `'${val.toISOString()}'`;
                    return `'${String(val).replace(/'/g, "''")}'`;
                });

                dataSQL += `INSERT INTO sap_users (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT (username) DO NOTHING;\n`;
            }
        }

        // 4. Exportar asignación de ROLES a USUARIOS
        console.log('\n4️⃣  Exportando asignación de roles a usuarios...');
        const userRolesResult = await client.query(`
            SELECT username, role_id, company_db, granted_by, granted_at
            FROM user_roles
            ORDER BY username, role_id
        `);

        if (userRolesResult.rows.length > 0) {
            console.log(`   ✓ user_roles: ${userRolesResult.rows.length} asignación(es)`);

            dataSQL += `\n-- Asignación de roles a usuarios\n`;
            dataSQL += `-- Tabla: user_roles\n`;

            for (const userRole of userRolesResult.rows) {
                const columns = Object.keys(userRole);
                const values = columns.map(col => {
                    const val = userRole[col];
                    if (val === null) return 'NULL';
                    if (val instanceof Date) return `'${val.toISOString()}'`;
                    return `'${String(val).replace(/'/g, "''")}'`;
                });

                dataSQL += `INSERT INTO user_roles (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT (username, role_id, company_db) DO NOTHING;\n`;
            }
        }

        dataSQL += `\n-- Rehabilitar triggers y constraints
SET session_replication_role = 'origin';

-- Actualizar secuencias
SELECT setval('roles_id_seq', COALESCE((SELECT MAX(id) FROM roles), 1));
SELECT setval('permissions_id_seq', COALESCE((SELECT MAX(id) FROM permissions), 1));
SELECT setval('pages_id_seq', COALESCE((SELECT MAX(id) FROM pages), 1));
`;

        const dataFile = path.join(exportDir, 'config-data.sql');
        fs.writeFileSync(dataFile, dataSQL);
        console.log(`   ✓ Datos exportados: ${dataFile}`);

        // 5. Crear README
        console.log('\n5️⃣  Creando documentación...');
        const readme = `# Exportación de Base de Datos

**Generado:** ${new Date().toISOString()}

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
\`\`\`bash
createdb -h localhost -U postgres myapp
\`\`\`

### 2. Aplicar estructura
\`\`\`bash
psql -h localhost -U myapp_user -d myapp -f schema.sql
\`\`\`

### 3. Importar datos de configuración
\`\`\`bash
psql -h localhost -U myapp_user -d myapp -f config-data.sql
\`\`\`

### 4. Verificar
\`\`\`bash
# Verificar roles
psql -h localhost -U myapp_user -d myapp -c "SELECT * FROM roles;"

# Verificar páginas
psql -h localhost -U myapp_user -d myapp -c "SELECT * FROM pages;"

# Verificar usuarios
psql -h localhost -U myapp_user -d myapp -c "SELECT username, full_name, is_active FROM sap_users;"
\`\`\`

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

\`\`\`bash
node scripts/export-database-config.js
\`\`\`
`;

        const readmeFile = path.join(exportDir, 'README.md');
        fs.writeFileSync(readmeFile, readme);
        console.log(`   ✓ README creado: ${readmeFile}`);

        console.log('\n' + '═'.repeat(70));
        console.log('📊 RESUMEN');
        console.log('═'.repeat(70));
        console.log(`✓ Estructura exportada: schema.sql`);
        console.log(`✓ Datos de configuración: config-data.sql`);
        console.log(`✓ Total de usuarios exportados: ${usersResult.rows.length}`);
        console.log(`✓ Total de roles a usuarios: ${userRolesResult.rows.length}`);
        console.log(`✓ Directorio: ${exportDir}`);
        console.log('\n💡 Ahora puedes hacer commit de estos archivos a Git:');
        console.log('   git add database/exports/');
        console.log('   git commit -m "Agregar configuración de base de datos"');
        console.log('   git push');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

exportDatabaseConfig()
    .then(() => {
        console.log('\n✅ Exportación completada\n');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Script falló:', error.message);
        process.exit(1);
    });
