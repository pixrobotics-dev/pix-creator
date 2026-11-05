# pix-creator

Plugin de Claude Code para **crear, leer, editar y verificar proyectos de PIX RPA** (`.pix`) sin instalar PIX CLI. Versión 0.1.0.

La documentación completa (requisitos del equipo, verificación automática, instalación, actualización y limitaciones) está en el [README del repositorio](https://github.com/pixrobotics-dev/pix-creator#readme).

## Qué incluye

| Pieza | Qué hace |
|---|---|
| `backend/` → servidor MCP **pix-gen** | `search_activities`, `generate_project`, `generate_script`, `read_project`, `read_script`, `edit_script`, `verify_script`, `inspect_ui`. |
| `extras/` → servidor MCP **pix-extras** | `capture_selector`, `excel`, `analyze_uipath`, `approve_migration`. |
| `skills/pix-generator` | Reglas y estándares de código PIX. |
| `skills/pix-selectores` | Cómo elegir XPaths robustos y validarlos. |
| `skills/pix-migracion-uipath` | Flujo obligatorio de migración: analizar → contar → pedir aprobación → migrar. |
| `hooks/guard.mjs` | Bloquea leer o editar a mano los archivos de proyecto PIX y los `.xlsx`, y exige aprobación antes de migrar. |

## Requisitos resumidos

Windows de 64 bits, **PIX Studio** en `C:\Program Files\PIX`, la fuente local `C:\ProgramData\PIX\.nuget`, **.NET 10 Desktop Runtime (x64)**, **Node.js 20+**, **Claude Code** con `claude plugin` y **Git**. Opcional: Chrome con la extensión de PIX (modo web de `capture_selector`).

El detalle y el comando para comprobarlos están en el README del repositorio (`scripts/verificar-requisitos.ps1`).

## Uso

Pide la automatización en lenguaje natural. Claude sigue la skill `pix-generator`: busca actividades, diseña, genera y verifica. No pre-apruebes `approve_migration` en permisos automáticos: su aviso de permiso es el candado de la migración.

## Mantenimiento

- Reconstruir `pix-extras` tras cambiar su código: `cd extras && npm install && npm run build` (genera `extras/dist/server.mjs`).
- Desactivar el hook puntualmente: variable de entorno `PIX_CREATOR_GUARD=off`.
- Estado de la aprobación de migraciones: `%USERPROFILE%\.pix-creator\gate.json`.
