# Instalación de WSL Ubuntu en Windows

## Método 1: Script Automático (Recomendado)

### Pasos:

1. **Abrir PowerShell como Administrador**
   - Busca "PowerShell" en el menú Inicio
   - Clic derecho → "Ejecutar como Administrador"

2. **Navegar al directorio del proyecto**
   ```powershell
   cd C:\ServiceLayer
   ```

3. **Ejecutar el script de instalación**
   ```powershell
   .\install-wsl-simple.ps1
   ```

4. **Reiniciar Windows** cuando el script lo solicite

5. **Después del reinicio:**
   - Busca "Ubuntu" en el menú Inicio
   - Ábrelo y configura tu usuario y contraseña

6. **Configurar el ambiente (opcional)**
   ```bash
   bash /mnt/c/ServiceLayer/setup-servicelayer-wsl.sh
   ```

---

## Método 2: Instalación Manual

### Opción A: Comando Simple (Windows 11 / Windows 10 22H2+)

1. Abrir PowerShell como Administrador
2. Ejecutar:
   ```powershell
   wsl --install -d Ubuntu
   ```
3. Reiniciar Windows
4. Abrir "Ubuntu" y configurar usuario

### Opción B: Instalación Paso a Paso (Windows 10 anterior a 22H2)

1. **Habilitar WSL**
   ```powershell
   dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
   ```

2. **Habilitar Plataforma de Máquina Virtual**
   ```powershell
   dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
   ```

3. **Reiniciar Windows**

4. **Descargar e instalar el paquete de actualización del kernel de Linux**
   - https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi

5. **Establecer WSL 2 como predeterminado**
   ```powershell
   wsl --set-default-version 2
   ```

6. **Instalar Ubuntu desde Microsoft Store**
   - Abrir Microsoft Store
   - Buscar "Ubuntu"
   - Instalar

---

## Verificación de la Instalación

Después de instalar, verifica que todo funcione:

```powershell
# Ver versión de WSL
wsl --version

# Ver distribuciones instaladas
wsl --list --verbose

# Debe mostrar algo como:
# NAME      STATE           VERSION
# Ubuntu    Running         2
```

---

## Comandos Útiles de WSL

```powershell
# Iniciar Ubuntu
wsl

# Listar distribuciones
wsl --list --verbose

# Establecer distribución predeterminada
wsl --set-default Ubuntu

# Apagar WSL
wsl --shutdown

# Terminar una distribución específica
wsl --terminate Ubuntu

# Actualizar WSL
wsl --update
```

---

## Acceso a Archivos

### Desde Windows → WSL
Los archivos de WSL están en:
```
\\wsl$\Ubuntu\home\usuario
```

### Desde WSL → Windows
Los archivos de Windows están en:
```bash
/mnt/c/          # Disco C:
/mnt/d/          # Disco D:

# Ejemplo: acceder a ServiceLayer
cd /mnt/c/ServiceLayer
```

---

## Configuración Inicial de Ubuntu

Después de instalar Ubuntu, ejecuta:

```bash
# Actualizar paquetes
sudo apt update && sudo apt upgrade -y

# Instalar herramientas básicas
sudo apt install -y git curl wget build-essential
```

---

## Solución de Problemas

### Error: "Virtualización no habilitada"
1. Reinicia y entra al BIOS (F2, Del, F12 según el fabricante)
2. Busca "Virtualization Technology" o "VT-x" o "AMD-V"
3. Habilítalo
4. Guarda y reinicia

### Error: "WSL 2 requiere una actualización"
- Descarga: https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi
- Instálalo y reinicia

### Ubuntu no inicia
```powershell
# Reiniciar WSL
wsl --shutdown
wsl
```

### Resetear Ubuntu (ELIMINA TODOS LOS DATOS)
```powershell
wsl --unregister Ubuntu
wsl --install -d Ubuntu
```

---

## Recursos

- Documentación oficial de Microsoft: https://docs.microsoft.com/windows/wsl
- Ubuntu en WSL: https://ubuntu.com/wsl

---

**Última actualización:** 2025-10-21
