import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { firebaseAuth } from "./firebase-admin.js";

import {
  createOpportunity,
  createStudent,
  getOpportunity,
  getStudent,
  listOpportunities,
  listStudents,
  seedDatabase,
  updateStudent,
} from "./db.js";

import { connectMongo } from "./mongodb.js";
import { rankMatches } from "./matcher.js";

const __filename = fileURLToPath(import.meta.url);
const root = path.join(path.dirname(__filename), "..", "client");

const port = Number(process.env.PORT || 4000);

const frontendUrl =
  process.env.FRONTEND_URL || "http://localhost:5173";

// ============================================================
// CORS
// ============================================================

function setCors(res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    frontendUrl,
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,OPTIONS",
  );
}

// ============================================================
// JSON RESPONSE
// ============================================================

function json(res, status, payload) {
  const responseBody = JSON.stringify(payload);

  setCors(res);

  res.writeHead(status, {
    "Content-Type":
      "application/json; charset=utf-8",

    "Cache-Control": "no-store",
  });

  res.end(responseBody);
}

// ============================================================
// REQUEST BODY
// ============================================================

function body(req) {
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", (chunk) => {
      data += chunk;
    });

    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

// ============================================================
// FIREBASE AUTHENTICATION
// ============================================================

async function requireAuth(req, res) {
  const authorization =
    req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    json(res, 401, {
      error: "Authentication required",
    });

    return null;
  }

  const idToken =
    authorization.slice("Bearer ".length);

  try {
    const decodedToken =
      await firebaseAuth.verifyIdToken(idToken);

    return decodedToken;
  } catch (error) {
    console.error(
      "Firebase token verification failed:",
      error,
    );

    json(res, 401, {
      error:
        "Invalid or expired authentication token",
    });

    return null;
  }
}

// ============================================================
// STATIC FILE SERVER
// ============================================================

function serveFile(req, res) {
  let requestPath =
    req.url.split("?")[0];

  if (requestPath === "/") {
    requestPath = "/index.html";
  }

  const safe = path
    .normalize(requestPath)
    .replace(/^(\.\.(\/|\\))+/, "");

  const file = path.join(root, safe);

  if (
    !file.startsWith(root) ||
    !fs.existsSync(file) ||
    fs.statSync(file).isDirectory()
  ) {
    return json(res, 404, {
      error: "Not found",
    });
  }

  const ext = path.extname(file);

  const types = {
    ".html":
      "text/html; charset=utf-8",

    ".js":
      "text/javascript; charset=utf-8",

    ".css":
      "text/css; charset=utf-8",
  };

  setCors(res);

  res.writeHead(200, {
    "Content-Type":
      types[ext] ||
      "application/octet-stream",
  });

  fs.createReadStream(file).pipe(res);
}

// ============================================================
// SERVER
// ============================================================

const server = http.createServer(
  async (req, res) => {
    try {
      // --------------------------------------------------------
      // CORS PREFLIGHT
      // --------------------------------------------------------

      if (req.method === "OPTIONS") {
        setCors(res);
        res.writeHead(204);
        return res.end();
      }

      const url = new URL(
        req.url,
        `http://${req.headers.host}`,
      );

      // --------------------------------------------------------
      // API
      // --------------------------------------------------------

      if (url.pathname.startsWith("/api/")) {

        // ------------------------------------------------------
        // PUBLIC HEALTH CHECK
        // ------------------------------------------------------

        if (
          req.method === "GET" &&
          url.pathname === "/api/health"
        ) {
          return json(res, 200, {
            ok: true,
            service: "skillbridge-api",
          });
        }

        // ------------------------------------------------------
        // EVERYTHING ELSE REQUIRES FIREBASE AUTH
        // ------------------------------------------------------

        const user =
          await requireAuth(req, res);

        if (!user) {
          return;
        }

        // ------------------------------------------------------
        // STUDENTS
        // ------------------------------------------------------

        if (
          req.method === "GET" &&
          url.pathname === "/api/students"
        ) {
          return json(
            res,
            200,
            await listStudents(),
          );
        }

        // ------------------------------------------------------
        // GET STUDENT
        // ------------------------------------------------------

        if (
          req.method === "GET" &&
          url.pathname.startsWith(
            "/api/students/",
          )
        ) {
          const id = Number(
            url.pathname
              .split("/")
              .pop(),
          );

          const student =
            await getStudent(id);

          return student
            ? json(res, 200, student)
            : json(res, 404, {
                error:
                  "Student not found",
              });
        }

        // ------------------------------------------------------
        // CREATE STUDENT
        // ------------------------------------------------------

        if (
          req.method === "POST" &&
          url.pathname === "/api/students"
        ) {
          const data =
            await body(req);

          return data.name
            ? json(
                res,
                201,
                await createStudent(
                  data,
                ),
              )
            : json(res, 400, {
                error:
                  "Name is required",
              });
        }

        // ------------------------------------------------------
        // UPDATE STUDENT
        // ------------------------------------------------------

        if (
          req.method === "PUT" &&
          url.pathname.startsWith(
            "/api/students/",
          )
        ) {
          const data =
            await body(req);

          const id = Number(
            url.pathname
              .split("/")
              .pop(),
          );

          if (!data.name) {
            return json(res, 400, {
              error:
                "Name is required",
            });
          }

          const updated =
            await updateStudent(
              id,
              data,
            );

          return updated
            ? json(res, 200, updated)
            : json(res, 404, {
                error:
                  "Student not found",
              });
        }

        // ------------------------------------------------------
        // OPPORTUNITIES
        // ------------------------------------------------------

        if (
          req.method === "GET" &&
          url.pathname ===
            "/api/opportunities"
        ) {
          return json(
            res,
            200,
            await listOpportunities(),
          );
        }

        // ------------------------------------------------------
        // GET SINGLE OPPORTUNITY
        // ------------------------------------------------------

        if (
          req.method === "GET" &&
          url.pathname.startsWith(
            "/api/opportunities/",
          )
        ) {
          const id = Number(
            url.pathname
              .split("/")
              .pop(),
          );

          const opportunity =
            await getOpportunity(id);

          return opportunity
            ? json(
                res,
                200,
                opportunity,
              )
            : json(res, 404, {
                error:
                  "Opportunity not found",
              });
        }

        // ------------------------------------------------------
        // CREATE OPPORTUNITY
        // ------------------------------------------------------

        if (
          req.method === "POST" &&
          url.pathname ===
            "/api/opportunities"
        ) {
          const data =
            await body(req);

          if (
            !data.company ||
            !data.title ||
            !data.description
          ) {
            return json(res, 400, {
              error:
                "company, title and description are required",
            });
          }

          return json(
            res,
            201,
            await createOpportunity(
              data,
            ),
          );
        }

        // ------------------------------------------------------
        // MATCHES
        // ------------------------------------------------------

        if (
          req.method === "GET" &&
          url.pathname.startsWith(
            "/api/matches/",
          )
        ) {
          const id = Number(
            url.pathname
              .split("/")
              .pop(),
          );

          const student =
            await getStudent(id);

          if (!student) {
            return json(res, 404, {
              error:
                "Student not found",
            });
          }

          return json(res, 200, {
            student,
            matches: rankMatches(
              student,
              await listOpportunities(),
            ),
          });
        }

        // ------------------------------------------------------
        // UNKNOWN API ROUTE
        // ------------------------------------------------------

        return json(res, 404, {
          error: "API route not found",
        });
      }

      // --------------------------------------------------------
      // STATIC FRONTEND
      // --------------------------------------------------------

      serveFile(req, res);

    } catch (error) {
      console.error(error);

      json(res, 500, {
        error:
          "Unexpected server error",

        detail: error.message,
      });
    }
  },
);

// ============================================================
// STARTUP
// ============================================================

await connectMongo();

await seedDatabase();

server.listen(port, () => {
  console.log(
    `SkillBridge API running on port ${port}`,
  );
});