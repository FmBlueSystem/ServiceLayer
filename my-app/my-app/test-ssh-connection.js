// Script de prueba de conexión SSH a Windows
const { Client } = require('ssh2');

const config = {
    host: '10.13.0.29',
    port: 22,
    username: 'fmolinam',
    password: 'Fmvidayo28@',
    readyTimeout: 10000
};

console.log('🔄 Intentando conectar a Windows Server...');
console.log(`   Host: ${config.host}`);
console.log(`   Usuario: ${config.username}`);
console.log('');

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ ¡CONEXIÓN SSH EXITOSA!');
    console.log('');

    // Ejecutar comando de prueba
    conn.exec('hostname && systeminfo | findstr /B /C:"OS Name" /C:"OS Version"', (err, stream) => {
        if (err) {
            console.error('❌ Error ejecutando comando:', err.message);
            conn.end();
            return;
        }

        let output = '';

        stream.on('data', (data) => {
            output += data.toString('utf8');
        });

        stream.on('close', (code) => {
            console.log('📋 Información del servidor Windows:');
            console.log('-----------------------------------');
            console.log(output);
            console.log('-----------------------------------');
            console.log(`Exit code: ${code}`);
            console.log('');
            console.log('✅ Prueba completada exitosamente');
            conn.end();
            process.exit(0);
        });
    });
});

conn.on('error', (err) => {
    console.error('❌ Error de conexión SSH:', err.message);
    if (err.level === 'client-authentication') {
        console.error('   Problema de autenticación. Verifica usuario/contraseña.');
    } else if (err.code === 'ECONNREFUSED') {
        console.error('   Conexión rechazada. Verifica que el servicio SSH esté corriendo.');
    } else if (err.code === 'ETIMEDOUT') {
        console.error('   Timeout. Verifica conectividad de red y firewall.');
    }
    process.exit(1);
});

conn.on('timeout', () => {
    console.error('❌ Timeout de conexión SSH');
    process.exit(1);
});

// Intentar conexión
conn.connect(config);
