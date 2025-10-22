# Simple server start script
Write-Host "Iniciando servidor..." -ForegroundColor Green
Set-Location -Path "C:\Projects\ServiceLayer"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\Projects\ServiceLayer; node src/index.js" -WindowStyle Normal
Write-Host "Servidor iniciado en nueva ventana" -ForegroundColor Green
