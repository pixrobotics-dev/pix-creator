# PIX RPA - Lineamientos de Desarrollo

Guia de estilo y buenas practicas para scripts PIX (.pix) del equipo de desarrollo.

---

## 1. Comentarios como Cabeceras de Seccion

Usar `CommentStep` como separadores visuales para delimitar bloques logicos del script.

**Formato**: `=== NOMBRE DE LA SECCION ===`

```
=== Abrir pagina DIAN con AuthToken ===
=== Navegar a Export y verificar 'Descargar listados' ===
=== Insertar rango de fechas (01 del mes actual hasta hoy) ===
=== API FASE 1: Obtener AuthToken DIAN para la empresa ===
```

**Reglas**:
- Colocar ANTES del bloque logico que describen (Container, TryCatch, o grupo de pasos)
- Usar triple `===` como delimitador visual
- Ser descriptivos: incluir QUE hace la seccion, no solo el nombre tecnico
- En scripts largos, cada fase o etapa debe tener su cabecera

---

## 2. Texto Descriptivo en Steps (DisplayText)

Cada step debe tener un `text` (DisplayText) que explique su proposito en lenguaje humano.

**Bueno**:
```
"Construir URL del endpoint get_dian_auth_token"
"Esperar span 'Sistema de factura electronica'"
"Lanzar excepcion: pagina DIAN no cargo"
```

**Malo**:
```
"Assign1"
"If1"
"TryCatch"
```

**Reglas**:
- Verbos en infinitivo: Construir, Esperar, Lanzar, Navegar, Escribir, Inicializar
- Para If: formular como pregunta → `"Hubo error HTTP runtime?"`, `"Token encontrado?"`, `"Se agotaron los intentos?"`
- Para TryCatch: indicar que protege → `"TryCatch - Abrir Chrome y verificar pagina DIAN"`
- Para Assign: indicar que se asigna → `"Marcar token como encontrado"`, `"Incrementar retry"`
- Para ExecuteScript: `"Ejecutar el script NombreScript"`

---

## 3. Logging (WriteLog)

### 3.1 Log de Inicio y Fin de Script

Todo script debe tener un WriteLog al inicio y al final:

```
[Inicio] "Inicio del procesamiento para empresa {TransactionItem["razon_social"]}"
[Fin]    "Fin del tratamiento de datos para trabajar."
```

### 3.2 Niveles de Log

| Nivel   | Uso                                                    | Ejemplo                                                    |
|---------|--------------------------------------------------------|------------------------------------------------------------|
| `Info`  | Flujo normal, confirmaciones, inicio/fin               | `"Pagina DIAN cargada correctamente para empresa {name}"`  |
| `Warn`  | Reintentos, situaciones recuperables                   | `"Token no encontrado (intento {n}/{max}). Esperando 10s"` |
| `Error` | Errores capturados en Catch                            | `"Error al abrir pagina DIAN: {ex.Message}"`               |

### 3.3 Contenido del Log

- Incluir **contexto** relevante: nombre de empresa, numero de intento, ID, URL
- Usar **string interpolation**: `$"Transaccion #{n}: {empresa} (NIT: {nit})"`
- En reintentos: mostrar `intento/maxIntentos`
- En errores: incluir `ex.Message`

```csharp
// Bueno - contexto completo
$"POST {requestUrl} | empresa_id: {TransactionItem["empresa_id"]}"
$"Token no encontrado (intento {retryCount}/{maxRetries}). auto_auth activo, esperando 10s..."
$"Error en intento {retryCount + 1} de get_dian_auth_token: {httpException.Message}"

// Malo - sin contexto
"Haciendo POST"
"Reintentando..."
"Error en request"
```

---

## 4. Manejo de Errores (TryCatch)

### 4.1 Un TryCatch por Fase

Separar cada fase critica en su propio TryCatch con mensajes especificos:

```
TryCatch 1: Abrir Chrome y verificar pagina DIAN
  → Error: "No se pudo cargar la pagina DIAN para empresa {name}: {ex.Message}"

TryCatch 2: Navegar a Export y verificar carga
  → Error: "No se pudo cargar pagina Export para empresa {name}: {ex.Message}"
```

**NO** meter todo en un solo TryCatch con un mensaje generico.

### 4.2 Estructura del Catch

1. `WriteLog` nivel Error con detalle
2. `ThrowException` con mensaje descriptivo (si debe propagarse al main)
3. O logica de retry si es recuperable

### 4.3 Reintentos (Retry Pattern)

```
Variables: tokenFound (bool), retryCount (int), maxRetries (int)
LoopWhile: !tokenFound && retryCount < maxRetries
  TryCatch:
    Try: operacion + verificacion
    Catch: log error + incrementar retry + sleep
```

- Definir `maxRetries` como variable (no hardcoded en la condicion)
- Log de cada intento con `{retryCount}/{maxRetries}`
- Sleep entre reintentos (tipicamente 10s)
- ThrowException al agotar reintentos

---

## 5. Variables

### 5.1 Nomenclatura

- **camelCase**: `requestUrl`, `postBody`, `responseContent`, `tokenFound`
- **Descriptivas**: el nombre debe indicar que contiene
- **Prefijos comunes**:
  - `http*`: relacionadas con requests (`httpStatus`, `httpException`)
  - `json*`: resultados de parsing (`jsonResult`)
  - `is*/has*` o descriptivo booleano: `tokenFound`, `pageLoaded`
  - `max*`: limites (`maxRetries`)
  - `retry*`: contadores de reintentos (`retryCount`)

### 5.2 Inicializacion

Siempre inicializar variables con valores por defecto:

| Tipo      | Default                                    |
|-----------|--------------------------------------------|
| String    | `""`                                       |
| Int32     | `0`                                        |
| Boolean   | `false`                                    |
| Exception | `null`                                     |
| List      | `new List<object>()`                       |
| Dictionary| `default(Dictionary<string,object>)`       |

---

## 6. Parametros (Inter-Script)

### 6.1 Nomenclatura

Los parametros deben coincidir con el nombre de la variable del script padre:

```
main.pix:        Config, TransactionItem, TransactionData
GetEmpresas.pix: Config (in), TransactionData (out)
GetDianAuth.pix: Config (in), TransactionItem (in/out)
```

Esto facilita el mapeo en ExecuteScript.

### 6.2 Documentacion

Cada parametro debe tener `Description` indicando su proposito y direccion:

```
Config          → "Diccionario de configuracion del proyecto"
TransactionItem → "Empresa actual con datos y authTokenUrl"
TransactionData → "Lista de empresas activas filtradas"
```

---

## 7. Estructura de Scripts

### 7.1 Agrupacion con Containers

Agrupar pasos relacionados en Containers con nombre descriptivo:

```
[Container] Preparar Request HTTP POST
  Assign: URL
  Assign: Body
  WriteLog: Request info

[Container] Ejecutar POST con retry
  Assign: init variables
  LoopWhile: retry logic
```

### 7.2 Orden del Script

1. WriteLog inicio
2. Comentario cabecera de seccion
3. Logica del script (Containers, TryCatch, etc.)
4. WriteLog fin

### 7.3 Validaciones Web

Al interactuar con paginas web, siempre verificar que la pagina cargo:

```
LaunchChrome / NavigateURL
  → WaitForWebElement (elemento clave de la pagina, timeout 30s)
  → WriteLog confirmacion
```

---

## 8. REFramework - Reglas del Main

| Bloque  | Responsabilidad                                       |
|---------|-------------------------------------------------------|
| INIT    | ReadConfig, APIs de inicializacion, InitApplications  |
| GET     | GetTransactionItem (siguiente empresa de la lista)    |
| PROCESO | APIs por transaccion + ProcessTransactionItem + Status |
| END     | CloseApplications / KillApplications                  |

- Logica que solo debe ejecutarse una vez → dentro de `If Config is null` en INIT
- Logica que se ejecuta por cada empresa → en PROCESO
- SystemException → GoTo INIT (reintentar)
- BusinessException → GoTo GET (siguiente transaccion)

---

## 9. Ejemplo de Referencia

Ver [`ProcessTransactionItem.pix`](ProcessTransactionItem.pix) en esta misma carpeta como ejemplo completo que aplica todos los lineamientos:

```
ProcessTransactionItem.pix
├── WriteLog inicio (con contexto de empresa)
├── Comment: === Abrir pagina DIAN con AuthToken ===
├── TryCatch 1 - Abrir Chrome y verificar pagina DIAN
│   ├── Try:
│   │   ├── LaunchChrome (authTokenUrl desde TransactionItem)
│   │   ├── WaitForWebElement (XPath span DIAN, timeout 30s)
│   │   └── WriteLog Info: confirmacion
│   └── Catch:
│       ├── WriteLog Error: detalle con ex.Message
│       └── ThrowException: mensaje especifico de fase
├── Comment: === Navegar a Export y verificar 'Descargar listados' ===
├── TryCatch 2 - Navegar a Export y verificar carga
│   ├── Try:
│   │   ├── NavigateURL (ExportUrl desde Config)
│   │   ├── WaitForWebElement (XPath p.title, timeout 30s)
│   │   ├── WriteLog Info: confirmacion
│   │   ├── Comment: === Insertar rango de fechas ===
│   │   └── SendKeysInElement (#export-range, fechas dinamicas)
│   └── Catch:
│       ├── WriteLog Error: detalle con ex.Message
│       └── ThrowException: mensaje especifico de fase
└── WriteLog fin
```

**Puntos clave del ejemplo**:
- Cabeceras `===` antes de cada fase
- Un TryCatch por fase con mensajes de error diferenciados
- Logs Info/Error en los puntos correctos
- Variables camelCase (`browser`, `ex`)
- Parametros con nombres del script padre (`TransactionItem`, `Config`)
- Validacion web: WaitForWebElement despues de cada navegacion
- Contexto en cada log: `{TransactionItem["razon_social"]}`