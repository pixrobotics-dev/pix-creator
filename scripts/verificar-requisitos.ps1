# Verifica que este equipo cumple los requisitos de pix-creator. SOLO LEE; no instala ni modifica nada.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\verificar-requisitos.ps1          (tabla legible)
#   powershell -ExecutionPolicy Bypass -File scripts\verificar-requisitos.ps1 -Json    (salida para una IA o un script)
#
# Estados: PASS = cumple | FAIL = falta un requisito obligatorio | WARN = falta algo opcional o recomendado | INFO = dato informativo
# Codigo de salida: 0 si no hay ningun FAIL; 1 si hay al menos un FAIL.
# (Texto en ASCII a proposito: compatible con Windows PowerShell 5.1 sin BOM.)
param([switch]$Json)
$ErrorActionPreference = "SilentlyContinue"
$results = New-Object System.Collections.ArrayList

function Add-Check($id, $name, $required, $status, $found, $expected, $fix) {
  [void]$results.Add([pscustomobject]@{
    id = $id; name = $name; required = [bool]$required; status = $status
    found = $found; expected = $expected; fix = $fix
  })
}
function Get-Cmd($n) { $c = Get-Command $n -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { $c.Source } else { $null } }

# 1. Sistema operativo de 64 bits
$os = Get-CimInstance Win32_OperatingSystem
$is64 = [Environment]::Is64BitOperatingSystem
Add-Check "os" "Windows de 64 bits" $true ($(if ($os -and $is64 -and $os.Caption -match "Windows") { "PASS" } else { "FAIL" })) `
  ("{0} (build {1}), 64 bits: {2}" -f $os.Caption, $os.BuildNumber, $is64) "Windows 10 u 11, 64 bits (x64)" "Los ejecutables del plugin son x64 y solo corren en Windows de 64 bits."

# 2. PIX Studio instalado en C:\Program Files\PIX
$studioDir = "C:\Program Files\PIX"
$need = @("Robot.exe", "PIX.Recorder.Desktop.exe")
$missing = @($need | Where-Object { -not (Test-Path (Join-Path $studioDir $_)) })
$activityDlls = @(Get-ChildItem $studioDir -Filter "Activities.*.dll" -ErrorAction SilentlyContinue).Count
if (Test-Path $studioDir) {
  if ($missing.Count -eq 0 -and $activityDlls -gt 0) { $st = "PASS"; $f = "$studioDir ($activityDlls bibliotecas de actividades)" }
  else { $st = "FAIL"; $f = "$studioDir existe pero faltan: $($missing -join ', ') ; bibliotecas de actividades: $activityDlls" }
} else { $st = "FAIL"; $f = "No existe $studioDir" }
Add-Check "pix-studio" "PIX Studio instalado en C:\Program Files\PIX" $true $st $f `
  "Carpeta con Robot.exe, PIX.Recorder.Desktop.exe y las bibliotecas Activities.*.dll" `
  "Instalar PIX Studio con su instalador oficial en la ruta por defecto (C:\Program Files\PIX). El plugin NO la busca en otro sitio."

# 3. Version de PIX Studio (informativo contra la version probada)
$tested = "3.2.1"
$uninst = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*" |
  Where-Object { $_.DisplayName -eq "PIX Studio" } | Select-Object -First 1
$ver = $null
if ($uninst) { $ver = $uninst.DisplayVersion }
elseif (Test-Path (Join-Path $studioDir "PIX.Recorder.Desktop.exe")) { $ver = (Get-Item (Join-Path $studioDir "PIX.Recorder.Desktop.exe")).VersionInfo.ProductVersion }
if (-not $ver) { Add-Check "studio-version" "Version de PIX Studio" $false "WARN" "no detectada" "Probada con $tested" "Instalar o reparar PIX Studio." }
elseif ($ver -eq $tested) { Add-Check "studio-version" "Version de PIX Studio" $false "PASS" $ver "Probada con $tested" "" }
else { Add-Check "studio-version" "Version de PIX Studio" $false "WARN" $ver "Probada con $tested" "Otra version puede cambiar el catalogo de actividades. Funciona si el catalogo carga; verificar con search_activities." }

# 4. Fuente local de paquetes NuGet de PIX (la crea el instalador de Studio)
$nuget = "C:\ProgramData\PIX\.nuget"
$act = @(Get-ChildItem $nuget -Filter "PIX.Activities.*.nupkg" -ErrorAction SilentlyContinue)
if ($act.Count -gt 0) {
  $has3 = Test-Path (Join-Path $nuget "PIX.Activities.3.0.0.nupkg")
  Add-Check "nuget-local" "Fuente local de paquetes de PIX" $true ($(if ($has3) { "PASS" } else { "WARN" })) `
    ("{0} ({1} paquetes PIX.Activities*; PIX.Activities 3.0.0: {2})" -f $nuget, $act.Count, $has3) `
    "Carpeta con paquetes PIX.Activities*.nupkg, incluida la version 3.0.0" "Reinstalar o actualizar PIX Studio; los proyectos generados usan PIX.Activities 3.0.0."
} else {
  Add-Check "nuget-local" "Fuente local de paquetes de PIX" $true "FAIL" "No hay paquetes en $nuget" "Carpeta con paquetes PIX.Activities*.nupkg" "Reinstalar PIX Studio (el instalador crea esta carpeta)."
}

# 5. .NET 10 (NETCore + WindowsDesktop), 64 bits
$dotnet = Get-Cmd "dotnet"
$rt = @()
if ($dotnet) { $rt = @(& $dotnet --list-runtimes 2>$null) }
$core = @($rt | Where-Object { $_ -match "^Microsoft\.NETCore\.App 10\." })
$desk = @($rt | Where-Object { $_ -match "^Microsoft\.WindowsDesktop\.App 10\." })
$x64Path = $dotnet -and ($dotnet -notmatch "x86")
if ($core.Count -gt 0 -and $desk.Count -gt 0) {
  Add-Check "dotnet" ".NET 10 Desktop Runtime (x64)" $true "PASS" ("{0} ; {1}" -f ($core[0] -replace " \[.*", ""), ($desk[0] -replace " \[.*", "")) "Microsoft.NETCore.App 10.x y Microsoft.WindowsDesktop.App 10.x" ""
} else {
  $f = if ($dotnet) { "Runtimes encontrados: " + (($rt | ForEach-Object { $_ -replace " \[.*", "" }) -join " ; ") } else { "dotnet no esta instalado o no esta en el PATH" }
  Add-Check "dotnet" ".NET 10 Desktop Runtime (x64)" $true "FAIL" $f "Microsoft.NETCore.App 10.x y Microsoft.WindowsDesktop.App 10.x" "Instalar '.NET 10 Desktop Runtime' (x64) desde dotnet.microsoft.com/download/dotnet/10.0 (incluye ambos)."
}

# 6. Node.js 20 o superior
$node = Get-Cmd "node"; $nv = $null
if ($node) { $nv = (& $node -v 2>$null) }
if ($nv -match "^v(\d+)\.") {
  $major = [int]$Matches[1]
  Add-Check "node" "Node.js 20 o superior" $true ($(if ($major -ge 20) { "PASS" } else { "FAIL" })) $nv "v20 o superior" "Instalar Node.js LTS desde nodejs.org."
} else { Add-Check "node" "Node.js 20 o superior" $true "FAIL" "node no esta instalado o no esta en el PATH" "v20 o superior" "Instalar Node.js LTS desde nodejs.org." }

# 7. Claude Code con soporte de plugins
$claude = Get-Cmd "claude"; $cv = $null; $plug = $false
if ($claude) { $cv = (& $claude --version 2>$null | Select-Object -First 1); & $claude plugin --help *> $null; $plug = ($LASTEXITCODE -eq 0) }
if ($claude -and $plug) { Add-Check "claude-code" "Claude Code con soporte de plugins" $true "PASS" "$cv" "Version reciente con el comando 'claude plugin' (probado con 2.1.303)" "" }
elseif ($claude) { Add-Check "claude-code" "Claude Code con soporte de plugins" $true "FAIL" "$cv (sin comando 'claude plugin')" "Version reciente con 'claude plugin'" "Actualizar Claude Code." }
else { Add-Check "claude-code" "Claude Code con soporte de plugins" $true "FAIL" "claude no esta en el PATH desde esta consola" "Claude Code instalado" "Instalar Claude Code desde code.claude.com." }

# 8. Git (necesario para instalar el marketplace desde GitHub)
$git = Get-Cmd "git"
if ($git) { Add-Check "git" "Git" $true "PASS" ((& $git --version 2>$null) | Select-Object -First 1) "Git instalado (para 'claude plugin marketplace add' desde GitHub)" "" }
else { Add-Check "git" "Git" $true "FAIL" "git no esta instalado o no esta en el PATH" "Git instalado" "Instalar Git for Windows (git-scm.com). Alternativa: instalar desde el zip sin Git." }

# 9. Acceso a GitHub (solo para instalar y actualizar)
$net = $false
try { $r = Test-NetConnection -ComputerName "github.com" -Port 443 -WarningAction SilentlyContinue; $net = [bool]$r.TcpTestSucceeded } catch { }
Add-Check "github" "Acceso a github.com:443" $false ($(if ($net) { "PASS" } else { "WARN" })) ("alcanzable: {0}" -f $net) "Conexion a github.com por HTTPS (instalar y actualizar el plugin)" "Revisar proxy, VPN o firewall. Un repositorio privado ademas requiere iniciar sesion en GitHub con una cuenta con acceso."

# 10. Navegador con la extension de PIX (solo para capture_selector en modo web)
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$extFound = $false
if ($chrome) {
  $extRoot = "$env:LOCALAPPDATA\Google\Chrome\User Data"
  Get-ChildItem $extRoot -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq "Default" -or $_.Name -like "Profile *" } | ForEach-Object {
    Get-ChildItem (Join-Path $_.FullName "Extensions") -Recurse -Filter "manifest.json" -Depth 2 -ErrorAction SilentlyContinue | ForEach-Object {
      $t = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
      if ($t -match '"name"\s*:\s*"[^"]*PIX' -or $t -match '"description"\s*:\s*"[^"]*PIX') { $extFound = $true }
    }
  }
}
if ($chrome -and $extFound) { Add-Check "browser-ext" "Chrome con la extension de PIX (opcional)" $false "PASS" "Chrome y extension de PIX detectados" "Solo para capture_selector en modo web" "" }
elseif ($chrome) { Add-Check "browser-ext" "Chrome con la extension de PIX (opcional)" $false "WARN" "Chrome instalado; extension de PIX no detectada (puede estar en otro perfil)" "Solo para capture_selector en modo web" "Instalar la extension de PIX para Chrome desde PIX Studio. El modo escritorio no la necesita." }
else { Add-Check "browser-ext" "Chrome con la extension de PIX (opcional)" $false "WARN" "Chrome no detectado" "Solo para capture_selector en modo web" "Instalar Chrome y la extension de PIX. Solo probado con Chrome; otros navegadores (p. ej. Brave) solo si tienen la extension." }

# 11. Microsoft Excel (informativo)
$excel = (Test-Path "Registry::HKEY_CLASSES_ROOT\Excel.Application")
Add-Check "excel-app" "Microsoft Excel (informativo)" $false "INFO" ("instalado: {0}" -f $excel) "No es necesario para la herramienta 'excel' del plugin; solo lo piden los robots que usen actividades Interop" ""

# 12. Licencia local de PIX (informativo; no se valida)
$lic = Test-Path "$env:LOCALAPPDATA\pix\license.lic"
Add-Check "pix-license" "Licencia local de PIX (informativo)" $false "INFO" ("archivo de licencia presente: {0}" -f $lic) "Sin licencia valida Robot.exe puede responder 'Modo de demostracion, solo 42 pasos' al verificar con runRobot" "Activar la licencia desde PIX Studio. No se valida aqui."

$fail = @($results | Where-Object { $_.status -eq "FAIL" }).Count
$warn = @($results | Where-Object { $_.status -eq "WARN" }).Count
if ($Json) {
  [pscustomobject]@{
    tool = "pix-creator"; verified_at = (Get-Date).ToString("s"); ok = ($fail -eq 0)
    summary = [pscustomobject]@{ fail = $fail; warn = $warn; total = $results.Count }
    checks = $results
  } | ConvertTo-Json -Depth 5
} else {
  Write-Host ""
  Write-Host "Verificacion de requisitos de pix-creator" -ForegroundColor Cyan
  Write-Host ("-" * 78)
  foreach ($r in $results) {
    $color = switch ($r.status) { "PASS" { "Green" } "FAIL" { "Red" } "WARN" { "Yellow" } default { "Gray" } }
    Write-Host ("[{0}] {1}" -f $r.status, $r.name) -ForegroundColor $color
    Write-Host ("       encontrado: {0}" -f $r.found)
    if ($r.status -in @("FAIL", "WARN") -and $r.fix) { Write-Host ("       que hacer : {0}" -f $r.fix) }
  }
  Write-Host ("-" * 78)
  if ($fail -eq 0) { Write-Host ("Listo para instalar. Avisos: {0}" -f $warn) -ForegroundColor Green }
  else { Write-Host ("Faltan {0} requisito(s) obligatorio(s). Avisos: {1}" -f $fail, $warn) -ForegroundColor Red }
}
if ($fail -gt 0) { exit 1 } else { exit 0 }
