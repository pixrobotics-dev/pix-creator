# PIX Creator para Claude Code

Plugin de [Claude Code](https://code.claude.com) para **crear, leer, editar y verificar proyectos de PIX RPA** (`.pix`) conversando con Claude, sin instalar PIX CLI. Después abres el proyecto en **PIX Studio** y lo ejecutas.

Versión actual: **0.1.0**. Historial en [CHANGELOG.md](CHANGELOG.md).

## Qué incluye

| Pieza | Qué hace |
|---|---|
| Servidor MCP **pix-gen** | Busca actividades, genera proyectos y scripts, los lee, los edita y los verifica (`search_activities`, `generate_project`, `generate_script`, `read_project`, `read_script`, `edit_script`, `verify_script`, `inspect_ui`). |
| Servidor MCP **pix-extras** | `capture_selector` (tú señalas un elemento en pantalla y Claude elige el XPath más robusto), `excel` (leer y escribir `.xlsx` sin perder formato), `analyze_uipath` y `approve_migration` (migración desde UiPath con tu aprobación). |
| Skills | `pix-generator` (reglas y estándares de código PIX), `pix-selectores`, `pix-migracion-uipath`. |
| Hook de protección | Impide que Claude lea o edite a mano `.pix`, `.pixproj`, `packages.config`, `nuget.config` y `.xlsx` (se corromperían), y bloquea generar o editar mientras haya una migración sin aprobar. |

## Requisitos del equipo

Todo lo siguiente debe estar en el equipo **donde se usa el plugin**. El plugin no instala ninguno de estos componentes.

### Obligatorios

| # | Requisito | Detalle | Cómo comprobarlo | Si falta |
|---|---|---|---|---|
| 1 | **Windows de 64 bits** | Windows 10 u 11 (x64). Los ejecutables del plugin son x64. | `systeminfo` o Configuración → Sistema → Acerca de | No hay alternativa: el plugin no funciona en macOS ni Linux. |
| 2 | **PIX Studio** | En la **ruta por defecto `C:\Program Files\PIX`** (el plugin no la busca en otro sitio). Debe contener `Robot.exe`, `PIX.Recorder.Desktop.exe` y las bibliotecas `Activities.*.dll`. Versión probada: **3.2.1**. | `Test-Path "C:\Program Files\PIX\Robot.exe"` | Instalar PIX Studio con su instalador oficial. |
| 3 | **Fuente local de paquetes de PIX** | La carpeta `C:\ProgramData\PIX\.nuget`, con paquetes `PIX.Activities.*.nupkg` (los proyectos generados usan `PIX.Activities 3.0.0`). La crea el instalador de PIX Studio. | `Test-Path "C:\ProgramData\PIX\.nuget\PIX.Activities.3.0.0.nupkg"` | Reinstalar o actualizar PIX Studio. |
| 4 | **.NET 10 Desktop Runtime (x64)** | Debe aparecer `Microsoft.NETCore.App 10.x` **y** `Microsoft.WindowsDesktop.App 10.x`. El instalador «.NET 10 Desktop Runtime» incluye ambos. | `dotnet --list-runtimes` | Instalar desde [dotnet.microsoft.com/download/dotnet/10.0](https://dotnet.microsoft.com/download/dotnet/10.0). |
| 5 | **Node.js 20 o superior** | Ejecuta el servidor `pix-extras` y el hook. Probado con 22.14. | `node -v` | Instalar Node.js LTS desde [nodejs.org](https://nodejs.org). |
| 6 | **Claude Code** | Una versión con el comando `claude plugin`. Probado con 2.1.303. | `claude --version` y `claude plugin --help` | Instalar o actualizar Claude Code. |
| 7 | **Git** | Claude Code lo usa para descargar el marketplace desde GitHub. | `git --version` | Instalar [Git for Windows](https://git-scm.com). |
| 8 | **Acceso a internet hacia `github.com` (puerto 443)** | Solo para instalar y actualizar el plugin. Si el repositorio es privado, además hace falta **iniciar sesión en GitHub con una cuenta con acceso** (el primer `git` que lo necesite abrirá el navegador). | `Test-NetConnection github.com -Port 443` | Revisar proxy, VPN o firewall. |

### Opcionales

| Requisito | Para qué sirve | Si falta |
|---|---|---|
| **Google Chrome con la extensión de PIX** | `capture_selector` en **modo web** (señalar un elemento de una página). Probado solo con Chrome; otro navegador funciona únicamente si tiene la extensión de PIX. | El modo escritorio funciona sin extensión. |
| **Licencia de PIX activa** | Ejecutar robots completos. Sin ella, `verify_script` con `runRobot=true` puede responder «Modo de demostración, solo 42 pasos». | La generación y la verificación estructural funcionan igual. |

### No hacen falta

PIX CLI, Microsoft Excel (la herramienta `excel` no lo usa; solo lo piden los robots que usen actividades Interop), Python, Visual Studio ni permisos de administrador para el plugin. Instalar PIX Studio, .NET o Node sí puede requerir administrador.

### Verificación automática

El script [`scripts/verificar-requisitos.ps1`](scripts/verificar-requisitos.ps1) comprueba todo lo anterior **sin instalar ni modificar nada**:

```bash
powershell -ExecutionPolicy Bypass -File scripts\verificar-requisitos.ps1
```

Con `-Json` devuelve un resultado legible por máquinas (`ok`, `summary` y, por cada requisito, `id`, `status`, `found`, `expected` y `fix`). Estados: `PASS`, `FAIL` (falta un obligatorio), `WARN` (falta un opcional o recomendado) e `INFO`. Código de salida `0` si no hay ningún `FAIL`, `1` si lo hay.

### Para agentes de IA

Si una herramienta de IA lee este repositorio para instalarlo en un equipo:

1. Verifica el equipo **antes** de instalar, con el script anterior (`-Json`) o con los comandos de la columna «Cómo comprobarlo».
2. Informa al usuario de cada requisito `FAIL` y de qué hacer (columna «Si falta»). **No instales software por tu cuenta sin preguntar.**
3. Si todos los obligatorios cumplen, instala (ver más abajo) y pide al usuario abrir una sesión nueva de Claude Code.
4. No agregues `approve_migration` a ninguna lista de permisos automáticos ni modifiques otros ajustes del usuario.

Los requisitos en formato máquina:

```yaml
pix-creator:
  version: 0.1.0
  platform: windows-x64
  required:
    - { id: pix-studio, path: 'C:\Program Files\PIX', files: [Robot.exe, PIX.Recorder.Desktop.exe, 'Activities.*.dll'], tested_version: '3.2.1' }
    - { id: nuget-local, path: 'C:\ProgramData\PIX\.nuget', files: ['PIX.Activities.3.0.0.nupkg'] }
    - { id: dotnet, runtimes: ['Microsoft.NETCore.App 10.x', 'Microsoft.WindowsDesktop.App 10.x'], arch: x64 }
    - { id: node, min_version: 20 }
    - { id: claude-code, command: 'claude plugin', tested_version: '2.1.303' }
    - { id: git }
    - { id: network, host: github.com, port: 443, purpose: install-and-update }
  optional:
    - { id: chrome-pix-extension, purpose: capture_selector-web-mode }
    - { id: pix-license, purpose: full-robot-runs }
  not_required: [pix-cli, microsoft-excel, python, administrator-rights-for-the-plugin]
  verify: 'powershell -ExecutionPolicy Bypass -File scripts\verificar-requisitos.ps1 -Json'
```

## Instalación

Con los requisitos cumplidos:

```bash
claude plugin marketplace add pixrobotics-dev/pix-creator
```
```bash
claude plugin install pix-creator@pix-robotics
```

Abre una **sesión nueva** de Claude Code. La primera vez te pedirá aprobar los servidores y las herramientas. **No marques «permitir siempre» en `approve_migration`**: su aviso es el candado de las migraciones.

¿Prefieres que Claude lo instale por ti? Usa el prompt de [docs/INSTALAR-CON-CLAUDE.md](docs/INSTALAR-CON-CLAUDE.md).

## Primer uso

Pide en lenguaje natural:

> Crea un robot que abra la Calculadora de Windows, haga la suma 7 + 5 y muestre el resultado en una ventana de mensaje. Guárdalo en `Documentos\PIX\SumaCalculadora`.

Claude buscará las actividades, diseñará el script, lo generará y lo verificará. Si necesita señalar un elemento de la pantalla (por ejemplo, un botón de la Calculadora), te pedirá que lo captures con `capture_selector`. Luego abre la carpeta en PIX Studio y ejecútalo.

## Qué toca el plugin en tu equipo

- **Lee** `C:\Program Files\PIX` (catálogo de actividades, selector de elementos, `Robot.exe`) y `C:\ProgramData\PIX\.nuget`.
- **Escribe** solo en las carpetas de proyecto que le indiques, y el estado de las migraciones en `%USERPROFILE%\.pix-creator\gate.json`.
- **Ejecuta** `Robot.exe` únicamente cuando se verifica un script con `runRobot=true` y abre el selector de PIX solo cuando usas `capture_selector`.
- El servidor `pix-extras` no realiza conexiones de red.
- Claude Code te pide aprobación antes de usar las herramientas.

## Actualizar y desinstalar

```bash
claude plugin marketplace update pix-robotics
```
```bash
claude plugin update pix-creator@pix-robotics
```
```bash
claude plugin uninstall pix-creator@pix-robotics
```

## Limitaciones conocidas

- El catálogo es parcial (274 actividades): no se cargan las de **Telegram** ni **OCR Tesseract**.
- `verify_script` con `runRobot=true` ejecuta Robot.exe de verdad; úsalo con scripts sin efectos externos.
- En `capture_selector` modo web, la extensión de PIX debe estar instalada en el navegador donde haces el clic.
- `analyze_uipath` solo mide cobertura de la migración; no convierte automáticamente.
- Solo Windows de 64 bits.

## Compatibilidad, licencia y avisos

- [COMPATIBILIDAD.md](COMPATIBILIDAD.md): versiones probadas.
- [LICENSE](LICENSE) y [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
- Mantenimiento y publicación de versiones: [docs/MANTENIMIENTO.md](docs/MANTENIMIENTO.md).
