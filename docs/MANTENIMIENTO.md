# Guía del mantenedor

## Publicar una versión nueva

1. Haz los cambios. Si cambiaste `pix-creator/extras/server.mjs`, `capture.mjs` o `gate.mjs`, reconstruye el servidor empaquetado:
   ```bash
   cd pix-creator/extras && npm install && npm run build
   ```
   (`dist/server.mjs` se sube al repositorio; `node_modules/` no).
2. Sube `version` en `pix-creator/.claude-plugin/plugin.json`. **Si no la cambias, los usuarios no reciben la actualización.**
3. Añade la entrada en `CHANGELOG.md` y, si cambió la versión de Studio probada, en `COMPATIBILIDAD.md`.
4. Valida:
   ```bash
   claude plugin validate pix-creator
   claude plugin validate .
   ```
5. Haz commit, sube a `main` y crea una etiqueta `vX.Y.Z`.
6. Los usuarios actualizan con:
   ```bash
   claude plugin marketplace update pix-robotics
   claude plugin update pix-creator@pix-robotics
   ```

## Actualizar el motor cuando salga una versión nueva de PIX

```bash
powershell -File scripts/actualizar-backend.ps1
```

Copia `C:\Program Files\PIX CLI\app\backend` a `pix-creator/backend/`. Después prueba, sube la versión y documenta la compatibilidad.

## Antes de publicar: revisión de secretos

Antes de cada subida, comprueba que el repositorio no contiene secretos, contraseñas, tokens ni archivos de credenciales, ni datos personales o rutas locales. El `.gitignore` ya excluye `.env`, `*.pem`, `*.key`, `*.pfx`, `*.lic` y archivos `*credentials*`.

## Equipos y organizaciones

Un proyecto puede sugerir el marketplace a quien lo abra, con `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "pix-robotics": { "source": { "source": "github", "repo": "pixrobotics-dev/pix-creator" } }
  },
  "enabledPlugins": { "pix-creator@pix-robotics": true }
}
```
