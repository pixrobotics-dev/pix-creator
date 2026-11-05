---
name: pix-selectores
description: Capturar y validar selectores de elementos de interfaz (web y escritorio) para scripts PIX RPA. Úsala siempre que un robot deba actuar sobre un elemento (clic, escribir, leer un valor) y no haya un selector fiable: no pidas ni adivines XPath; usa capture_selector (el usuario señala el elemento) e inspect_ui (valida selectores de escritorio contra la app abierta). Se activa con «selector», «XPath», «SearchString», «elemento de la pantalla», «no encuentra el botón/campo».
---

(Tools: `capture_selector` is in the pix-extras server, `inspect_ui` in pix-gen. The activity property is `SearchString` with `SearchBy = XPath`.)

# CAPTURING ELEMENT SELECTORS (web & desktop)

When a bot must act on a specific UI element (click a button, type in a field, read a value) and you don't already have a reliable selector, DON'T ask the user to paste an XPath. Call `capture_selector(mode)` — it opens PIX's picker overlay so the user points at the element, and returns structured data: the leaf element, EVERY attribute on each ancestor node, a positional path, baseline `candidateXPaths`, and `notes`.

IMPORTANT — capture_selector does NOT open or navigate to the page/app; it only opens the picker overlay. So FIRST make sure the user has the target page/app open with the element visible on screen — ask them to get it on screen and wait for their "ok"/"ya". THEN call capture_selector and tell the user: move the mouse over the element until it **highlights in orange**, then single-click to capture it.

`capture_selector` returns the RAW MATERIAL, not the answer. YOU pick the most ROBUST XPath, then write it to the activity's `SearchString` with `SearchBy = XPath` (quote it correctly — it's a C# string literal: `"\"//input[@id='email']\""`). Ranking, best → worst:

1. **Stable semantic attribute**, unique: a human-meaningful `id`/`name` (`id="email"`), `data-testid`, `data-*`, `aria-label`, `role`, `title`, `placeholder`.
2. **Visible text / label**: `//button[normalize-space()='Buscar']`, or anchor via a nearby label: `//label[normalize-space()='Teléfono']/following::input[1]`.
3. **Stable class** — only if clearly semantic, not a state/utility class.
4. **Positional path** — LAST resort; brittle to any layout change.

AVOID (these break on reload/deploy):
- **Auto-generated ids/names**: random-looking tokens (`3YqlF`, `APjFqb`, GUIDs, hashes). The `notes` flag likely ones — trust that and find an alternative.
- **Dynamic state classes**: `ng-invalid`, `ng-untouched`, `active`, `selected`, `mat-focused`…
- **Framework dev-only attributes**: `ng-reflect-*`, `_ngcontent-*`, `_nghost-*`, `data-v-*`, `data-reactid` — exist only in dev builds, gone in production.
- **Deep absolute paths** when any stable option exists.

Look across ALL ancestor nodes, not just the leaf — a robust selector often combines a semantic ancestor with a relative step (`//*[@aria-label='Teléfono']//input`). Prefer the shortest unambiguous XPath. If nothing stable exists anywhere, use the positional path and warn the user it may need maintenance if the page changes.

## VALIDATING DESKTOP SELECTORS (inspect_ui)

For DESKTOP selectors, NEVER write an XPath into a .pix without validating it first with `inspect_ui(selector)` while the app is open — it resolves with PIX's own engine, so "validates" = "the robot will find it". Read the verdict:
- `OK` → write it.
- `NO_EXISTE` + `textoDiff` → the live value differs character-by-character (NBSP, CRLF, accents). Use the corrected literal or the suggested engine-dialect XPath (`xpathSugerido`/`casiIgual.xpathMotor`) — never "fix" it by guessing.
- `AMBIGUO` → make it more specific (it matches N elements; the robot will click "whichever comes first" — intermittent failures).
- `PROVEEDOR_ERRADO` → the element lives in the OTHER provider (UIA vs MSAA); set the activity's provider accordingly.
- `ENTORNO` → the app window is minimized/hidden/closed or elevated — tell the user to fix that; the selector may be correct.
The `ms` cost shown is what EVERY step with that search will pay at runtime — if it's high, mention it. Web selectors: inspect_ui does not apply (desktop only).

Two more capabilities:
- **`point: {x,y}`** — when NO selector reaches an element (e.g. a popup that only appears via mouse hit-test), inspect_ui at that coordinate reports whether ANY XPath can reach it. Verdict `NO_ALCANZABLE` = stop trying XPaths; use keyboard (`act` keys) or an anchored coordinate.
- **`act[]`** — a sequence like `["key:DOWN","key:ENTER"]` or `["type:hola"]` that ACTS on the resolved element to CONFIRM an interaction works, returning before/after snapshots (resolving an element ≠ it actually working). **`act` mutates the live app, so it triggers a user-approval panel** (like edit/generate) — only use it when the user asked you to actually interact, never just to explore. Without `act`, inspect_ui never touches the app.
