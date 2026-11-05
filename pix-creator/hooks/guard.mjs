// Hook PreToolUse del paquete pix-creator. Equivale al arnés de protección de PIX CLI:
//  1) Bloquea Read/Edit/Write/NotebookEdit/Bash sobre .pix, .pixproj, packages.config y nuget.config
//     (XML serializado: editarlo como texto lo corrompe) -> hay que usar las herramientas MCP de PIX.
//  2) Bloquea lo mismo sobre .xlsx -> usar la herramienta `excel`.
//  3) Gate de migración UiPath: mientras haya un análisis sin aprobar, bloquea generate_project,
//     generate_script y edit_script.
// Desactivar a propósito (mantenimiento): variable de entorno PIX_CREATOR_GUARD=off
import { blockReason } from "../extras/gate.mjs";

const PIX_FILE = /\.(pix|pixproj)$|packages\.config$|nuget\.config$/i;
const XLSX_FILE = /\.xlsx$/i;
const PIX_IN_CMD = /\.(pixproj|pix)(["'\s\\/,;:)|&>]|$)|packages\.config\b|nuget\.config\b/i;
const XLSX_IN_CMD = /\.xlsx(["'\s\\/,;:)|&>]|$)/i;
const FILE_TOOLS = {
  Read: "read_script (para .pix) o read_project (para archivos del proyecto)",
  Edit: "edit_script",
  Write: "generate_project / generate_script / edit_script",
  NotebookEdit: "edit_script",
};
const GEN_TOOLS = /(^|__)(generate_project|generate_script|edit_script)$/;

const deny = (reason) => {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } }));
  process.exit(0);
};
const pixMsg = (tool, what, use) =>
  `BLOQUEADO: ${tool} no debe tocar archivos de proyecto PIX (${what}). Son XML serializado (DataContract): editarlos como texto los corrompe y leerlos en crudo gasta contexto. Usa ${use}.`;
const xlsxMsg = (tool, what) =>
  `BLOQUEADO: ${tool} no debe tocar el archivo Excel (${what}). Un .xlsx es binario (XML comprimido): leerlo en crudo gasta contexto y editarlo como texto lo corrompe. Usa la herramienta excel (op=listSheets/readSheet/readCell/writeCell/writeRange).`;

let raw = "";
for await (const c of process.stdin) raw += c;
let ev;
try { ev = JSON.parse(raw); } catch { process.exit(0); }
if (process.env.PIX_CREATOR_GUARD === "off" || ev.hook_event_name !== "PreToolUse") process.exit(0);

const tool = ev.tool_name ?? "";
const input = ev.tool_input ?? {};

if (tool === "Bash") {
  const cmd = input.command ?? "";
  const short = cmd.length > 120 ? cmd.slice(0, 120) + "…" : cmd;
  if (PIX_IN_CMD.test(cmd)) deny(pixMsg("Bash", short, "read_script / edit_script / read_project (NO uses cat/Get-Content/Set-Content sobre archivos PIX)"));
  if (XLSX_IN_CMD.test(cmd)) deny(xlsxMsg("Bash", short));
} else if (FILE_TOOLS[tool]) {
  const p = input.file_path ?? input.notebook_path ?? "";
  if (PIX_FILE.test(p)) deny(pixMsg(tool, p, FILE_TOOLS[tool]));
  if (XLSX_FILE.test(p)) deny(xlsxMsg(tool, p));
} else if (GEN_TOOLS.test(tool) && /pix/i.test(tool)) {
  const why = blockReason();
  if (why) deny(why);
}
process.exit(0);
