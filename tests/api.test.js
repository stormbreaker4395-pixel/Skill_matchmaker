import test, { before, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "development";
process.env.LOCAL_AUTH = "true";
process.env.MONGODB_URI = "";

const { connectMongo, getDb } = await import("../server/mongodb.js");
const { seedDatabase } = await import("../server/db.js");
const { createServer } = await import("../server/app.js");

let server;
let base;

before(async () => {
  await connectMongo();
  await seedDatabase();
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => { await new Promise((resolve) => server.close(resolve)); });

function headers(uid = "demo-student", requestedRole = "student") { return { "X-Local-User": uid, "X-Local-Role": requestedRole }; }
async function request(path, options = {}) { const response = await fetch(`${base}${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } }); const data = await response.json(); return { response, data }; }

test("health identifies local heuristic mode honestly", async () => {
  const { response, data } = await request("/api/health");
  assert.equal(response.status, 200);
  assert.equal(data.localAuth, true);
  assert.equal(data.matching, "local-heuristic");
  assert.equal(data.ai, undefined);
});

test("student profile is scoped to current user", async () => {
  const { response, data } = await request("/api/profile");
  assert.equal(response.status, 200);
  assert.equal(data.uid, "demo-student");
  const other = await request("/api/students/stu-demo-2");
  assert.equal(other.response.status, 404);
});

test("organization candidate discovery requires verified organization identity", async () => {
  const denied = await request("/api/talent/candidates", { headers: headers("demo-student", "organization") });
  assert.equal(denied.response.status, 403);
  const allowed = await request("/api/talent/candidates", { headers: headers("demo-org", "organization") });
  assert.equal(allowed.response.status, 200);
});

test("candidate query is consent-filtered", async () => {
  await getDb().collection("students").findOneAndUpdate({ uid: "demo-student-2" }, { $set: { candidateOptIn: true } }, { returnDocument: "after" });
  const { response, data } = await request("/api/talent/candidates", { headers: headers("demo-org", "organization") });
  assert.equal(response.status, 200);
  assert.ok(data.some((candidate) => candidate.id === "stu-demo-2"));
  assert.ok(data.every((candidate) => !Object.prototype.hasOwnProperty.call(candidate, "uid")));
});

test("activity validates type and referenced opportunity", async () => {
  const invalidType = await request("/api/activity", { method: "POST", body: JSON.stringify({ type: "hack" }), headers: { ...headers(), "Content-Type": "application/json" } });
  assert.equal(invalidType.response.status, 400);
  const invalidOpportunity = await request("/api/activity", { method: "POST", body: JSON.stringify({ type: "view", opportunityId: "missing" }), headers: { ...headers(), "Content-Type": "application/json" } });
  assert.equal(invalidOpportunity.response.status, 404);
});

test("application status transition is server validated", async () => {
  const created = await request("/api/applications", { method: "POST", body: JSON.stringify({ opportunityId: "opp-2" }), headers: { ...headers(), "Content-Type": "application/json" } });
  assert.ok([200, 201].includes(created.response.status));
  const id = created.data.id;
  const invalid = await request(`/api/applications/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: "Offer" }), headers: { ...headers(), "Content-Type": "application/json" } });
  assert.equal(invalid.response.status, 409);
  const valid = await request(`/api/applications/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: "Shortlisted" }), headers: { ...headers(), "Content-Type": "application/json" } });
  assert.equal(valid.response.status, 200);
});

test("company follow is normalized case-insensitively", async () => {
  const first = await request("/api/follows", { method: "POST", body: JSON.stringify({ company: "PixelForge" }), headers: { ...headers(), "Content-Type": "application/json" } });
  assert.ok([200, 201].includes(first.response.status));
  const second = await request("/api/follows", { method: "POST", body: JSON.stringify({ company: "pixelforge" }), headers: { ...headers(), "Content-Type": "application/json" } });
  assert.equal(second.response.status, 200);
  assert.equal(second.data.following, false);
});
