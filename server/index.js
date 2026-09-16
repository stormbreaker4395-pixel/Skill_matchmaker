import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createOpportunity,
  createStudent,
  getStudent,
  listOpportunities,
  listStudents,
  updateStudent,
} from "./db.js";
import { rankMatches } from "./matcher.js";
const __filename = fileURLToPath(import.meta.url),
  root = path.join(path.dirname(__filename), "..", "client"),
  port = Number(process.env.PORT || 4000);
function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}
function body(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}
function serveFile(req, res) {
  let requestPath = req.url.split("?")[0];
  if (requestPath === "/") requestPath = "/index.html";
  const safe = path.normalize(requestPath).replace(/^\.\.(\/|\\)/, "");
  const file = path.join(root, safe);
  if (
    !file.startsWith(root) ||
    !fs.existsSync(file) ||
    fs.statSync(file).isDirectory()
  )
    return json(res, 404, { error: "Not found" });
  const ext = path.extname(file),
    types = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
    };
  res.writeHead(200, {
    "Content-Type": types[ext] || "application/octet-stream",
  });
  fs.createReadStream(file).pipe(res);
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      if (req.method === "GET" && url.pathname === "/api/health")
        return json(res, 200, { ok: true, service: "skillbridge-api" });
      if (req.method === "GET" && url.pathname === "/api/students")
        return json(res, 200, listStudents());
      if (req.method === "GET" && url.pathname.startsWith("/api/students/")) {
        const s = getStudent(Number(url.pathname.split("/").pop()));
        return s
          ? json(res, 200, s)
          : json(res, 404, { error: "Student not found" });
      }
      if (req.method === "POST" && url.pathname === "/api/students") {
        const b = await body(req);
        return b.name
          ? json(res, 201, createStudent(b))
          : json(res, 400, { error: "Name is required" });
      }
      if (req.method === "PUT" && url.pathname.startsWith("/api/students/")) {
        const b = await body(req),
          id = Number(url.pathname.split("/").pop());
        return b.name
          ? json(res, 200, updateStudent(id, b))
          : json(res, 400, { error: "Name is required" });
      }
      if (req.method === "GET" && url.pathname === "/api/opportunities")
        return json(res, 200, listOpportunities());
      if (req.method === "POST" && url.pathname === "/api/opportunities") {
        const b = await body(req);
        if (!b.company || !b.title || !b.description)
          return json(res, 400, {
            error: "company, title and description are required",
          });
        return json(res, 201, createOpportunity(b));
      }
      if (req.method === "GET" && url.pathname.startsWith("/api/matches/")) {
        const id = Number(url.pathname.split("/").pop()),
          s = getStudent(id);
        return s
          ? json(res, 200, {
              student: s,
              matches: rankMatches(s, listOpportunities()),
            })
          : json(res, 404, { error: "Student not found" });
      }
      return json(res, 404, { error: "API route not found" });
    }
    serveFile(req, res);
  } catch (e) {
    json(res, 500, { error: "Unexpected server error", detail: e.message });
  }
});
server.listen(port, () =>
  console.log(`SkillBridge running at http://localhost:${port}`),
);
