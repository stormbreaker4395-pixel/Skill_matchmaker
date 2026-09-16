import fs from "node:fs";
import path from "node:path";

export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

export function setCors(res, origin, allowedOrigins) {
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Local-User, X-Local-Role");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
}

export function json(res, status, data, origin, allowedOrigins) {
  setCors(res, origin, allowedOrigins);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

export function readJsonBody(req, maxBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let settled = false;
    const fail = (error) => { if (settled) return; settled = true; req.resume(); reject(error); };
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) fail(new HttpError(413, "Request body too large"));
      else chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new HttpError(400, "Invalid JSON body")); }
    });
    req.on("error", (error) => fail(error));
  });
}

export function serveStatic(req, res, root, origin, allowedOrigins) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); } catch { return json(res, 400, { error: "Invalid path" }, origin, allowedOrigins); }
  let requested;
  if (pathname === "/" || pathname === "/index.html") requested = path.join(root, "index.html");
  else if (pathname === "/shared/constants.js") requested = path.join(root, "..", "shared", "constants.js");
  else if (pathname.startsWith("/")) requested = path.join(root, pathname.slice(1));
  else requested = path.join(root, pathname);
  const resolved = path.resolve(requested);
  const allowedRoot = path.resolve(root);
  const allowedShared = path.resolve(root, "..", "shared");
  if (!resolved.startsWith(allowedRoot) && !resolved.startsWith(allowedShared)) return json(res, 403, { error: "Forbidden" }, origin, allowedOrigins);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return json(res, 404, { error: "Not found" }, origin, allowedOrigins);
  const ext = path.extname(resolved).toLowerCase();
  const type = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" }[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": process.env.NODE_ENV === "production" ? "public, max-age=3600" : "no-store" });
  res.end(fs.readFileSync(resolved));
}
