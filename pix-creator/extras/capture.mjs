// Captura de selectores: protocolo del PIX.Recorder.Desktop.exe (JSON-RPC con frames de 4 bytes big-endian)
// y conversión del XPathSettings (XML) a datos estructurados. Portado del CLI de PIX.
import { spawn } from "node:child_process";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";

/* --------------------------------------------------------- capture_selector */
const asArray = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const str = (x) => (typeof x === "string" ? x : "");

function findXPathSettings(o) {
  if (o && typeof o === "object") {
    if (Array.isArray(o)) { for (const i of o) { const r = findXPathSettings(i); if (r) return r; } return null; }
    for (const [k, v] of Object.entries(o)) {
      if (k === "XPathSettings" && typeof v === "string") return v;
      const r = findXPathSettings(v);
      if (r) return r;
    }
  }
  return null;
}
const looksGenerated = (id) => {
  if (id.length < 4 || id.length > 16) return id.length < 4;
  return /[A-Z]/.test(id) && /[a-z]/.test(id) && /\d/.test(id) && !id.includes("-") && !id.includes("_");
};
const positional = (nodes) => (nodes.length === 0 ? "//*" : nodes.map((n) => `/${n.tag === "*" ? "*" : n.tag}${n.position != null ? `[${n.position}]` : ""}`).join(""));

export function parseXPathSettings(xml) {
  const root = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, trimValues: true }).parse(xml)?.XPathSettings ?? {};
  const nodes = asArray(root?.Nodes?.list?.XPathNode).map((n) => {
    const tag = str(n.Name) || "*";
    const enabled = str(n.IsEnabled).toLowerCase() === "true";
    let position = null;
    const attributes = [];
    for (const a of asArray(n.Attributes?.list?.XPathAttribute)) {
      const name = str(a["@_name"] ?? a._name);
      let value = str(a.Value) || null;
      if (value && value.length >= 2 && value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      const en = str(a.IsEnabled).toLowerCase() === "true";
      const isPos = str(a.IsPositionAttribute).toLowerCase() === "true";
      const operator = str(a.Operator) || "Equal";
      if (isPos) { if (en && value && /^\d+$/.test(value)) position = parseInt(value, 10); }
      else if (name) attributes.push({ name, value, enabled: en, operator });
    }
    return { tag, enabled, position, attributes };
  });
  const enabledNodes = nodes.filter((n) => n.enabled);
  const leafNode = enabledNodes[enabledNodes.length - 1] ?? nodes[nodes.length - 1];
  const attrs = leafNode?.attributes ?? [];
  const get = (k) => attrs.find((a) => a.name.toLowerCase() === k)?.value ?? null;
  const id = get("id");
  const leaf = { tag: leafNode?.tag ?? "*", id, class: get("class"), name: get("name"), attributes: Object.fromEntries(attrs.map((a) => [a.name, a.value])) };
  const cand = [];
  if (id) cand.push(`//${leaf.tag}[@id='${id}']`, `//*[@id='${id}']`);
  for (const a of attrs) if (a.enabled && a.name.toLowerCase() !== "id" && a.value) cand.push(`//${leaf.tag}[@${a.name}='${a.value}']`);
  cand.push(positional(enabledNodes));
  const notes = [];
  if (id) { if (looksGenerated(id)) notes.push(`El id '${id}' parece autogenerado/inestable; prefiere texto, aria-label u otro atributo semántico si existe.`); }
  else notes.push("El elemento no tiene id; considera texto/atributos estables o el path posicional.");
  if (enabledNodes.length > 6) notes.push("Path profundo: un XPath absoluto será frágil ante cambios de layout.");
  return { nodes, leaf, candidateXPaths: [...new Set(cand)], notes };
}

export function runPicker(exe, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(exe, args, { stdio: ["pipe", "pipe", "pipe"], cwd: path.dirname(exe), windowsHide: false });
    let done = false;
    const finish = (r) => { if (done) return; done = true; clearTimeout(timer); try { child.kill(); } catch {} resolve(r); };
    const timer = setTimeout(() => finish({ reason: "timeout" }), timeoutMs);
    const send = (s) => {
      const b = Buffer.from(s, "utf8"); const h = Buffer.alloc(4); h.writeUInt32BE(b.length, 0);
      try { child.stdin.write(Buffer.concat([h, b])); } catch {}
    };
    let buf = Buffer.alloc(0);
    child.stdout.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 4) {
        const len = buf.readUInt32BE(0);
        if (len <= 0 || len > 1e8) return finish({ reason: "error", message: `frame inválido (len=${len})` });
        if (buf.length < 4 + len) break;
        const msg = buf.subarray(4, 4 + len).toString("utf8");
        buf = buf.subarray(4 + len);
        let j; try { j = JSON.parse(msg); } catch { continue; }
        if (j.id !== undefined && typeof j.method === "string") {
          const idr = typeof j.id === "number" ? String(j.id) : JSON.stringify(j.id);
          send(`{"jsonrpc":"2.0","id":${idr},"result":null}`);
          if (j.method.includes("Picker") || j.method.includes("Recorder")) {
            const xml = findXPathSettings(j);
            if (xml) finish({ xml });
          }
        }
      }
    });
    child.on("error", (e) => finish({ reason: "error", message: e.message }));
    child.on("close", () => finish({ reason: "cancelled" }));
  });
}

