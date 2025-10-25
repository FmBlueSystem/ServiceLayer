require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'myapp',
    user: process.env.POSTGRES_USER || 'myapp_user',
    password: process.env.POSTGRES_PASSWORD
});

async function hidePages(pageNamesToHide) {
    const client = await pool.connect();

    try {
        console.log('🔍 Buscando páginas a ocultar...\n');

        // Find pages to hide
        const pagesToHide = await client.query(
            `SELECT id, name, path, is_active FROM pages
             WHERE name = ANY($1)
             ORDER BY name`,
            [pageNamesToHide]
        );

        if (pagesToHide.rows.length === 0) {
            console.log('⚠️  No se encontraron páginas para ocultar');
            return;
        }

        console.log('📄 Páginas encontradas:', pagesToHide.rows.length);
        pagesToHide.rows.forEach(page => {
            console.log(`  - ${page.name} (${page.path}) - Activa: ${page.is_active}`);
        });
        console.log('');

        // Begin transaction
        await client.query('BEGIN');

        // Mark pages as inactive
        const pageIds = pagesToHide.rows.map(p => p.id);

        const updateResult = await client.query(
            `UPDATE pages
             SET is_active = false, updated_at = CURRENT_TIMESTAMP
             WHERE id = ANY($1)
             RETURNING id, name`,
            [pageIds]
        );

        console.log('🔒 Páginas desactivadas:', updateResult.rows.length);
        updateResult.rows.forEach(page => {
            console.log(`  ✓ ${page.name}`);
        });
        console.log('');

        // Remove all permissions for these pages
        const deleteResult = await client.query(
            `DELETE FROM role_pages
             WHERE page_id = ANY($1)
             RETURNING page_id, role_id`,
            [pageIds]
        );

        console.log('🗑️  Permisos eliminados:', deleteResult.rows.length);
        console.log('');

        // Commit transaction
        await client.query('COMMIT');

        // Show final state of active pages
        const activePages = await client.query(`
            SELECT p.name, COUNT(rp.role_id) as role_count
            FROM pages p
            LEFT JOIN role_pages rp ON p.id = rp.page_id
            WHERE p.is_active = true
            GROUP BY p.id, p.name
            ORDER BY p.name
        `);

        console.log('✅ Páginas activas restantes:', activePages.rows.length);
        activePages.rows.forEach(page => {
            console.log(`  ✓ ${page.name} (${page.role_count} roles)`);
        });
        console.log('');

        // Show inactive pages
        const inactivePages = await client.query(`
            SELECT name, path FROM pages
            WHERE is_active = false
            ORDER BY name
        `);

        if (inactivePages.rows.length > 0) {
            console.log('🔒 Páginas ocultas/inactivas:', inactivePages.rows.length);
            inactivePages.rows.forEach(page => {
                console.log(`  ✗ ${page.name} (${page.path})`);
            });
        }

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Pages to hide
const pagesToHide = ['Reportes EEFF', 'Test UDOs'];

// Run the script
hidePages(pagesToHide)
    .then(() => {
        console.log('\n✅ Páginas ocultadas exitosamente');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Script falló:', error);
        process.exit(1);
    });
