# Instalar pix-creator con la ayuda de Claude Code

[English](INSTALL-WITH-CLAUDE.md) | **Español**

Pega este prompt en una sesión de Claude Code. Claude verificará tu equipo contra los [requisitos del README](../README.md#requisitos-del-equipo) antes de instalar.

```text
Instala el plugin pix-creator de PIX en mi Claude Code desde el marketplace de GitHub pixrobotics-dev/pix-creator.

Antes de instalar, lee la sección "Requisitos del equipo" del README de ese repositorio (https://github.com/pixrobotics-dev/pix-creator) y verifica mi equipo con los comandos de la columna "Cómo comprobarlo". Los obligatorios son: Windows de 64 bits, PIX Studio en C:\Program Files\PIX (con Robot.exe y PIX.Recorder.Desktop.exe), la carpeta C:\ProgramData\PIX\.nuget con PIX.Activities.3.0.0.nupkg, .NET 10 Desktop Runtime x64 (Microsoft.NETCore.App y Microsoft.WindowsDesktop.App 10.x), Node.js 20 o superior, Claude Code con el comando "claude plugin", Git y acceso a github.com:443. Los opcionales son Chrome con la extensión de PIX y la licencia de PIX.

Sigue estos pasos en orden. Al terminar cada uno, dime en una línea qué pasó. Si algo falla, detente y explícame el problema: no improvises soluciones ni instales ningún programa sin preguntarme antes.

1. Verifica los requisitos y muéstrame una tabla con PASS, FAIL o WARN por cada uno. Si hay algún FAIL, dime qué falta y de dónde se descarga, y no sigas hasta que yo lo resuelva.

2. Registra e instala el plugin:
   - `claude plugin marketplace add pixrobotics-dev/pix-creator`
   - `claude plugin install pix-creator@pix-robotics`
   Si ya estaba instalado, usa `claude plugin marketplace update pix-robotics` y luego `claude plugin update pix-creator@pix-robotics`.

3. Confirma con `claude plugin list` que pix-creator aparece como habilitado.

4. No modifiques ninguna otra configuración ni permisos. En particular, no agregues `approve_migration` a ninguna lista de permitidos.

5. Termina con un resumen corto. Dime que debo cerrar esta sesión y abrir una nueva para que carguen las herramientas.
```

## Comprobación en la sesión nueva

```text
Comprueba que el plugin pix-creator quedó bien instalado: busca con search_activities la actividad «MessageBox», lista las herramientas del servidor pix-extras y dime si todo responde. No generes ni modifiques nada.
```

## Verificación con el script del repositorio

Si tienes el repositorio clonado o descargado, puedes comprobar todo de una vez:

```bash
powershell -ExecutionPolicy Bypass -File scripts\verificar-requisitos.ps1
```

## Lo que no se puede automatizar

- Claude Code pedirá aprobar los comandos y, después, las herramientas del plugin.
- La sesión hay que reiniciarla a mano.
- Si faltan PIX Studio, .NET, Node o Git, Claude te dirá qué hacer, pero no los instalará sin preguntar.
- Si el repositorio es privado, hace falta iniciar sesión en GitHub con una cuenta que tenga acceso; el primer `git` que lo necesite abrirá el navegador.
