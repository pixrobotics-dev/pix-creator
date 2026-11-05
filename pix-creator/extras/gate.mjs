// Estado compartido del "gate" de migración entre el servidor MCP (extras) y el hook (hooks/guard.mjs).
// Mismo comportamiento que el CLI de PIX: tras analizar un proyecto UiPath, generar/editar queda
// bloqueado hasta que el usuario apruebe la migración.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DIR = process.env.PIX_CREATOR_STATE_DIR || path.join(os.homedir(), ".pix-creator");
const FILE = path.join(DIR, "gate.json");

export function readGate() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { pending: null, approved: false };
  }
}

function write(state) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}

/** Se llama tras un análisis correcto: cierra el gate. */
export function openAnalysis(analyzedPath) {
  write({ pending: analyzedPath, approved: false, at: new Date().toISOString() });
}

/** El usuario aprobó (true) o canceló (false) la migración. */
export function resolveGate(approved) {
  write(approved ? { ...readGate(), approved: true, resolvedAt: new Date().toISOString() } : { pending: null, approved: false });
}

/** Devuelve null si se puede generar/editar, o el motivo del bloqueo. */
export function blockReason() {
  const g = readGate();
  if (!g.pending || g.approved) return null;
  return (
    `BLOQUEADO por el gate de migración: hay un análisis de UiPath sin aprobar (${g.pending}). ` +
    `El usuario todavía no vio qué vas a hacer. Antes de generar o editar: 1) cuéntale en texto qué encontró el análisis ` +
    `(pasos directos, pasos a armar con varios pasos de PIX, sin equivalente, expresiones VisualBasic); ` +
    `2) di qué scripts vas a crear y en qué carpeta; 3) pídele la aprobación con AskUserQuestion; ` +
    `4) solo si elige migrar, llama a approve_migration (decision="aprobar"), que le mostrará su propio panel de permiso. ` +
    `No reintentes la generación sin resolver esto.`
  );
}
