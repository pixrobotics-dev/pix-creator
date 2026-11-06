# PIX Creator for Claude Code

**English** | [Español](README.md)

A [Claude Code](https://code.claude.com) plugin to **create, read, edit and verify PIX RPA projects** (`.pix`) by chatting with Claude, without installing PIX CLI. Afterwards you open the project in **PIX Studio** and run it.

Current version: **0.1.0**. Change history: [CHANGELOG.md](CHANGELOG.md) (Spanish).

## What is included

| Component | What it does |
|---|---|
| **pix-gen** MCP server | Searches activities, generates projects and scripts, reads them, edits them and verifies them (`search_activities`, `generate_project`, `generate_script`, `read_project`, `read_script`, `edit_script`, `verify_script`, `inspect_ui`). |
| **pix-extras** MCP server | `capture_selector` (you point at an element on screen and Claude picks the most robust XPath), `excel` (read and write `.xlsx` files without losing formatting), `analyze_uipath` and `approve_migration` (UiPath-to-PIX migration, only with your approval). |
| Skills | `pix-generator` (PIX coding rules and standards), `pix-selectores` (selectors), `pix-migracion-uipath` (UiPath migration workflow). |
| Protection hook | Stops Claude from reading or hand-editing `.pix`, `.pixproj`, `packages.config`, `nuget.config` and `.xlsx` files (that would corrupt them), and blocks generating or editing while a migration is waiting for approval. |

## Machine requirements

Everything below must be present on the machine **where the plugin is used**. The plugin does not install any of these components.

### Required

| # | Requirement | Details | How to check | If missing |
|---|---|---|---|---|
| 1 | **64-bit Windows** | Windows 10 or 11 (x64). The plugin's executables are x64. | `systeminfo`, or Settings → System → About | No alternative: the plugin does not run on macOS or Linux. |
| 2 | **PIX Studio** | In the **default location `C:\Program Files\PIX`** (the plugin does not look anywhere else). It must contain `Robot.exe`, `PIX.Recorder.Desktop.exe` and the `Activities.*.dll` libraries. Tested version: **3.2.1**. | `Test-Path "C:\Program Files\PIX\Robot.exe"` | Install PIX Studio with its official installer. |
| 3 | **PIX local package source** | The folder `C:\ProgramData\PIX\.nuget`, containing `PIX.Activities.*.nupkg` packages (generated projects use `PIX.Activities 3.0.0`). Created by the PIX Studio installer. | `Test-Path "C:\ProgramData\PIX\.nuget\PIX.Activities.3.0.0.nupkg"` | Reinstall or update PIX Studio. |
| 4 | **.NET 10 Desktop Runtime (x64)** | Both `Microsoft.NETCore.App 10.x` **and** `Microsoft.WindowsDesktop.App 10.x` must be listed. The ".NET 10 Desktop Runtime" installer includes both. | `dotnet --list-runtimes` | Install from [dotnet.microsoft.com/download/dotnet/10.0](https://dotnet.microsoft.com/download/dotnet/10.0). |
| 5 | **Node.js 20 or newer** | Runs the `pix-extras` server and the hook. Tested with 22.14. | `node -v` | Install Node.js LTS from [nodejs.org](https://nodejs.org). |
| 6 | **Claude Code** | A version that has the `claude plugin` command. Tested with 2.1.303. | `claude --version` and `claude plugin --help` | Install or update Claude Code. |
| 7 | **Git** | Claude Code uses it to download the marketplace from GitHub. | `git --version` | Install [Git for Windows](https://git-scm.com). |
| 8 | **Internet access to `github.com` (port 443)** | Only to install and update the plugin. | `Test-NetConnection github.com -Port 443` | Check proxy, VPN or firewall. |

### Optional

| Requirement | What it is for | If missing |
|---|---|---|
| **Google Chrome with the PIX extension** | `capture_selector` in **web mode** (pointing at an element on a web page). Tested only with Chrome; another browser works only if it has the PIX extension. | Desktop mode works without the extension. |
| **Active PIX license** | Running complete robots. Without it, `verify_script` with `runRobot=true` may answer "Demo mode, only 42 steps available". | Generation and structural verification work the same. |

### Not needed

PIX CLI, Microsoft Excel (the `excel` tool does not use it; only robots that use Interop activities need it), Python, Visual Studio, or administrator rights for the plugin. Installing PIX Studio, .NET or Node may require administrator rights.

### Automatic verification

The script [`scripts/verificar-requisitos.ps1`](scripts/verificar-requisitos.ps1) checks everything above **without installing or modifying anything**:

```bash
powershell -ExecutionPolicy Bypass -File scripts\verificar-requisitos.ps1
```

With `-Json` it returns machine-readable output (`ok`, `summary` and, for each requirement, `id`, `status`, `found`, `expected` and `fix`). Statuses: `PASS`, `FAIL` (a required item is missing), `WARN` (an optional or recommended item is missing) and `INFO`. Exit code `0` if there is no `FAIL`, `1` otherwise. The script's text output is currently in Spanish.

### For AI agents

If an AI tool reads this repository in order to install it on a machine:

1. Verify the machine **before** installing, using the script above (`-Json`) or the commands in the "How to check" column.
2. Report every `FAIL` to the user and what to do about it (the "If missing" column). **Do not install software on your own without asking.**
3. If every required item passes, install (see below) and ask the user to open a new Claude Code session.
4. Do not add `approve_migration` to any automatic permission list and do not change any other user settings.

The requirements in machine-readable form:

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

## Installation

Once the requirements are met:

```bash
claude plugin marketplace add pixrobotics-dev/pix-creator
```
```bash
claude plugin install pix-creator@pix-robotics
```

Open a **new** Claude Code session. The first time, it will ask you to approve the servers and the tools. **Do not select "always allow" for `approve_migration`**: its prompt is the lock that protects migrations.

Prefer to let Claude install it for you? Use the prompt in [docs/INSTALL-WITH-CLAUDE.md](docs/INSTALL-WITH-CLAUDE.md).

## First use

Ask in plain language (Claude answers in your language):

> Create a robot that opens the Windows Calculator, adds 7 + 5 and shows the result in a message box. Save it in `Documents\PIX\CalculatorSum`.

Claude will search for activities, design the script, generate it and verify it. If it needs to point at something on screen (for example a Calculator button), it will ask you to capture it with `capture_selector`. Then open the folder in PIX Studio and run it.

## What the plugin touches on your machine

- **Reads** `C:\Program Files\PIX` (activity catalog, element picker, `Robot.exe`) and `C:\ProgramData\PIX\.nuget`.
- **Writes** only to the project folders and Excel files you ask it to modify, plus the migration state in `%USERPROFILE%\.pix-creator\gate.json`.
- **Runs** `Robot.exe` only when a script is verified with `runRobot=true`, and opens the PIX element picker only when you use `capture_selector`.
- The `pix-extras` server makes no network connections.
- Claude Code asks for your approval before using the tools.

## Update and uninstall

```bash
claude plugin marketplace update pix-robotics
```
```bash
claude plugin update pix-creator@pix-robotics
```
```bash
claude plugin uninstall pix-creator@pix-robotics
```

## Known limitations

- The activity catalog is partial (274 activities): the **Telegram** and **Tesseract OCR** activities are not loaded.
- `verify_script` with `runRobot=true` really runs Robot.exe; use it only with scripts that have no external side effects.
- In `capture_selector` web mode, the PIX extension must be installed in the browser where you click.
- `analyze_uipath` only measures migration coverage; it does not convert automatically.
- Windows 64-bit only.
- Part of the tool messages, the skills and the verification script output are in Spanish. Claude answers in your language, and the generated projects are normal PIX projects.

## Tested versions, license and notices

| Component | Tested version |
|---|---|
| PIX Studio (Recorder / Runner) | 3.2.1 |
| Robot.exe (in the Studio folder) | 3.1.0 |
| .NET (NETCore + WindowsDesktop) | 10.0.7 |
| Node.js | 22.14.0 |
| Claude Code | 2.1.303 |
| Windows | 11 Pro (10.0.26300) |

- [COMPATIBILIDAD.md](COMPATIBILIDAD.md): compatibility notes (Spanish).
- [LICENSE](LICENSE) and [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
- Maintenance and releases: [docs/MANTENIMIENTO.md](docs/MANTENIMIENTO.md) (Spanish).
