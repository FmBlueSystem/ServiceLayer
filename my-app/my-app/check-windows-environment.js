const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ Conectado a Windows Server');
    
    // Verificar Node.js
    conn.exec('node --version', (err, stream) => {
        if (err) {
            console.error('❌ Error:', err.message);
            conn.end();
            return;
        }

        let output = '';
        let error = '';

        stream.on('data', (data) => {
            output += data.toString();
        });

        stream.stderr.on('data', (data) => {
            error += data.toString();
        });

        stream.on('close', (code) => {
            console.log('\n📦 Node.js:');
            if (code === 0 && output) {
                console.log('  ✅ Instalado:', output.trim());
                checkNpm();
            } else {
                console.log('  ❌ No instalado');
                checkDrives();
            }
        });
    });

    function checkNpm() {
        conn.exec('npm --version', (err, stream) => {
            let output = '';
            stream.on('data', (data) => { output += data.toString(); });
            stream.on('close', (code) => {
                console.log('📦 npm:');
                if (code === 0) {
                    console.log('  ✅ Instalado:', output.trim());
                }
                checkPostgres();
            });
        });
    }

    function checkPostgres() {
        conn.exec('psql --version', (err, stream) => {
            let output = '';
            stream.on('data', (data) => { output += data.toString(); });
            stream.on('close', (code) => {
                console.log('🐘 PostgreSQL:');
                if (code === 0) {
                    console.log('  ✅ Instalado:', output.trim());
                } else {
                    console.log('  ❌ No instalado');
                }
                checkDrives();
            });
        });
    }

    function checkDrives() {
        conn.exec('wmic logicaldisk get caption,freespace,size', (err, stream) => {
            let output = '';
            stream.on('data', (data) => { output += data.toString(); });
            stream.on('close', () => {
                console.log('\n💾 Discos disponibles:');
                console.log(output);
                conn.end();
            });
        });
    }
});

conn.on('error', (err) => {
    console.error('❌ Error de conexión:', err.message);
});

conn.connect({
    host: '10.13.0.29',
    port: 22,
    username: 'fmolinam',
    password: 'Fmvidayo28@'
});
