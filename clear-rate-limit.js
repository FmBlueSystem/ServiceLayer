// Script to clear rate limiting for a specific IP
const redis = require('redis');

const client = redis.createClient({
  host: 'localhost',
  port: 6379,
  db: 0,
  socket: {
    connectTimeout: 5000
  }
});

async function clearRateLimit(ip) {
  try {
    await client.connect();
    console.log('✅ Conectado a Redis');

    // Find all rate limit keys for the IP
    const pattern = `myapp:ratelimit:${ip}:*`;
    const keys = await client.keys(pattern);

    if (keys.length === 0) {
      console.log(`ℹ️  No se encontraron claves de rate limit para IP: ${ip}`);
    } else {
      console.log(`🔍 Encontradas ${keys.length} claves para IP ${ip}`);

      // Delete all keys
      for (const key of keys) {
        await client.del(key);
        console.log(`  ✓ Eliminada: ${key}`);
      }

      console.log(`✅ Rate limit reseteado para IP: ${ip}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.disconnect();
    console.log('👋 Desconectado de Redis');
  }
}

// Get IP from command line argument or use default
const targetIP = process.argv[2] || '10.13.1.83';
clearRateLimit(targetIP);
