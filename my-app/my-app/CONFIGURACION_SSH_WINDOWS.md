# 🔧 CONFIGURACIÓN SSH EN WINDOWS SERVER

## 📋 Guía Completa para Habilitar Control Remoto desde Linux

**Objetivo:** Permitir que la máquina Linux (10.13.1.83) controle el servidor Windows (10.13.0.29) via SSH.

---

## 🚨 PROBLEMA DETECTADO

```
❌ Servidor Windows: 10.13.0.29 - NO ALCANZABLE
✅ Máquina Linux:     10.13.1.83 - ACTUAL
```

**Causa:** Diferentes subredes (10.13.0.x vs 10.13.1.x)

---

## ✅ SOLUCIÓN: CONFIGURACIÓN PASO A PASO

### **PASO 1: Verificar Conectividad de Red**

#### En el Servidor Windows (10.13.0.29):

1. **Abrir PowerShell como Administrador**

2. **Verificar dirección IP:**
```powershell
ipconfig /all
```

3. **Verificar que puede hacer ping a la máquina Linux:**
```powershell
ping 10.13.1.83
```

4. **Si NO puede hacer ping:**
   - Verificar gateway: `route print`
   - Agregar ruta estática si es necesario:
```powershell
route add 10.13.1.0 mask 255.255.255.0 <IP_DEL_GATEWAY>
```

---

### **PASO 2: Instalar OpenSSH Server en Windows**

#### Método 1: Via PowerShell (Recomendado)

```powershell
# Verificar si OpenSSH está disponible
Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH*'

# Instalar OpenSSH Server
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0

# Verificar instalación
Get-Service sshd
```

#### Método 2: Via Configuración de Windows

1. Abrir **Configuración** → **Aplicaciones** → **Características opcionales**
2. Clic en **Agregar una característica**
3. Buscar **"OpenSSH Server"**
4. Clic en **Instalar**

---

### **PASO 3: Configurar OpenSSH Server**

```powershell
# Iniciar servicio SSH
Start-Service sshd

# Configurar inicio automático
Set-Service -Name sshd -StartupType 'Automatic'

# Verificar estado
Get-Service sshd

# Configurar firewall (CRÍTICO)
New-NetFirewallRule -Name sshd -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22
```

---

### **PASO 4: Configurar Firewall de Windows**

#### Opción A: Via PowerShell (Recomendado)

```powershell
# Permitir SSH desde la subred Linux
New-NetFirewallRule -DisplayName "SSH from Linux" `
    -Direction Inbound `
    -LocalPort 22 `
    -Protocol TCP `
    -Action Allow `
    -RemoteAddress 10.13.1.0/24

# Verificar regla creada
Get-NetFirewallRule -DisplayName "SSH from Linux"
```

#### Opción B: Via GUI

1. Abrir **Panel de Control** → **Firewall de Windows Defender**
2. Clic en **Configuración avanzada**
3. **Reglas de entrada** → **Nueva regla...**
4. Tipo: **Puerto**
5. Puerto TCP: **22**
6. Acción: **Permitir la conexión**
7. Ámbito: Agregar IP remota **10.13.1.83** o **10.13.1.0/24**
8. Nombre: **"SSH from Linux"**

---

### **PASO 5: Verificar Configuración SSH**

```powershell
# Ver configuración actual
Get-Content C:\ProgramData\ssh\sshd_config

# Editar configuración (si es necesario)
notepad C:\ProgramData\ssh\sshd_config
```

**Configuración recomendada:**

```
# C:\ProgramData\ssh\sshd_config

Port 22
ListenAddress 0.0.0.0

# Autenticación
PasswordAuthentication yes
PubkeyAuthentication yes

# Seguridad
PermitRootLogin no
MaxAuthTries 3

# Subsistemas
Subsystem powershell pwsh.exe -sshs -NoLogo
Subsystem sftp sftp-server.exe
```

**Después de editar, reiniciar servicio:**
```powershell
Restart-Service sshd
```

---

### **PASO 6: Configurar Usuario SSH**

```powershell
# Verificar que el usuario existe
Get-LocalUser fmolinam

# Si NO existe, crear usuario:
New-LocalUser -Name "fmolinam" -Password (ConvertTo-SecureString "FmDiosMio1" -AsPlainText -Force) -Description "Usuario SSH"

# Agregar a grupo de Administradores (si es necesario)
Add-LocalGroupMember -Group "Administrators" -Member "fmolinam"

# Verificar permisos
Get-LocalGroupMember -Group "Administrators"
```

---

### **PASO 7: Probar Conexión desde Windows**

```powershell
# Probar SSH local
ssh fmolinam@localhost

# Si funciona, salir:
exit
```

---

### **PASO 8: Verificar desde Linux** (Después de configurar Windows)

Desde la máquina Linux (10.13.1.83), ejecutar:

```bash
# Verificar conectividad
ping 10.13.0.29

# Verificar puerto SSH
nc -zv 10.13.0.29 22

# Intentar conexión SSH
ssh fmolinam@10.13.0.29
```

---

## 🔒 CONFIGURACIÓN DE SEGURIDAD ADICIONAL (Opcional)

### Autenticación por Clave SSH (Más Seguro)

#### En Linux (10.13.1.83):

```bash
# Generar par de claves SSH
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa_windows

# Copiar clave pública a Windows
ssh-copy-id -i ~/.ssh/id_rsa_windows.pub fmolinam@10.13.0.29
```

#### En Windows (10.13.0.29):

```powershell
# Verificar que la clave se agregó
Get-Content C:\Users\fmolinam\.ssh\authorized_keys

# Configurar permisos correctos
icacls C:\Users\fmolinam\.ssh\authorized_keys /inheritance:r
icacls C:\Users\fmolinam\.ssh\authorized_keys /grant:r "fmolinam:F"
```

#### Volver a Linux y probar:

```bash
# Conectar sin contraseña
ssh -i ~/.ssh/id_rsa_windows fmolinam@10.13.0.29
```

---

## 🛡️ TROUBLESHOOTING

### Problema 1: "Connection refused"

```powershell
# Verificar servicio
Get-Service sshd

# Si está detenido, iniciarlo
Start-Service sshd

# Ver logs
Get-EventLog -LogName Application -Source sshd -Newest 20
```

### Problema 2: "Connection timed out"

```powershell
# Verificar firewall
Get-NetFirewallRule | Where-Object {$_.LocalPort -eq 22}

# Verificar puertos escuchando
netstat -an | findstr :22
```

### Problema 3: "Permission denied"

```powershell
# Verificar permisos de usuario
net user fmolinam

# Verificar configuración de autenticación
Get-Content C:\ProgramData\ssh\sshd_config | Select-String "PasswordAuthentication"
```

### Problema 4: No alcanzable desde otra subred

```powershell
# Verificar routing
route print

# Agregar ruta estática
route add 10.13.1.0 mask 255.255.255.0 <IP_GATEWAY> -p
```

---

## 📝 COMANDOS ÚTILES POST-INSTALACIÓN

### Desde Linux, ejecutar comandos en Windows:

```bash
# Comando simple
ssh fmolinam@10.13.0.29 "systeminfo"

# Comando PowerShell
ssh fmolinam@10.13.0.29 "powershell -Command 'Get-Process'"

# Ver servicios
ssh fmolinam@10.13.0.29 "sc query state= all"

# Reiniciar servicio
ssh fmolinam@10.13.0.29 "net stop MyService && net start MyService"

# Ver logs
ssh fmolinam@10.13.0.29 "type C:\logs\app.log"
```

---

## 🔄 REINICIAR SERVICIOS REMOTAMENTE

```bash
# Reiniciar servicio Node.js (ejemplo)
ssh fmolinam@10.13.0.29 "taskkill /F /IM node.exe && cd C:\app && start node server.js"

# Reiniciar IIS
ssh fmolinam@10.13.0.29 "iisreset"

# Reiniciar servidor (¡CUIDADO!)
ssh fmolinam@10.13.0.29 "shutdown /r /t 0"
```

---

## 📊 MONITOREO REMOTO

```bash
# CPU y Memoria
ssh fmolinam@10.13.0.29 "wmic cpu get loadpercentage && wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /Value"

# Procesos
ssh fmolinam@10.13.0.29 "tasklist"

# Disco
ssh fmolinam@10.13.0.29 "wmic logicaldisk get size,freespace,caption"

# Uptime
ssh fmolinam@10.13.0.29 "systeminfo | findstr /C:'System Boot Time'"
```

---

## ✅ CHECKLIST DE VERIFICACIÓN

Ejecutar estos comandos en Windows para verificar configuración completa:

```powershell
# ====== SCRIPT DE VERIFICACIÓN ======

Write-Host "=== 1. Verificar Servicio SSH ===" -ForegroundColor Cyan
Get-Service sshd | Select-Object Name, Status, StartType

Write-Host "`n=== 2. Verificar Puerto SSH ===" -ForegroundColor Cyan
netstat -an | findstr :22

Write-Host "`n=== 3. Verificar Firewall ===" -ForegroundColor Cyan
Get-NetFirewallRule | Where-Object {$_.LocalPort -eq 22} | Select-Object DisplayName, Enabled, Direction

Write-Host "`n=== 4. Verificar Usuario ===" -ForegroundColor Cyan
net user fmolinam

Write-Host "`n=== 5. Verificar Configuración SSH ===" -ForegroundColor Cyan
Get-Content C:\ProgramData\ssh\sshd_config | Select-String "Port|PasswordAuthentication|PubkeyAuthentication"

Write-Host "`n=== 6. Probar Conexión Local ===" -ForegroundColor Cyan
ssh fmolinam@localhost -o StrictHostKeyChecking=no "echo 'SSH Funcionando'"

Write-Host "`n=== 7. Verificar Conectividad a Linux ===" -ForegroundColor Cyan
Test-NetConnection -ComputerName 10.13.1.83 -Port 22

Write-Host "`n✅ Verificación Completa" -ForegroundColor Green
```

---

## 🎯 PRÓXIMOS PASOS

Una vez configurado SSH en Windows:

1. ✅ Crear biblioteca Node.js para ejecutar comandos remotos
2. ✅ Implementar API endpoints para gestión remota
3. ✅ Crear dashboard web de administración
4. ✅ Configurar monitoreo automático
5. ✅ Implementar sistema de alertas

---

## 📞 SOPORTE

**Documentos Relacionados:**
- `/REQUISITOS_INFRAESTRUCTURA_WINDOWS.md`
- `/MIGRACION_WINDOWS_SERVER.md`
- `/CHECKLIST_MIGRACION_WINDOWS.md`

---

**Última actualización:** 2025-10-20
**Versión:** 1.0
**Autor:** Claude Code + BlueSystem Team
