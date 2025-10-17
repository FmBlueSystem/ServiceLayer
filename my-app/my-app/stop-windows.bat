@echo off
REM ============================================================================
REM Service Layer Integration - Windows Stop Script
REM Author: BlueSystemIO
REM Date: 2025-10-16
REM ============================================================================

title Service Layer Integration - Stopping...

echo.
echo ========================================================
echo   SERVICE LAYER INTEGRATION - STOP
echo ========================================================
echo.

REM Intentar detener el proceso de forma elegante
echo Buscando procesos de Node.js...
echo.

REM Listar procesos de Node.js
tasklist /FI "IMAGENAME eq node.exe" /FO TABLE 2>nul | find /I "node.exe" >nul

if errorlevel 1 (
    echo No se encontraron procesos de Node.js en ejecucion
    echo.
    pause
    exit /b 0
)

echo Procesos de Node.js encontrados:
tasklist /FI "IMAGENAME eq node.exe" /FO TABLE
echo.

REM Preguntar confirmación
set /p CONFIRM="Deseas detener TODOS los procesos de Node.js? (S/N): "

if /I "%CONFIRM%"=="S" (
    echo.
    echo Deteniendo procesos de Node.js...
    taskkill /F /IM node.exe /T

    if errorlevel 1 (
        echo [ERROR] No se pudo detener los procesos
    ) else (
        echo [OK] Procesos detenidos exitosamente
    )
) else (
    echo Operacion cancelada
)

echo.
echo ========================================================
echo   COMPLETADO
echo ========================================================
echo.
pause
