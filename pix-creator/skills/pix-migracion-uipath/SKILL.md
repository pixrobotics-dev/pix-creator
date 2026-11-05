---
name: pix-migracion-uipath
description: Migrar un robot de UiPath (carpeta con project.json y archivos .xaml) a un proyecto PIX RPA. Úsala siempre que el usuario traiga un proyecto UiPath, un .xaml, o pida «migrar», «convertir» o «pasar a PIX» un robot. El orden es obligatorio — analizar, contar, pedir aprobación, migrar — y generar/editar quedan bloqueados por un hook hasta que el usuario apruebe.
---

# Migrar un robot de UiPath a PIX

Cuando el usuario quiera traer un robot de UiPath (o te dé una carpeta con archivos `.xaml`), el orden es este y no es negociable. **Generar y editar están BLOQUEADOS hasta que el usuario apruebe**: es un hook del paquete, no una sugerencia.

Herramientas: `analyze_uipath` y `approve_migration` (servidor `pix-extras`), más `AskUserQuestion` para la pregunta, y el ciclo normal de la skill `pix-generator` para construir.

## 1. Analizar primero

Llama a `analyze_uipath` con la carpeta del proyecto (o el `.xaml`, o su `project.json`).

Si el análisis dice **ANÁLISIS INCOMPLETO**, eso va primero: el proyecto llama a otros archivos que no están en la carpeta, y migrar así deja un robot hueco. Pregúntale si falta copiar algo antes de seguir.

## 2. Contarle qué encontraste

En texto: cuántos pasos salen directo, cuántos hay que armar con varios pasos de PIX, cuántos no tienen equivalente, y si el proyecto usa expresiones VisualBasic (cada una hay que traducirla a C#, y es trabajo aparte de los pasos).

Si un patrón se repite, dilo: «siete de los diez a revisar son el mismo caso» son siete apariciones de un problema, no siete problemas.

## 3. Decir qué vas a hacer

Qué scripts vas a crear, en qué carpeta, y qué vas a dejar sin migrar. Si el análisis marcó algo bajo **DECISION DEL USUARIO**, esa decisión es suya: plantéasela aquí, no la tomes tú.

## 4. Pedir la aprobación

Con `AskUserQuestion`: una opción que signifique «sí, migra» y otras libres (ajustar el alcance, cancelar, migrar solo una parte). Redacta las etiquetas en el idioma del usuario.

- Si elige migrar → llama a `approve_migration` con `decision: "aprobar"`. Esa herramienta le mostrará su propio panel de permiso: ese es el candado real. **Nunca la llames sin que el usuario haya elegido migrar, y nunca la agregues a una lista de permitidos automáticos.**
- Si elige cancelar → `approve_migration` con `decision: "cancelar"`.
- Si elige otra opción, el gate sigue cerrado: ajusta el plan y vuelve a preguntar.

## 5. Migrar con el ciclo normal

Recién ahora, y sin atajos por venir de una migración:

- `search_activities` para **confirmar** cada actividad de destino. El análisis dice a dónde va, **no garantiza que la propiedad siga llamándose igual**: el mapeo se auditó a fondo en pocas filas y en todas había un defecto. Los nombres van confirmados, nunca copiados.
- Armas el spec, generas, `verify_script`,
- y cuentas qué quedó hecho y qué quedó pendiente de lo que no tiene equivalente.

## Lo que no se hace

- No generar antes de la aprobación. El hook te corta con el motivo; no reintentes sin resolverlo.
- No inventar nombres de propiedades porque aparecen en el mapeo. Confírmalos.
- No dar por migrado lo que no tiene equivalente. Si no se puede, se dice.
- Todo lo que dice «emite» en el análisis describe lo que produce el conversor, no lo que debes poner; solo coincide en el bloque de mapeo directo. Bajo SIN EQUIVALENTE, lo que «emite» es cómo ABANDONA el paso: copiarlo deja el robot roto sin un solo error.
