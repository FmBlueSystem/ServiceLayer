@echo off
REM ============================================================================
REM Service Layer Integration - Windows Startup Script
REM Author: BlueSystemIO
REM Date: 2025-10-16
REM ============================================================================

title Service Layer Integration - Starting...

echo.
echo ========================================================
echo   SERVICE LAYER INTEGRATION - WINDOWS
echo ========================================================
echo.
echo   Configuracion:
echo   - HTTP:  http://localhost:3000 (redirige a HTTPS)
echo   - HTTPS: https://localhost:3443
echo.
echo   Credenciales pre-configuradas:
echo   - Usuario: stifmolina2
echo   - Password: FmDiosMio1
echo.
echo ========================================================
echo.

REM Cambiar al directorio de la aplicación
cd /d %~dp0

REM Verificar que Node.js está instalado
echo [1/5] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado o no esta en el PATH
    echo.
    echo Por favor instala Node.js desde: https://nodejs.org/
    echo Version requerida: 18.0.0 o superior
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION% detectado
echo.

REM Verificar que las dependencias están instaladas
echo [2/5] Verificando dependencias de Node.js...
if not exist "node_modules\" (
    echo [ADVERTENCIA] node_modules no encontrado
    echo Instalando dependencias...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Fallo la instalacion de dependencias
        pause
        exit /b 1
    )
) else (
    echo [OK] Dependencias instaladas
)
echo.

REM Verificar que PostgreSQL está corriendo
echo [3/5] Verificando PostgreSQL...
pg_isready -h localhost -p 5432 >nul 2>&1
if errorlevel 1 (
    echo [ADVERTENCIA] PostgreSQL no esta corriendo o no es accesible en localhost:5432
    echo.
    echo La aplicacion intentara conectarse de todas formas...
) else (
    echo [OK] PostgreSQL esta corriendo
)
echo.

REM Verificar que Redis está corriendo
echo [4/5] Verificando Redis...
redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo [ADVERTENCIA] Redis no esta corriendo o no es accesible en localhost:6379
    echo.
    echo La aplicacion continuara sin cache (fallback a memoria)...
) else (
    echo [OK] Redis esta corriendo
)
echo.

REM Verificar certificados SSL
echo [5/5] Verificando certificados SSL...
if not exist "docker\ssl\cert.pem" (
    echo [ADVERTENCIA] Certificado SSL no encontrado
    echo Generando certificados autofirmados...

    if not exist "docker\ssl\" mkdir docker\ssl

    openssl req -x509 -nodes -days 365 -newkey rsa:2048 ^
        -keyout docker\ssl\key.pem ^
        -out docker\ssl\cert.pem ^
        -subj "/C=GT/ST=Guatemala/L=Guatemala/O=BlueSystemIO/OU=Development/CN=localhost" ^
        -addext "subjectAltName=IP:127.0.0.1,DNS:localhost"

    if errorlevel 1 (
        echo [ERROR] No se pudo generar certificados SSL
        echo Por favor instala OpenSSL para Windows
        pause
        exit /b 1
    )
    echo [OK] Certificados SSL generados
) else (
    echo [OK] Certificados SSL encontrados
)
echo.

REM Verificar archivo .env
if not exist ".env" (
    echo [ADVERTENCIA] Archivo .env no encontrado
    echo Por favor copia .env.example a .env y configuralo
    pause
    exit /b 1
)

REM Iniciar la aplicación
echo ========================================================
echo   INICIANDO SERVIDOR...
echo ========================================================
echo.
echo Presiona Ctrl+C para detener el servidor
echo.

title Service Layer Integration - Running

node src\index.js

REM Si el servidor se detiene, mantener la ventana abierta
echo.
echo ========================================================
echo   SERVIDOR DETENIDO
echo ========================================================
echo.
pause
