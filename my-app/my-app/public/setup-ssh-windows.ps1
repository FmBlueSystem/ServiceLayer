# =====================================================
# SCRIPT DE CONFIGURACIÓN SSH PARA WINDOWS SERVER
# Ejecutar como Administrador
# =====================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURACIÓN SSH - WINDOWS SERVER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que se está ejecutando como Administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ ERROR: Este script debe ejecutarse como Administrador" -ForegroundColor Red
    Write-Host "   Haz clic derecho en PowerShell y selecciona 'Ejecutar como Administrador'" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Ejecutando como Administrador" -ForegroundColor Green
Write-Host ""

# =====================================================
# PASO 1: Información del Sistema
# =====================================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PASO 1: Información del Sistema" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$osInfo = Get-WmiObject Win32_OperatingSystem
$computerInfo = Get-WmiObject Win32_ComputerSystem

Write-Host "Sistema Operativo: $($osInfo.Caption)" -ForegroundColor White
Write-Host "Versión: $($osInfo.Version)" -ForegroundColor White
Write-Host "Arquitectura: $($osInfo.OSArchitecture)" -ForegroundColor White
Write-Host "Nombre del Equipo: $($computerInfo.Name)" -ForegroundColor White
Write-Host ""

# Obtener dirección IP
Write-Host "Direcciones IP:" -ForegroundColor Yellow
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"} | ForEach-Object {
    Write-Host "  - $($_.IPAddress) ($($_.InterfaceAlias))" -ForegroundColor White
}
Write-Host ""

# =====================================================
# PASO 2: Verificar/Instalar OpenSSH Server
# =====================================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PASO 2: Instalación de OpenSSH Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Verificar si OpenSSH Server ya está instalado
$sshServerFeature = Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH.Server*'

if ($sshServerFeature.State -eq "Installed") {
    Write-Host "✓ OpenSSH Server ya está instalado" -ForegroundColor Green
} else {
    Write-Host "⚙ Instalando OpenSSH Server..." -ForegroundColor Yellow
    try {
        Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
        Write-Host "✓ OpenSSH Server instalado correctamente" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error al instalar OpenSSH Server: $_" -ForegroundColor Red
        Write-Host "   Intentando método alternativo..." -ForegroundColor Yellow

        # Método alternativo vía Settings
        Write-Host "   Abre Configuración > Aplicaciones > Características opcionales" -ForegroundColor Yellow
        Write-Host "   Busca 'OpenSSH Server' y haz clic en Instalar" -ForegroundColor Yellow
        exit 1
    }
}
Write-Host ""

# =====================================================
# PASO 3: Configurar y Iniciar Servicio SSH
# =====================================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PASO 3: Configuración del Servicio SSH" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Iniciar servicio
Write-Host "⚙ Iniciando servicio sshd..." -ForegroundColor Yellow
try {
    Start-Service sshd
    Write-Host "✓ Servicio sshd iniciado" -ForegroundColor Green
} catch {
    Write-Host "⚠ No se pudo iniciar el servicio: $_" -ForegroundColor Yellow
}

# Configurar inicio automático
Write-Host "⚙ Configurando inicio automático..." -ForegroundColor Yellow
Set-Service -Name sshd -StartupType 'Automatic'
Write-Host "✓ Servicio configurado para inicio automático" -ForegroundColor Green
Write-Host ""

# Verificar estado del servicio
$sshdService = Get-Service sshd
Write-Host "Estado del servicio sshd:" -ForegroundColor Yellow
Write-Host "  - Estado: $($sshdService.Status)" -ForegroundColor $(if ($sshdService.Status -eq 'Running') { 'Green' } else { 'Red' })
Write-Host "  - Inicio: $($sshdService.StartType)" -ForegroundColor White
Write-Host ""

# =====================================================
# PASO 4: Configurar Firewall
# =====================================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PASO 4: Configuración del Firewall" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Verificar si la regla ya existe
$existingRule = Get-NetFirewallRule -Name "sshd" -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "✓ Regla de firewall para SSH ya existe" -ForegroundColor Green
} else {
    Write-Host "⚙ Creando regla de firewall para SSH..." -ForegroundColor Yellow
    try {
        New-NetFirewallRule -Name sshd -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22
        Write-Host "✓ Regla de firewall creada correctamente" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error al crear regla de firewall: $_" -ForegroundColor Red
    }
}

# Crear regla específica para la subred Linux
Write-Host "⚙ Creando regla de firewall para subred Linux (10.13.1.0/24)..." -ForegroundColor Yellow
$linuxSubnetRule = Get-NetFirewallRule -DisplayName "SSH from Linux" -ErrorAction SilentlyContinue

if ($linuxSubnetRule) {
    Write-Host "✓ Regla para subred Linux ya existe" -ForegroundColor Green
} else {
    try {
        New-NetFirewallRule -DisplayName "SSH from Linux" `
            -Direction Inbound `
            -LocalPort 22 `
            -Protocol TCP `
            -Action Allow `
            -RemoteAddress 10.13.1.0/24
        Write-Host "✓ Regla para subred Linux creada correctamente" -ForegroundColor Green
    } catch {
        Write-Host "⚠ No se pudo crear regla específica: $_" -ForegroundColor Yellow
    }
}
Write-Host ""

# Verificar reglas de firewall
Write-Host "Reglas de firewall para SSH:" -ForegroundColor Yellow
Get-NetFirewallRule | Where-Object {$_.LocalPort -eq 22 -or $_.DisplayName -like "*SSH*"} | ForEach-Object {
    Write-Host "  - $($_.DisplayName): $($_.Enabled)" -ForegroundColor White
}
Write-Host ""

# =====================================================
# PASO 5: Verificar Usuario
# =====================================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PASO 5: Verificación de Usuario SSH" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$username = "fmolinam"

# Verificar si el usuario existe
try {
    $user = Get-LocalUser -Name $username -ErrorAction Stop
    Write-Host "✓ Usuario '$username' existe" -ForegroundColor Green
    Write-Host "  - Nombre completo: $($user.FullName)" -ForegroundColor White
    Write-Host "  - Habilitado: $($user.Enabled)" -ForegroundColor White
    Write-Host "  - Último inicio de sesión: $($user.LastLogon)" -ForegroundColor White
} catch {
    Write-Host "⚠ Usuario '$username' NO existe" -ForegroundColor Yellow
    Write-Host "   ¿Deseas crear el usuario ahora? (S/N)" -ForegroundColor Yellow
    $createUser = Read-Host

    if ($createUser -eq "S" -or $createUser -eq "s") {
        $password = Read-Host "Ingresa la contraseña para el usuario" -AsSecureString
        try {
            New-LocalUser -Name $username -Password $password -Description "Usuario SSH" -PasswordNeverExpires
            Write-Host "✓ Usuario '$username' creado correctamente" -ForegroundColor Green

            # Agregar a grupo de Administradores si es necesario
            Write-Host "   ¿Agregar a grupo Administradores? (S/N)" -ForegroundColor Yellow
            $addAdmin = Read-Host

            if ($addAdmin -eq "S" -or $addAdmin -eq "s") {
                Add-LocalGroupMember -Group "Administrators" -Member $username
                Write-Host "✓ Usuario agregado a Administradores" -ForegroundColor Green
            }
        } catch {
            Write-Host "❌ Error al crear usuario: $_" -ForegroundColor Red
        }
    }
}
Write-Host ""

# =====================================================
# PASO 6: Verificar Puerto SSH
# =====================================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PASO 6: Verificación de Puerto SSH" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$sshPort = netstat -an | Select-String ":22 "

if ($sshPort) {
    Write-Host "✓ Puerto 22 está escuchando:" -ForegroundColor Green
    $sshPort | ForEach-Object {
        Write-Host "  $_" -ForegroundColor White
    }
} else {
    Write-Host "⚠ Puerto 22 NO está escuchando" -ForegroundColor Yellow
    Write-Host "  El servicio SSH puede no estar funcionando correctamente" -ForegroundColor Yellow
}
Write-Host ""

# =====================================================
# PASO 7: Probar Conexión Local
# =====================================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PASO 7: Prueba de Conexión SSH Local" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "⚙ Probando conexión SSH local..." -ForegroundColor Yellow
Write-Host "  (Se te pedirá la contraseña de $username)" -ForegroundColor Yellow
Write-Host ""

# Intentar conexión SSH local
$testCommand = "ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 $username@localhost 'echo OK'"
Write-Host "Ejecutando: $testCommand" -ForegroundColor Gray

try {
    $result = Invoke-Expression $testCommand 2>&1
    if ($result -like "*OK*") {
        Write-Host "✓ Conexión SSH local exitosa" -ForegroundColor Green
    } else {
        Write-Host "⚠ Resultado de la prueba: $result" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ No se pudo probar la conexión local: $_" -ForegroundColor Yellow
}
Write-Host ""

# =====================================================
# PASO 8: Verificar Conectividad a Linux
# =====================================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PASO 8: Verificar Conectividad a Linux" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$linuxIP = "10.13.1.83"

Write-Host "⚙ Haciendo ping a máquina Linux ($linuxIP)..." -ForegroundColor Yellow
$pingResult = Test-Connection -ComputerName $linuxIP -Count 3 -ErrorAction SilentlyContinue

if ($pingResult) {
    Write-Host "✓ Conectividad con Linux exitosa" -ForegroundColor Green
    Write-Host "  - Paquetes enviados: 3" -ForegroundColor White
    Write-Host "  - Paquetes recibidos: $($pingResult.Count)" -ForegroundColor White
    $avgTime = ($pingResult | Measure-Object -Property ResponseTime -Average).Average
    Write-Host "  - Tiempo promedio: $([math]::Round($avgTime, 2)) ms" -ForegroundColor White
} else {
    Write-Host "❌ NO hay conectividad con Linux ($linuxIP)" -ForegroundColor Red
    Write-Host "   Verifica el routing entre subredes 10.13.0.x y 10.13.1.x" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Tabla de rutas actual:" -ForegroundColor Yellow
    route print | Select-String "10.13"
}
Write-Host ""

# =====================================================
# PASO 9: Configuración SSH (Opcional)
# =====================================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PASO 9: Configuración SSH" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$sshdConfigPath = "C:\ProgramData\ssh\sshd_config"

if (Test-Path $sshdConfigPath) {
    Write-Host "✓ Archivo de configuración encontrado: $sshdConfigPath" -ForegroundColor Green

    # Mostrar configuraciones importantes
    Write-Host ""
    Write-Host "Configuraciones actuales:" -ForegroundColor Yellow
    Get-Content $sshdConfigPath | Select-String "Port|PasswordAuthentication|PubkeyAuthentication|PermitRootLogin" | ForEach-Object {
        if ($_ -notlike "#*") {
            Write-Host "  $_" -ForegroundColor White
        }
    }
} else {
    Write-Host "⚠ Archivo de configuración no encontrado" -ForegroundColor Yellow
}
Write-Host ""

# =====================================================
# RESUMEN FINAL
# =====================================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESUMEN DE CONFIGURACIÓN" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Estado general
$allGood = $true

# 1. Servicio SSH
$sshdStatus = (Get-Service sshd).Status
Write-Host "1. Servicio SSH:" -ForegroundColor White
if ($sshdStatus -eq 'Running') {
    Write-Host "   ✓ CORRIENDO" -ForegroundColor Green
} else {
    Write-Host "   ❌ NO CORRIENDO ($sshdStatus)" -ForegroundColor Red
    $allGood = $false
}

# 2. Firewall
$firewallRules = Get-NetFirewallRule | Where-Object {$_.LocalPort -eq 22 -and $_.Enabled -eq $true}
Write-Host "2. Reglas de Firewall:" -ForegroundColor White
if ($firewallRules) {
    Write-Host "   ✓ CONFIGURADAS ($($firewallRules.Count) regla(s))" -ForegroundColor Green
} else {
    Write-Host "   ❌ NO CONFIGURADAS" -ForegroundColor Red
    $allGood = $false
}

# 3. Puerto
$portListening = netstat -an | Select-String ":22 "
Write-Host "3. Puerto 22:" -ForegroundColor White
if ($portListening) {
    Write-Host "   ✓ ESCUCHANDO" -ForegroundColor Green
} else {
    Write-Host "   ❌ NO ESCUCHANDO" -ForegroundColor Red
    $allGood = $false
}

# 4. Usuario
Write-Host "4. Usuario SSH:" -ForegroundColor White
$userExists = Get-LocalUser -Name $username -ErrorAction SilentlyContinue
if ($userExists) {
    Write-Host "   ✓ EXISTE ($username)" -ForegroundColor Green
} else {
    Write-Host "   ❌ NO EXISTE ($username)" -ForegroundColor Red
    $allGood = $false
}

# 5. Conectividad a Linux
Write-Host "5. Conectividad a Linux:" -ForegroundColor White
if ($pingResult) {
    Write-Host "   ✓ CONECTADO ($linuxIP)" -ForegroundColor Green
} else {
    Write-Host "   ❌ NO CONECTADO ($linuxIP)" -ForegroundColor Red
    $allGood = $false
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

if ($allGood) {
    Write-Host "✓ ¡CONFIGURACIÓN COMPLETA Y EXITOSA!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Ahora puedes conectarte desde Linux con:" -ForegroundColor Yellow
    Write-Host "  ssh $username@10.13.0.29" -ForegroundColor White
} else {
    Write-Host "⚠ CONFIGURACIÓN INCOMPLETA" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Revisa los elementos marcados con ❌ arriba" -ForegroundColor Yellow
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# =====================================================
# INFORMACIÓN PARA COMPARTIR
# =====================================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "INFORMACIÓN PARA COMPARTIR CON CLAUDE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Copia y pega este bloque completo:" -ForegroundColor Yellow
Write-Host ""
Write-Host "--- INICIO REPORTE ---" -ForegroundColor Gray

$report = @{
    Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    OS = $osInfo.Caption
    OSVersion = $osInfo.Version
    ComputerName = $computerInfo.Name
    IPAddresses = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"} | Select-Object -ExpandProperty IPAddress) -join ", "
    SSHServiceStatus = $sshdStatus
    SSHServiceStartType = (Get-Service sshd).StartType
    FirewallRulesCount = $firewallRules.Count
    Port22Listening = if ($portListening) { "Yes" } else { "No" }
    UserExists = if ($userExists) { "Yes" } else { "No" }
    ConnectivityToLinux = if ($pingResult) { "Yes" } else { "No" }
    ConfigurationComplete = if ($allGood) { "Yes" } else { "No" }
}

$report | ConvertTo-Json -Depth 3

Write-Host "--- FIN REPORTE ---" -ForegroundColor Gray
Write-Host ""

Write-Host "Presiona ENTER para salir..." -ForegroundColor Yellow
Read-Host
