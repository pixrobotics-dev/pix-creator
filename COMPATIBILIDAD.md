# Compatibilidad

## Versiones probadas (pix-creator 0.1.0)

| Componente | Versión |
|---|---|
| PIX Studio (Recorder / Runner) | 3.2.1 |
| Robot.exe (en la carpeta de Studio) | 3.1.0 |
| .NET (NETCore + WindowsDesktop) | 10.0.7 |
| Node.js | 22.14.0 |
| Claude Code | 2.1.303 |
| Windows | 11 Pro (10.0.26300) |

## Reglas de compatibilidad

- El motor (`pix-creator/backend`) **lee el catálogo de actividades de la instalación de PIX Studio** en `C:\Program Files\PIX`. Si la versión de Studio difiere mucho de la probada, el catálogo puede cambiar o cargarse de forma parcial. Con la combinación probada, tres bibliotecas no cargan: `Activities.Telegram`, `Activities.Tesseract` y `Microsoft.AspNetCore.SignalR.Core`.
- Los proyectos generados usan el paquete `PIX.Activities 3.0.0`, que debe existir en `C:\ProgramData\PIX\.nuget`.
- `capture_selector` en modo web requiere la extensión de PIX en el navegador usado (probado con Chrome).
- Windows de 64 bits y .NET 10 Desktop Runtime (x64).

Para comprobar un equipo: `powershell -ExecutionPolicy Bypass -File scripts\verificar-requisitos.ps1`.

## Cómo añadir una versión nueva a esta tabla

Cuando se pruebe con otra versión de Studio, agregar una columna a la tabla y una línea al [CHANGELOG](CHANGELOG.md).
