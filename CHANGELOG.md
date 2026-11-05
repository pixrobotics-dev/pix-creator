# Historial de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Cada versión se publica subiendo `version` en `pix-creator/.claude-plugin/plugin.json`.

## [0.1.0] - 2026-11-05

Primera versión pública.

### Añadido
- Servidor MCP `pix-gen` (motor de PIX): búsqueda de actividades, generación, lectura, edición y verificación de proyectos `.pix`, y validación de selectores de escritorio.
- Servidor MCP `pix-extras`: `capture_selector` (modos web y escritorio), `excel`, `analyze_uipath` y `approve_migration`.
- Skills `pix-generator`, `pix-selectores` y `pix-migracion-uipath`.
- Hook de protección de archivos de proyecto PIX y de Excel, y aprobación obligatoria antes de migrar desde UiPath.
- Marketplace `pix-robotics`.
- Script `scripts/verificar-requisitos.ps1` para comprobar el equipo (texto o JSON).

### Probado
- Generación y verificación de un proyecto real (lectura de datos y ventana de mensaje), ejecutado en PIX Studio.
- `excel`, `analyze_uipath` con aprobación, hook y `capture_selector` (escritorio y web con Chrome).
- Instalación desde una carpeta limpia.

### Limitaciones
- Catálogo de 274 actividades: no se cargan Telegram ni OCR Tesseract.
