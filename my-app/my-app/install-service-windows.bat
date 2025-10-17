@echo off
REM ============================================================================
REM Service Layer Integration - Install as Windows Service
REM Author: BlueSystemIO
REM Date: 2025-10-16
REM
REM PREREQUISITOS:
REM   1. Descargar NSSM desde: https://nssm.cc/download
REM   2. Extraer nssm.exe a C:\Windows\System32\ o agregarlo al PATH
REM   3. Ejecutar este script como ADMINISTRADOR
REM ============================================================================

title Service Layer Integration - Service Installation

REM Verificar privilegios de administrador
net session >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Este script requiere privilegios de ADMINISTRADOR
    echo Por favor ejecuta como Administrador
    pause
    exit /b 1
)

echo.
echo ========================================================
echo   INSTALACION DE SERVICIO DE WINDOWS
echo ========================================================
echo.

REM Verificar que NSSM está instalado
echo [1/6] Verificando NSSM...
nssm version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] NSSM no esta instalado o no esta en el PATH
    echo.
    echo Por favor descarga NSSM desde: https://nssm.cc/download
    echo Y copia nssm.exe a C:\Windows\System32\
    pause
    exit /b 1
)
echo [OK] NSSM encontrado
echo.

REM Configuración
set SERVICE_NAME=ServiceLayerApp
set APP_DIR=%~dp0
set NODE_EXE=C:\Program Files\nodejs\node.exe
set APP_FILE=%APP_DIR%src\index.js

REM Verificar que Node.js está instalado
echo [2/6] Verificando Node.js...
if not exist "%NODE_EXE%" (
    echo [ERROR] Node.js no encontrado en: %NODE_EXE%
    echo Por favor instala Node.js o ajusta la ruta NODE_EXE en este script
    pause
    exit /b 1
)
echo [OK] Node.js encontrado
echo.

REM Verificar que la aplicación existe
echo [3/6] Verificando aplicacion...
if not exist "%APP_FILE%" (
    echo [ERROR] Archivo de aplicacion no encontrado: %APP_FILE%
    pause
    exit /b 1
)
echo [OK] Aplicacion encontrada
echo.

REM Detener y eliminar servicio existente (si existe)
echo [4/6] Verificando servicio existente...
sc query "%SERVICE_NAME%" >nul 2>&1
if not errorlevel 1 (
    echo Servicio existente encontrado. Deteniendo...
    nssm stop "%SERVICE_NAME%"
    timeout /t 3 /nobreak >nul

    echo Eliminando servicio existente...
    nssm remove "%SERVICE_NAME%" confirm
    timeout /t 2 /nobreak >nul
)
echo [OK] Listo para instalar
echo.

REM Instalar el servicio
echo [5/6] Instalando servicio...
nssm install "%SERVICE_NAME%" "%NODE_EXE%" "%APP_FILE%"

REM Configurar el servicio
echo [6/6] Configurando servicio...

REM Configuración básica
nssm set "%SERVICE_NAME%" AppDirectory "%APP_DIR%"
nssm set "%SERVICE_NAME%" DisplayName "Service Layer Integration"
nssm set "%SERVICE_NAME%" Description "SAP Service Layer Integration Application - BlueSystemIO"

REM Configuración de inicio
nssm set "%SERVICE_NAME%" Start SERVICE_AUTO_START

REM Configuración de reinicio automático
nssm set "%SERVICE_NAME%" AppThrottle 1500
nssm set "%SERVICE_NAME%" AppExit Default Restart
nssm set "%SERVICE_NAME%" AppRestartDelay 5000

REM Configuración de variables de entorno
nssm set "%SERVICE_NAME%" AppEnvironmentExtra NODE_ENV=production

REM Configuración de logs
if not exist "%APP_DIR%logs\" mkdir "%APP_DIR%logs"
nssm set "%SERVICE_NAME%" AppStdout "%APP_DIR%logs\service-stdout.log"
nssm set "%SERVICE_NAME%" AppStderr "%APP_DIR%logs\service-stderr.log"

REM Rotación de logs
nssm set "%SERVICE_NAME%" AppStdoutCreationDisposition 4
nssm set "%SERVICE_NAME%" AppStderrCreationDisposition 4
nssm set "%SERVICE_NAME%" AppRotateFiles 1
nssm set "%SERVICE_NAME%" AppRotateOnline 1
nssm set "%SERVICE_NAME%" AppRotateSeconds 86400
nssm set "%SERVICE_NAME%" AppRotateBytes 10485760

echo.
echo ========================================================
echo   INSTALACION COMPLETADA
echo ========================================================
echo.
echo Servicio: %SERVICE_NAME%
echo Estado:   Instalado (no iniciado)
echo.
echo Comandos disponibles:
echo   Iniciar:   nssm start %SERVICE_NAME%
echo   Detener:   nssm stop %SERVICE_NAME%
echo   Reiniciar: nssm restart %SERVICE_NAME%
echo   Estado:    nssm status %SERVICE_NAME%
echo   Editar:    nssm edit %SERVICE_NAME%
echo   Eliminar:  nssm remove %SERVICE_NAME%
echo.
echo Logs disponibles en:
echo   %APP_DIR%logs\
echo.

REM Preguntar si desea iniciar el servicio ahora
set /p START_NOW="Deseas iniciar el servicio ahora? (S/N): "

if /I "%START_NOW%"=="S" (
    echo.
    echo Iniciando servicio...
    nssm start "%SERVICE_NAME%"
    timeout /t 3 /nobreak >nul

    echo.
    echo Estado del servicio:
    nssm status "%SERVICE_NAME%"

    echo.
    echo Verifica que la aplicacion este funcionando en:
    echo   https://localhost:3443/health
)

echo.
pause
