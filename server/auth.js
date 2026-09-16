import { getOrganization } from "./db.js";

export async function authenticate(req, res, { localAuth, firebaseAuth }) {
  if (localAuth) {
    const uid = String(req.headers["x-local-user"] || "demo-student");
    const requestedRole = String(req.headers["x-local-role"] || "student");
    return { uid, email: `${uid}@local.test`, role: requestedRole === "organization" ? "organization" : "student", verified: requestedRole === "organization" && uid === "demo-org" };
  }
  if (!firebaseAuth) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Authentication service is not configured" }));
    return null;
  }
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Authentication required" }));
    return null;
  }
  try {
    const token = await firebaseAuth.verifyIdToken(header.slice(7));
    const organization = await getOrganization(token.uid);
    return { ...token, uid: token.uid, email: token.email || "", role: organization ? "organization" : "student", organization };
  } catch {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid or expired authentication token" }));
    return null;
  }
}

export function requireStudent(user, res) {
  if (user.role !== "student") { res.writeHead(403, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Student account required" })); return false; }
  return true;
}

export function requireVerifiedOrganization(user, res) {
  if (user.role !== "organization") { res.writeHead(403, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Organization account required" })); return false; }
  if (user.verified !== true && user.organization?.verified !== true) { res.writeHead(403, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Verified organization access required" })); return false; }
  return true;
}
