---
name: pix-generator
description: Generate, read, and modify PIX Robotics RPA automation scripts (.pix) and projects (.pixproj). Use when the user asks to create, review, fix, or refactor an automation, RPA script, robot, or workflow for PIX Studio. Also triggers when generating .pix files, creating PIX projects, reading existing scripts, or automating tasks with PIX RPA.
argument-hint: "[description of the automation to create]"
---

# PIX Generator via MCP

You generate, read, and modify PIX RPA projects using 7 MCP tools. You know NOTHING about PIX activities — all activity names, properties, and types come from `search_activities`. Never guess.

## MANDATORY RULES

1. **ALL PIX operations go through MCP tools** — never Read/Edit/Write .pix, .pixproj, packages.config, or nuget.config files directly
2. **READ before EDIT, always** — call `read_script` before every `edit_script` call. After each edit, `read_script` again to confirm the result and get updated paths. Never chain multiple edits blindly.
3. **Large edits: split into phases** — if the edit involves more than ~5 operations, split into multiple `edit_script` calls. After each phase: read → verify paths → next phase. Indices shift after every operation — rereading eliminates guesswork.
4. **ALWAYS `search_activities` before generating** — never guess activity or property names
5. **If MCP fails: STOP** — tell the user which tool failed, do not attempt workarounds

| Need | Tool |
|------|------|
| Find activities | `search_activities` |
| New project (4 files) | `generate_project` |
| Add script to existing project | `generate_script` |
| Read a script | `read_script` |
| Read a project | `read_project` |
| Modify a script | `edit_script` |
| Check for errors | `verify_script` |
| Validate a DESKTOP selector | `inspect_ui` |
| Capture a selector (user points at it) | `capture_selector` (server pix-extras) |
| Read/write .xlsx (Config.xlsx, data) | `excel` (server pix-extras) |
| Migrate a UiPath project | `analyze_uipath` + skill pix-migracion-uipath |

---

## PAQUETE pix-creator (entorno de Claude Code — leer primero)

Esta skill es la de PIX CLI con estos cambios de entorno. Las reglas de arriba siguen igual.

- **Servidores MCP del paquete**: `pix-gen` (search_activities, generate_project, generate_script, read_project, read_script, edit_script, verify_script, inspect_ui) y `pix-extras` (capture_selector, excel, analyze_uipath, approve_migration). En Claude Code sus nombres llevan prefijo de servidor (p. ej. `mcp__plugin_pix-creator_pix-gen__search_activities`); donde esta skill dice `search_activities`, usa la herramienta con ese nombre. Si aparecen como diferidas, cárgalas con ToolSearch antes de empezar.
- **Parámetros reales (camelCase)**: `generate_project(jsonSpec, outputDir, overwrite?)`, `generate_script(jsonSpec, projectDir, overwrite?)`, `read_project(projectDir, includePackages?, includeNugetSources?)`, `read_script(pixPath, includeProperties?, includeVariables?)`, `edit_script(pixPath, operations, outputPath?)`, `verify_script(pixPath, runRobot?)`, `search_activities(query, maxResults?)`. `jsonSpec` y `operations` son strings JSON.
- **Hook de protección**: el paquete bloquea Read/Edit/Write/Bash sobre `.pix`, `.pixproj`, `packages.config`, `nuget.config` y `.xlsx`. No intentes rodearlo: usa las herramientas MCP (para .xlsx, `excel`).
- **Selectores**: nunca pidas un XPath pegado ni lo adivines. Web o escritorio sin selector fiable → skill **pix-selectores** (`capture_selector`, y `inspect_ui` para validar en escritorio).
- **Migración desde UiPath**: skill **pix-migracion-uipath**. Generar y editar quedan bloqueados hasta que el usuario apruebe.
- **Dónde guardar**: si el usuario no dice otra ruta, pregunta (sugiere una carpeta como `Documentos\PIX\<Nombre>`). Nunca escribas dentro de `C:\Program Files\PIX` ni `C:\Program Files\PIX CLI`.
- **Catálogo parcial (conocido, igual que en el CLI)**: no se cargan `Activities.Telegram`, `Activities.Tesseract` (OCR) ni SignalR. Si piden Telegram u OCR Tesseract, avisa de que el generador no las ve; no inventes nombres. El catálogo (274 actividades) se lee de la instalación de PIX Studio en `C:\Program Files\PIX`.
- **`verify_script` con `runRobot: true` ejecuta Robot.exe de verdad** (sin abrir Studio). Solo en scripts sin efectos externos (sin ventanas que bloqueen, correos, borrados ni llamadas a sistemas reales) o pide confirmación antes. Si el robot responde «Modo de demostración, solo 42 pasos», es un límite de licencia del robot, no un error del script.
- **Tipo del libro de Excel**: la variable que recibe `OpenWorkbook.Workbook` es `Activities.CommonExcel.CommonExcelWorkbook`.
- **C# en cadenas interpoladas**: dentro de `$"..."` evita literales de carácter con comillas simples de varios caracteres y comillas dobles anidadas; calcula el texto en un Assign aparte.
- **Arranque lento**: la primera llamada a pix-gen tarda unos segundos (carga el catálogo). Agrupa términos en una sola búsqueda.
- **Idioma**: textos visibles de los pasos en español (infinitivo), como dice coding-standards.md.

---

## WORKFLOW: Complete example

User asks: *"Create an automation that reads an Excel file and sends each row as an email via SMTP"*

### Step 1: Search activities (BATCH all concepts in ONE call)

Each comma-separated term is an independent search. ALWAYS batch every concept the script needs into a single `search_activities` call — N searches cost ONE backend start (~9s) instead of N:

```
search_activities("excel, smtp, foreach, assign, comment, container, trycatch, throw, log")
```

Term rules: 1 word per concept. Add a 2nd space-separated word ONLY if 1 word returns too many irrelevant results (`"excel read"`). If a follow-up search is needed later, batch those terms too.

**Search rules:**
- 1 word: `"excel"`, `"smtp"`, `"chrome"`, `"json"`, `"csv"`, `"http"`, `"credential"`
- 2 words max (if 1 word is too broad): `"excel read"`, `"loop for"`, `"file read"`
- NEVER phrases: ~~`"read data from excel spreadsheet"`~~, ~~`"send an email with attachment"`~~
- Try Spanish if English fails: `"enviar"`, `"leer"`, `"solicitud"`
- No results? Try a synonym: `"imap"` instead of `"receive"`

ALWAYS search these support activities (needed for Step 2 best practices):
`"comment"`, `"container"`, `"trycatch"`, `"throw"`, `"log"`

### Step 2: Design with coding standards

BEFORE writing JSON, read [coding-standards.md](coding-standards.md) and apply its rules to the design. Key rules (the full document has examples and details):

- **Comment headers**: `=== NOMBRE DE LA SECCION ===` before each logical block
- **Display text**: verbs in infinitive — "Construir URL", "Esperar elemento", "Lanzar excepcion". For If: questions — "Token encontrado?". For TryCatch: what it protects — "TryCatch - Abrir Chrome"
- **Logging**: WriteLog at script start and end with context. Levels: Info (normal flow), Warn (retries), Error (catch blocks). Always include context: company name, attempt number, URL, `ex.Message`
- **TryCatch per phase**: one TryCatch per critical phase (NOT one giant TryCatch). Catch: WriteLog Error + ThrowException with specific message per phase
- **Retry pattern**: `LoopWhile(!found && retryCount < maxRetries)` → TryCatch inside → log each attempt `{retryCount}/{maxRetries}` → sleep between retries → ThrowException when exhausted
- **Variables**: camelCase, descriptive. Prefixes: `http*` (requests), `json*` (parsing), `is*/has*` or descriptive bool (`tokenFound`), `max*` (limits), `retry*` (counters). Use real types, not `System.Object`
- **Containers**: group related steps with descriptive name — "Preparar Request HTTP POST", "Ejecutar POST con retry"
- **Script order**: WriteLog start → Comment header → Logic → WriteLog end
- **Web validation**: after LaunchChrome/NavigateURL always WaitForWebElement + WriteLog confirmation

### Step 3: Build JSON and generate

Ask the user where to save. Then call `generate_project` (new) or `generate_script` (existing project).

### Step 4: Verify and deliver

Call `verify_script`. If only EXPECTED runtime errors (file not found, auth failed) → script is ready.
Max 2 fix cycles. When regenerating into the same directory (fix cycle), pass `overwrite: true` — without it the anti-destruction guard refuses to replace the existing .pix. Never ask user for credentials just to pass verification.

---

## C# EXPRESSION RULES (the #1 source of errors)

All property values are C# expressions. The JSON spec wraps them in a string.

| What you want | Correct | WRONG |
|---|---|---|
| String "hello" | `"\"hello\""` | `"hello"` (= variable name!) |
| Path | `"@\"C:\\path\""` | `"C:\\path"` |
| Interpolated | `"$\"Name: {v}\""` | `"Name: {v}"` |
| Number | `"42"` | |
| Boolean | `"true"` | `"True"` |
| Variable ref | `"myVar"` | `"\"myVar\""` |
| null | `"null"` | `"Nothing"` |

**Golden rule**: no inner quotes = variable/expression. Inner escaped quotes = string literal.

### COMMON TRAP: XPath/SearchString in edit_script

When using `edit_script` to insert or set_property for `SearchString` (XPath, CSS selectors, etc.), the value MUST have escaped quotes — it's a C# string expression, not a raw value.

```json
// WRONG — PIX interprets this as a C# expression (variable names, operators), causes "error de compilacion"
{"op": "set_property", "path": [0,1], "property": "SearchString", "value": "/html//input[@type = 'email']"}

// CORRECT — wrapped in escaped quotes, PIX treats it as a string literal
{"op": "set_property", "path": [0,1], "property": "SearchString", "value": "\"/html//input[@type = 'email']\""}
```

Same applies to `insert` operations:
```json
// WRONG
{"op": "insert", ..., "properties": {"SearchString": "/html//footer"}}

// CORRECT
{"op": "insert", ..., "properties": {"SearchString": "\"/html//footer\""}}
```

This is easy to forget because `read_script` displays XPath values WITHOUT the outer quotes (e.g., `.SearchString = /html//footer (xpath)`), but when writing back via `edit_script`, the quotes are mandatory.

---

## JSON SPEC FORMAT

```json
{
  "name": "ProjectName",
  "description": "What this does",
  "variables": [
    {"name": "excelData", "type": "System.Data.DataTable", "default": "new System.Data.DataTable()"}
  ],
  "params": [
    {"name": "in_filePath", "type": "System.String", "default": "\"\"", "description": "Excel file path", "runnerType": "File"}
  ],
  "steps": [
    {"activity": "BR.Core.Base.Comment", "text": "Initialize variables"},
    {"activity": "BR.Core.Base.Assign", "text": "Set file path", "properties": {"Value": "\"data.xlsx\"", "To": "filePath"}},
    {
      "activity": "BR.Core.Base.TryCatch", "text": "Read Excel safely",
      "children": {
        "try": [
          {"activity": "Activities.Office.Excel.ReadRange", "text": "Read all data", "properties": {"Path": "filePath", "Range": "\"A1\"", "DataTable": "excelData"}}
        ],
        "catch": {
          "properties": {"Exception": "ex"},
          "steps": [
            {"activity": "BR.Core.Base.WriteLog", "text": "Log error", "properties": {"Text": "$\"Excel error: {ex.Message}\"", "Level": "Error"}},
            {"activity": "BR.Core.Base.ThrowException", "text": "Re-throw", "properties": {"Text": "$\"Failed to read Excel: {ex.Message}\""}}
          ]
        }
      }
    }
  ]
}
```

### Variable types
| Type | Use | Default |
|------|-----|---------|
| `System.String` | Text | `"\"\""` |
| `System.Int32` | Integer | `"0"` |
| `System.Boolean` | Flag | `"false"` |
| `System.Data.DataTable` | Excel/tables | `"new System.Data.DataTable()"` |
| `System.DateTime` | Dates | `"DateTime.Now"` |
| `System.Object` | Any (avoid) | `"null"` |
| `System.Exception` | TryCatch | `"null"` |
| `System.Collections.Generic.List`1[[System.Object]]` | Lists | `"new List<object>()"` |

### Parameters (inter-script communication)
- `in_` prefix for inputs, `out_` prefix for outputs
- `runnerType`: None, File, Bool, Freeze, Directory, Hidden, DateTime
- Used with `BR.Core.Base.ExecuteScript` (see complex properties below)

### Activity modes
Some activities have modes (shown as **MODES** in search results). Set via `"option": 1` on the step.
Only set properties belonging to the selected mode (tagged `{only: ModeName}` in search output).

### Enum properties
Use ONLY the value name: `"Get"`, `"Post"`, `"Info"`, `"Error"` — NEVER `"TypeMethod.Get"`.

### Output properties
Properties marked `(OUT → assign to variable)` take a variable name: `"DataTable": "excelData"`.

---

## EDIT OPERATIONS REFERENCE

### Step operations
```json
{"op": "remove", "path": [0, 2]}
{"op": "insert", "path": [0, 1], "activity": "...", "text": "...", "properties": {...}, "children": {...}}
{"op": "replace", "path": [0, 2], "activity": "...", "text": "...", "properties": {...}}
{"op": "move", "from_path": [0, 2], "to_path": [0, 0]}
{"op": "set_property", "path": [0, 1], "property": "Value", "value": "\"new\""}
{"op": "set_text", "path": [0, 1], "text": "New label"}
{"op": "set_enabled", "path": [0, 2], "enabled": false}
{"op": "set_option", "path": [0], "option": 1}
```

### Variable/parameter operations
```json
{"op": "add_var", "name": "myVar", "type": "System.String", "default": "\"\""}
{"op": "remove_var", "name": "myVar"}
{"op": "set_var", "name": "myVar", "property": "default", "value": "\"new\""}
{"op": "add_param", "name": "in_x", "type": "System.String", "default": "\"\"", "description": "...", "runnerType": "File"}
{"op": "remove_param", "name": "in_x"}
{"op": "set_param", "name": "in_x", "property": "description", "value": "new desc"}
```

### Operation ordering (CRITICAL)

Operations execute sequentially — each shifts indices for the next.

**Required order**: remove → move → insert → set_property → set_enabled → add_var/add_param

- Inserts shift indices DOWN — never insert before a move in the same call
- Removes shift indices UP — do them first
- NEVER replace a failed move with an insert (creates duplicate, loses original)
- If too complex: split into multiple `edit_script` calls

### insert/replace with children

ALWAYS use `children` for compound steps. NEVER insert empty TryCatch/If then add children separately.

Child keys: `try`/`catch`/`finally` (TryCatch), `iftrue`/`iffalse` (If), `body` (Container/loops)

### Complex collection properties (Headers, Parameters, InitialItems)

For generation — use `complexProperties` field:
```json
{
  "activity": "Activities.HTTP.HTTPResponsesWithFile",
  "properties": {"Url": "\"https://api.example.com\"", "Method": "Post"},
  "complexProperties": {
    "Headers": [
      {"name": "Content-Type", "expression": "\"application/json\"", "type": "System.String"}
    ]
  }
}
```

For editing existing — use `items` in set_property:
```json
{"op": "set_property", "path": [0,1], "property": "Headers", "items": [
  {"name": "Accept", "expression": "\"application/json\"", "type": "System.String"}
]}
```

NEVER use string `value` for collection properties — always use `items`.

Sub-script parameter mapping via ExecuteScript:
```json
{
  "activity": "BR.Core.Base.ExecuteScript",
  "properties": {"FilePath": "\"utils_log.pix\""},
  "complexProperties": {
    "Parameters": [
      {"name": "in_filePath", "expression": "myVar", "type": "System.String"},
      {"name": "out_result", "expression": "resultVar", "type": "System.Boolean"}
    ]
  }
}
```

---

## ERROR CATALOG

| Error | Cause | Fix |
|-------|-------|-----|
| "Esta accion falta o no se puede cargar" | Wrong activity name | `search_activities` to find correct name |
| "Se ha producido un error de compilacion" | Bad C# expression | Check string quoting, variable exists, type match |
| "Step creation failed for X" | Activity not in registry | Name is wrong — search again |
| "Unknown property X for activity Y" | Wrong property name | Check `search_activities` output |
| "Requested value 'X' was not found" | Wrong enum value (e.g., "Warning" instead of "Warn") | Check enum values in `search_activities` output (shown in brackets) |
| "NullReferenceException at get_NextStep" | Parent linking broken | Use insert with children, not manual child manipulation |
| "Данный шаг не предполагает использование дочерних шагов" / index out of range on insert | Inserting as child of a step that doesn't accept children (e.g., JSONParsing, Assign, If, WriteLog) | The path `[3,0,0]` means "child 0 of child 0 of step 3" — if `[3,0]` is a leaf step (not Container/TryCatch/Loop), it can't have children. Insert at the **parent level** instead: `[3,0]` inserts as sibling before `[3,0]` inside the Container `[3]`. Rule: only Container, TryCatch (Try/Catch/Finally), If (IfTrue/IfFalse), and Loop bodies accept child inserts. |

$ARGUMENTS
