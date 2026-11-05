# Copia el motor de PIX CLI al plugin (solo lectura del original).
# Uso (desde la raíz del repositorio): powershell -File scripts\actualizar-backend.ps1
# Cierra antes las sesiones de Claude Code que tengan el plugin activo.
$ErrorActionPreference = "Stop"
$origen  = "C:\Program Files\PIX CLI\app\backend"
$destino = Join-Path $PSScriptRoot "..\pix-creator\backend"
if (-not (Test-Path "$origen\pix_genMCP.exe")) { throw "No encuentro $origen\pix_genMCP.exe (¿PIX CLI instalado?)" }
robocopy $origen $destino /MIR /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy falló ($LASTEXITCODE)" }
Write-Host "Backend actualizado desde $origen"
Write-Host "Siguiente: probar, subir 'version' en pix-creator/.claude-plugin/plugin.json, actualizar CHANGELOG y COMPATIBILIDAD."
