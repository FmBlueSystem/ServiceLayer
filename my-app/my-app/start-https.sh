#!/bin/bash

# Script para iniciar el servidor con HTTPS habilitado
# Autor: BlueSystemIO
# Fecha: 2025-10-16

echo "🔒 Iniciando servidor con soporte HTTPS..."
echo ""
echo "📋 Configuración:"
echo "   - HTTP:  http://10.13.1.83:3000 (redirige a HTTPS)"
echo "   - HTTPS: https://10.13.1.83:3443"
echo ""
echo "🔑 Credenciales pre-configuradas:"
echo "   - Usuario: stifmolina2"
echo "   - Contraseña: FmDiosMio1"
echo ""

# Cambiar al directorio del proyecto
cd /home/bluesystem/Documents/ServiceLayer/my-app/my-app

# Matar procesos anteriores si existen
echo "🧹 Limpiando procesos anteriores..."
pkill -f "node.*src/index.js" 2>/dev/null

# Esperar un momento para que los puertos se liberen
sleep 2

# Verificar que existan los certificados SSL
if [ ! -f "docker/ssl/cert.pem" ] || [ ! -f "docker/ssl/key.pem" ]; then
    echo "⚠️  Certificados SSL no encontrados. Generando..."
    mkdir -p docker/ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout docker/ssl/key.pem \
        -out docker/ssl/cert.pem \
        -subj "/C=GT/ST=Guatemala/L=Guatemala/O=BlueSystemIO/OU=Development/CN=10.13.1.83" \
        -addext "subjectAltName=IP:10.13.1.83,IP:127.0.0.1,DNS:localhost"
    echo "✅ Certificados SSL generados"
fi

# Iniciar el servidor
echo ""
echo "🚀 Iniciando servidor..."
node src/index.js

# El script termina cuando el servidor se detiene
echo ""
echo "👋 Servidor detenido"
