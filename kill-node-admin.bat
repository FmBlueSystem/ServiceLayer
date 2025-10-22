@echo off
echo Deteniendo procesos Node.js...
taskkill /F /IM node.exe /T
timeout /t 2
echo.
echo Procesos Node.js detenidos
echo.
echo Ahora puedes iniciar el servidor con: cd C:\Projects\ServiceLayer y node src/index.js
pause
