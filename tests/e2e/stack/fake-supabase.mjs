// Faux Supabase local pour les tests : PostgREST + stockage disque + broadcast no-op
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const SP = path.dirname(new URL(import.meta.url).pathname);
const STORE = path.join(SP, "storage");
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/rest/v1")) {
    // LATENCE_MS : un aller-retour de réseau par requête, comme entre Vercel et Supabase (65 à 180 ms mesurés), pour juger un temps d'affichage.
    if (process.env.LATENCE_MS) await new Promise((r) => setTimeout(r, Number(process.env.LATENCE_MS)));
    const target = "http://localhost:3001" + url.pathname.slice(8) + url.search;
    const chunks = []; for await (const c of req) chunks.push(c);
    const headers = { ...req.headers }; delete headers.host;
    const r = await fetch(target, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
    const h = {}; r.headers.forEach((v, k) => { if (!["content-encoding","transfer-encoding","content-length"].includes(k)) h[k] = v; });
    res.writeHead(r.status, h); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  if (url.pathname === "/realtime/v1/api/broadcast") {
    let b = ""; for await (const c of req) b += c; console.log("BROADCAST", b); res.writeHead(202); res.end(); return;
  }
  const up = url.pathname.match(/^\/storage\/v1\/object\/(public\/)?(.+)$/);
  if (up) {
    const file = path.join(STORE, decodeURIComponent(up[2]));
    if (req.method === "GET") { if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); } res.writeHead(200, {"content-type":"image/jpeg"}); return res.end(fs.readFileSync(file)); }
    if (req.method === "DELETE") { try{fs.unlinkSync(file);}catch{} res.writeHead(200,{"content-type":"application/json"}); return res.end("[]"); }
    const chunks = []; for await (const c of req) chunks.push(c);
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.concat(chunks));
    console.log("UPLOAD", file, req.headers["content-type"]);
    res.writeHead(200, {"content-type":"application/json"}); return res.end(JSON.stringify({ Key: up[2], Id: "x" }));
  }
  if (url.pathname === "/storage/v1/object" && req.method === "DELETE") {
    let b = ""; for await (const c of req) b += c; console.log("DELETE", b);
    for (const p of JSON.parse(b).prefixes || []) { try { fs.unlinkSync(path.join(STORE, "recipe-photos", p)); } catch {} }
    res.writeHead(200,{"content-type":"application/json"}); return res.end("[]");
  }
  console.log("404", req.method, url.pathname); res.writeHead(404); res.end();
}).listen(54321, () => console.log("fake supabase on 54321"));
