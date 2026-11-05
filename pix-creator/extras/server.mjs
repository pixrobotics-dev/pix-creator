// Servidor MCP (stdio) con las herramientas de PIX CLI que NO están en pix_genMCP.exe:
//   capture_selector  - selector de elementos de PIX (PIX.Recorder.Desktop.exe)
//   excel             - leer/escribir .xlsx preservando formato (xlsx-populate)
//   analyze_uipath    - análisis de migración UiPath -> PIX (pix_converter.exe)
//   approve_migration - abre/cierra el gate de migración (el usuario aprueba en su panel de permisos)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XlsxPopulate from "xlsx-populate";
import { runPicker, parseXPathSettings } from "./capture.mjs";
import { openAnalysis, resolveGate, readGate } from "./gate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(HERE, "..");
const CONVERTER = process.env.PIX_CONVERTER_EXE || path.join(PLUGIN_ROOT, "backend", "pix_converter.exe");
const RECORDER = process.env.PIX_RECORDER_EXE || "C:\\Program Files\\PIX\\PIX.Recorder.Desktop.exe";

const text = (t) => ({ content: [{ type: "text", text: t }] });
const fail = (t) => ({ content: [{ type: "text", text: t }], isError: true });

/* ------------------------------------------------------------------ excel */
const LOCK_CODES = new Set(["EBUSY", "EPERM", "EACCES", "ETXTBSY"]);
const isLock = (e) => !!e && typeof e === "object" && LOCK_CODES.has(e.code ?? "");
const lockedMsg = (p) =>
  `El archivo Excel está bloqueado (probablemente abierto en Microsoft Excel) y no se puede escribir:\n  ${p}\n` +
  `Pídele al usuario que lo cierre (guardando antes sus cambios), espera 1-2 segundos y reintenta. No inventes ni asumes los datos.`;

async function isLocked(p) {
  let fh;
  try {
    fh = await fs.promises.open(p, "r+");
    return false;
  } catch (e) {
    if (isLock(e)) return true;
    if (e.code === "ENOENT") return false;
    throw e;
  } finally {
    try { await fh?.close(); } catch {}
  }
}

const norm = (v) => (v == null ? null : ["string", "number", "boolean"].includes(typeof v) ? v : String(v));
function toRows(v) {
  if (v == null) return [];
  if (!Array.isArray(v)) return [[norm(v)]];
  if (v.length > 0 && !Array.isArray(v[0])) return [v.map(norm)];
  return v.map((r) => (Array.isArray(r) ? r.map(norm) : [norm(r)]));
}
function trimRows(rows) {
  let maxCol = -1;
  for (const r of rows) for (let c = r.length - 1; c >= 0; c--) if (r[c] !== null && r[c] !== "") { if (c > maxCol) maxCol = c; break; }
  const cut = rows.map((r) => r.slice(0, maxCol + 1));
  let last = cut.length - 1;
  while (last >= 0 && cut[last].every((x) => x === null || x === "")) last--;
  return cut.slice(0, last + 1);
}
const sheetOf = (wb, name) => {
  const s = name != null ? wb.sheet(name) : wb.sheets()[0];
  if (!s) throw new Error(`No existe la hoja '${name}' en el archivo.`);
  return s;
};
async function saveAtomic(wb, p) {
  if (await isLocked(p)) throw new Error(lockedMsg(p));
  const buf = await wb.outputAsync();
  const tmp = path.join(path.dirname(p), `.${path.basename(p)}.${process.pid}.${Date.now()}.tmp`);
  let last;
  for (let i = 0; i <= 3; i++) {
    try {
      await fs.promises.writeFile(tmp, Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
      await fs.promises.rename(tmp, p);
      return;
    } catch (e) {
      last = e;
      await fs.promises.rm(tmp, { force: true }).catch(() => {});
      if (!isLock(e) || i === 3) break;
      await new Promise((r) => setTimeout(r, 250 * 2 ** i));
    }
  }
  throw isLock(last) ? new Error(lockedMsg(p)) : last;
}

/* ---------------------------------------------------------------- converter */
function runConverter(target) {
  return new Promise((resolve) => {
    const child = spawn(CONVERTER, ["analyze", "--report", "agent", target], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => resolve({ code: -1, out, err: e.message }));
    child.on("close", (code) => resolve({ code, out, err }));
  });
}

/* ------------------------------------------------------------------- server */
const server = new McpServer({ name: "pix-extras", version: "0.1.0" });

const cellVal = z.union([z.string(), z.number(), z.boolean(), z.null()]);
server.registerTool(
  "excel",
  {
    description:
      "Leer/escribir un archivo Excel (.xlsx) — p.ej. el Config.xlsx de un proyecto PIX — preservando formato, fórmulas, validaciones (dropdowns) y demás hojas. " +
      "Operaciones (op): listSheets | readSheet | readCell | writeCell | writeRange. Si el desarrollador tiene el Excel ABIERTO, las escrituras NO se hacen y devuelve un mensaje accionable: " +
      "pídele que lo cierre y reintenta — nunca inventes ni asumas los datos del config. Usa SIEMPRE esta herramienta para .xlsx (nunca Read/Bash).",
    inputSchema: {
      op: z.enum(["listSheets", "readSheet", "readCell", "writeCell", "writeRange"]),
      path: z.string().describe("Ruta absoluta al .xlsx."),
      sheet: z.string().optional().describe("Nombre de la hoja (default: la primera)."),
      addr: z.string().optional().describe('Dirección A1, ej "B2" (celda, o inicio para writeRange).'),
      range: z.string().optional().describe('Rango A1, ej "A1:C20" (para readSheet acotado).'),
      maxRows: z.number().int().positive().optional().describe("Cap de filas en readSheet."),
      value: cellVal.optional(),
      values: z.array(z.array(cellVal)).optional().describe("Matriz de filas para writeRange."),
    },
  },
  async (a) => {
    try {
      switch (a.op) {
        case "listSheets": {
          const wb = await XlsxPopulate.fromFileAsync(a.path);
          return text(JSON.stringify(wb.sheets().map((s) => s.name())));
        }
        case "readSheet": {
          const wb = await XlsxPopulate.fromFileAsync(a.path);
          const s = sheetOf(wb, a.sheet);
          let rows = trimRows(toRows(a.range ? s.range(a.range).value() : s.usedRange()?.value()));
          if (a.maxRows && rows.length > a.maxRows) rows = rows.slice(0, a.maxRows);
          return text(JSON.stringify({ sheet: s.name(), rows }, null, 2));
        }
        case "readCell": {
          if (!a.sheet || !a.addr) return fail("readCell requiere 'sheet' y 'addr'.");
          const wb = await XlsxPopulate.fromFileAsync(a.path);
          const c = sheetOf(wb, a.sheet).cell(a.addr);
          const f = c.formula();
          return text(JSON.stringify({ value: norm(c.value()), ...(f ? { formula: f } : {}) }));
        }
        case "writeCell": {
          if (!a.sheet || !a.addr) return fail("writeCell requiere 'sheet', 'addr' y 'value'.");
          if (await isLocked(a.path)) return fail(lockedMsg(a.path));
          const wb = await XlsxPopulate.fromFileAsync(a.path);
          sheetOf(wb, a.sheet).cell(a.addr).value(a.value ?? null);
          await saveAtomic(wb, a.path);
          return text(`OK: ${a.sheet}!${a.addr} = ${JSON.stringify(a.value ?? null)}`);
        }
        case "writeRange": {
          if (!a.sheet || !a.addr || !a.values) return fail("writeRange requiere 'sheet', 'addr' (inicio) y 'values'.");
          if (await isLocked(a.path)) return fail(lockedMsg(a.path));
          const wb = await XlsxPopulate.fromFileAsync(a.path);
          const start = sheetOf(wb, a.sheet).cell(a.addr);
          a.values.forEach((row, i) => (row ?? []).forEach((v, j) => start.relativeCell(i, j).value(v ?? null)));
          await saveAtomic(wb, a.path);
          return text(`OK: ${a.values.length} fila(s) escritas desde ${a.sheet}!${a.addr}`);
        }
      }
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
);

server.registerTool(
  "capture_selector",
  {
    description:
      "Abre el selector de elementos de PIX para que el USUARIO señale un elemento web o de escritorio. Devuelve etiqueta, atributos de cada nodo ancestro, ruta posicional, XPaths candidatos y notas — " +
      "NO un selector final: tú eliges el XPath más ROBUSTO (ver la skill pix-selectores) y lo escribes en SearchString del paso con SearchBy=XPath. " +
      "NO abre ni navega a la página/app: antes pídele al usuario que deje el elemento visible y espera su 'ok'. Dile que pase el mouse hasta que el elemento se resalte en naranja y haga un clic. " +
      "mode='web' para navegador, 'desktop' para ventanas nativas. Requiere PIX Studio instalado (PIX.Recorder.Desktop.exe).",
    inputSchema: {
      mode: z.enum(["web", "desktop"]).describe("web = elemento en un navegador; desktop = ventana nativa."),
      timeoutSeconds: z.number().int().positive().optional().describe("Cuánto esperar a que el usuario elija (default 120)."),
    },
  },
  async ({ mode, timeoutSeconds }) => {
    if (!fs.existsSync(RECORDER)) return fail("No se encontró el recorder de PIX (PIX.Recorder.Desktop.exe). Instala PIX Studio o define PIX_RECORDER_EXE con su ruta.");
    const options = JSON.stringify({
      startupAppMode: 2,
      startupRecorderPickerMode: mode === "desktop" ? 1 : 2,
      rootElementOnly: false,
      uiCultureOverride: "es-ES",
      scriptVariableNames: [],
      reverseXPathNodes: false,
      autoReduceXPath: false,
    });
    const r = await runPicker(RECORDER, ["run", "--options", options], (timeoutSeconds ?? 120) * 1000);
    if ("reason" in r) {
      if (r.reason === "cancelled")
        return text("El usuario canceló la selección (Esc o cerró el señalador) sin elegir un elemento. No se capturó ningún selector. Pregúntale si quiere reintentar (que deje el elemento a la vista y avise), o cómo prefiere seguir. No inventes un selector.");
      if (r.reason === "timeout") return fail("Se agotó el tiempo de espera para seleccionar el elemento.");
      return fail(`No se pudo capturar el elemento: ${r.message}`);
    }
    try {
      const parsed = parseXPathSettings(r.xml);
      if (parsed.nodes.length === 0) return text("No se detectó un elemento válido en la selección. No se capturó ningún selector.");
      return text(JSON.stringify({ ok: true, mode, ...parsed }, null, 2));
    } catch (e) {
      return fail(`No se pudo parsear el XPathSettings: ${e instanceof Error ? e.message : String(e)}`);
    }
  },
);

server.registerTool(
  "analyze_uipath",
  {
    description:
      "Analiza un proyecto de UiPath (.xaml) y devuelve, por actividad, a qué actividad de PIX va y qué propiedades se mapean, agrupado por lo que hay que hacer: lo directo, lo que hay que armar multi-paso, " +
      "lo que necesita una decisión del usuario y lo que no tiene equivalente. Úsala SIEMPRE antes de migrar. Cierra el gate de migración: generar/editar queda bloqueado hasta que el usuario apruebe (ver skill pix-migracion-uipath).",
    inputSchema: { uipathPath: z.string().describe("Carpeta del proyecto UiPath, o un .xaml, o su project.json.") },
  },
  async ({ uipathPath }) => {
    const p = path.resolve(uipathPath);
    if (!fs.existsSync(p)) return fail(`No existe «${p}». Pídele al usuario la carpeta del proyecto UiPath (la que tiene project.json y los .xaml).`);
    if (!fs.existsSync(CONVERTER)) return fail(`No se encontró pix_converter.exe en ${CONVERTER}.`);
    const r = await runConverter(p);
    if ([2, 3, 70].includes(r.code) || r.code < 0 || r.out.trim().length === 0)
      return fail("El analizador no pudo leer el proyecto:\n" + (r.out.trim() || r.err.split("\n").filter((l) => !l.startsWith("ActivityRegistry:")).join("\n").trim() || `exit code ${r.code}`));
    openAnalysis(p);
    return text(
      r.out +
        "\n\n--- SIGUIENTE PASO (obligatorio) ---\nNo generes todavía. Cuéntale al usuario lo que dice este análisis, di concretamente qué vas a crear y dónde, " +
        "y pídele la aprobación con AskUserQuestion. Solo si elige migrar, llama a approve_migration. Generar y editar están bloqueados hasta entonces.",
    );
  },
);

server.registerTool(
  "approve_migration",
  {
    description:
      "Resuelve el gate de migración UiPath→PIX. decision='aprobar' desbloquea generate_project/generate_script/edit_script; decision='cancelar' descarta el análisis. " +
      "Llámala SOLO después de que el usuario haya elegido explícitamente migrar en tu pregunta; esta herramienta le pedirá su propio permiso y nunca debe estar en una lista de permitidos automáticos.",
    inputSchema: { decision: z.enum(["aprobar", "cancelar"]) },
  },
  async ({ decision }) => {
    const g = readGate();
    if (!g.pending) return text("No hay ningún análisis de migración pendiente; el gate ya está abierto.");
    resolveGate(decision === "aprobar");
    return text(decision === "aprobar" ? `Migración aprobada (${g.pending}). Ya puedes generar y editar con el ciclo normal: search_activities → generate → verify_script.` : "Análisis descartado; el gate quedó cerrado sin migración.");
  },
);

await server.connect(new StdioServerTransport());
