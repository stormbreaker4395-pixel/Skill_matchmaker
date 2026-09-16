import "dotenv/config";
import http from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { connectMongo, getDb } from "./mongodb.js";
import { ensureStudentForUser, getStudentByUid, getStudent, updateStudent, createStudent, listOpportunities, getOpportunity, createOpportunity, seedDatabase, getOrganization, createOrganization } from "./db.js";
import { personalizedRecommendations, candidatePool, marketByCompany } from "./recommendations.js";
import { parseStudentText, parseJobText, skillpulse, careerGap, interviewQuestions } from "./ai.js";
import { normalizeCompany, normalizeList, normalizeRole } from "./taxonomy.js";
import { APPLICATION_STATUSES, APPLICATION_TRANSITIONS, ACTIVITY_TYPES } from "../shared/constants.js";
import { authenticate, requireStudent, requireVerifiedOrganization } from "./auth.js";
import { HttpError, json, readJsonBody, serveStatic } from "./http.js";

const port = Number(process.env.PORT || 4000);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "client");
const localAuth = process.env.LOCAL_AUTH === "true";
const configuredOrigins = String(process.env.FRONTEND_URL || `http://localhost:${port}`).split(",").map((x) => x.trim()).filter(Boolean);
if (process.env.NODE_ENV === "production" && configuredOrigins.includes("*")) throw new Error("FRONTEND_URL=* is not allowed in production");

const collection = (name) => getDb().collection(name);
const stripId = (doc) => { if (!doc) return null; const { _id, ...rest } = doc; return rest; };
const cleanList = (value, normalizer = (x) => String(x).trim().toLowerCase()) => normalizeList(value, normalizer);
async function currentProfile(user) { return (await getStudentByUid(user.uid)) || ensureStudentForUser(user.uid, user.email); }
function parseStipend(value) { const match = String(value || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/); return match ? Number(match[1]) : 0; }
function publicError(res, origin, message, status = 500) { return json(res, status, { error: status >= 500 ? "Internal server error" : message }, origin, configuredOrigins); }
function requiredText(value, name, max = 5000) { const text = String(value || "").trim(); if (!text || text.length > max) throw new HttpError(400, `${name} is required and within the allowed length`); return text; }

export function createServer() {
  return http.createServer(async (req, res) => {
    const origin = String(req.headers.origin || configuredOrigins[0] || "");
    try {
      if (req.method === "OPTIONS") { if (configuredOrigins.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Local-User, X-Local-Role"); res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS"); res.writeHead(204); return res.end(); }
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      if (url.pathname === "/api/health") {
        return json(res, 200, { ok: true, service: "skillbridge", localAuth, authentication: localAuth ? "development-local" : "firebase", matching: "local-heuristic", storage: getDb().__memory ? "memory-development" : "mongodb" }, origin, configuredOrigins);
      }
      if (!url.pathname.startsWith("/api/")) return serveStatic(req, res, root, origin, configuredOrigins);

      const firebaseAuth = localAuth ? null : (await import("./firebase-admin.js")).firebaseAuth;
      const user = await authenticate(req, res, { localAuth, firebaseAuth });
      if (!user) return;

      if (url.pathname === "/api/me" && req.method === "GET") return json(res, 200, { user, profile: user.role === "student" ? await currentProfile(user) : null, organization: user.role === "organization" ? await getOrganization(user.uid) : null }, origin, configuredOrigins);

      if (url.pathname === "/api/profile" && req.method === "GET") { if (!requireStudent(user, res)) return; return json(res, 200, await currentProfile(user), origin, configuredOrigins); }
      if (url.pathname === "/api/profile" && req.method === "PUT") {
        if (!requireStudent(user, res)) return;
        const current = await currentProfile(user), data = await readJsonBody(req); const merged = { ...current, ...data, skills: cleanList(data.skills ?? current.skills), interests: cleanList(data.interests ?? current.interests), roles: cleanList(data.roles ?? current.roles, normalizeRole), preferredLocations: cleanList(data.preferredLocations ?? current.preferredLocations), projects: Array.isArray(data.projects) ? data.projects : current.projects || [], experience: Array.isArray(data.experience) ? data.experience : current.experience || [], skillDetails: Array.isArray(data.skillDetails) ? data.skillDetails : current.skillDetails || [] };
        requiredText(merged.name, "Name", 120); return json(res, 200, await updateStudent(current.id, merged, user.uid), origin, configuredOrigins);
      }
      if (url.pathname === "/api/profile/candidate-opt-in" && req.method === "GET") { if (!requireStudent(user, res)) return; const p = await currentProfile(user); return json(res, 200, { candidateOptIn: Boolean(p.candidateOptIn) }, origin, configuredOrigins); }
      if (url.pathname === "/api/profile/candidate-opt-in" && req.method === "PUT") { if (!requireStudent(user, res)) return; const current = await currentProfile(user), data = await readJsonBody(req); const saved = await updateStudent(current.id, { ...current, candidateOptIn: Boolean(data.candidateOptIn) }, user.uid); return json(res, 200, { candidateOptIn: Boolean(saved.candidateOptIn) }, origin, configuredOrigins); }
      if (url.pathname === "/api/profile/market-opt-in" && req.method === "PUT") { if (!requireStudent(user, res)) return; const current = await currentProfile(user), data = await readJsonBody(req); const saved = await updateStudent(current.id, { ...current, marketOptIn: Boolean(data.marketOptIn) }, user.uid); return json(res, 200, { marketOptIn: Boolean(saved.marketOptIn) }, origin, configuredOrigins); }

      if (url.pathname === "/api/students" && req.method === "GET") { if (!requireStudent(user, res)) return; return json(res, 200, [await currentProfile(user)], origin, configuredOrigins); }
      if (url.pathname === "/api/students" && req.method === "POST") { if (!requireStudent(user, res)) return; const data = await readJsonBody(req); requiredText(data.name, "Name", 120); return json(res, 201, await createStudent(data, user.uid), origin, configuredOrigins); }
      if (url.pathname.startsWith("/api/students/") && req.method === "GET") { if (!requireStudent(user, res)) return; const student = await getStudent(decodeURIComponent(url.pathname.split("/").pop()), user.uid); return student ? json(res, 200, student, origin, configuredOrigins) : publicError(res, origin, "Student not found", 404); }

      if (url.pathname === "/api/opportunities" && req.method === "GET") {
        let rows = await listOpportunities(); const q = String(url.searchParams.get("q") || "").toLowerCase(); const mode = url.searchParams.get("mode"); const skill = url.searchParams.get("skill"); const year = url.searchParams.get("year");
        if (q) rows = rows.filter((o) => `${o.company} ${o.title} ${o.description} ${(o.skills || []).join(" ")}`.toLowerCase().includes(q)); if (mode) rows = rows.filter((o) => o.mode === mode); if (skill) rows = rows.filter((o) => cleanList(o.skills).includes(cleanList([skill])[0])); if (year) rows = rows.filter((o) => (o.targetYears || []).map(String).includes(String(year)));
        return json(res, 200, rows, origin, configuredOrigins);
      }
      if (url.pathname === "/api/opportunities" && req.method === "POST") {
        if (!requireVerifiedOrganization(user, res)) return; const data = await readJsonBody(req); const company = requiredText(data.company, "Company", 160); const title = requiredText(data.title, "Role title", 160); const description = requiredText(data.description, "Description", 10000);
        const parsed = parseJobText(`${title} ${description} ${(data.skills || []).join(" ")}`); const opportunity = await createOpportunity({ ...data, company, title, description, skills: [...new Set([...(data.skills || []), ...parsed.skills])], roles: parsed.roles, minExperienceMonths: data.minExperienceMonths || parsed.minExperienceMonths, stipendAmount: Number(data.stipendAmount || parseStipend(data.stipend)), organizationUid: user.uid });
        return json(res, 201, opportunity, origin, configuredOrigins);
      }
      if (url.pathname.startsWith("/api/opportunities/") && req.method === "GET") { const opportunity = await getOpportunity(decodeURIComponent(url.pathname.split("/").pop())); return opportunity ? json(res, 200, opportunity, origin, configuredOrigins) : publicError(res, origin, "Opportunity not found", 404); }

      if (url.pathname === "/api/recommendations" && req.method === "GET") { if (!requireStudent(user, res)) return; const student = await currentProfile(user); return json(res, 200, { student, matches: await personalizedRecommendations(student) }, origin, configuredOrigins); }
      if (url.pathname.startsWith("/api/matches/") && req.method === "GET") { if (!requireStudent(user, res)) return; const student = await getStudent(decodeURIComponent(url.pathname.split("/").pop()), user.uid); if (!student) return publicError(res, origin, "Student not found", 404); return json(res, 200, { student, matches: await personalizedRecommendations(student) }, origin, configuredOrigins); }

      if (url.pathname === "/api/activity" && req.method === "GET") return json(res, 200, (await collection("activity").find({ uid: user.uid }).sort({ createdAt: -1 }).toArray()).map(stripId), origin, configuredOrigins);
      if (url.pathname === "/api/activity" && req.method === "POST") {
        const data = await readJsonBody(req); const type = String(data.type || "view"); if (!ACTIVITY_TYPES.includes(type)) return publicError(res, origin, "Invalid activity type", 400);
        let opportunityId = null, opportunity = null; if (data.opportunityId != null) { opportunity = await getOpportunity(String(data.opportunityId)); if (!opportunity) return publicError(res, origin, "Opportunity not found", 404); opportunityId = opportunity.id; }
        const activity = { id: `act-${randomUUID()}`, uid: user.uid, type, opportunityId, company: opportunity?.company || String(data.company || ""), title: opportunity?.title || String(data.title || ""), createdAt: new Date().toISOString() }; await collection("activity").insertOne(activity); return json(res, 201, activity, origin, configuredOrigins);
      }

      if (url.pathname === "/api/applications" && req.method === "GET") return json(res, 200, (await collection("applications").find({ uid: user.uid }).sort({ updatedAt: -1 }).toArray()).map(stripId), origin, configuredOrigins);
      if (url.pathname === "/api/applications" && req.method === "POST") {
        if (!requireStudent(user, res)) return; const data = await readJsonBody(req); const opportunity = await getOpportunity(String(data.opportunityId)); if (!opportunity) return publicError(res, origin, "Opportunity not found", 404); const existing = await collection("applications").findOne({ uid: user.uid, opportunityId: opportunity.id }); if (existing) return json(res, 200, stripId(existing), origin, configuredOrigins);
        const application = { id: `app-${randomUUID()}`, uid: user.uid, opportunityId: opportunity.id, company: opportunity.company, title: opportunity.title, status: "Applied", note: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; await collection("applications").insertOne(application); await collection("activity").insertOne({ id: `act-${randomUUID()}`, uid: user.uid, type: "apply", opportunityId: opportunity.id, company: opportunity.company, title: opportunity.title, createdAt: new Date().toISOString() }); return json(res, 201, application, origin, configuredOrigins);
      }
      if (url.pathname.startsWith("/api/applications/") && req.method === "PUT") {
        if (!requireStudent(user, res)) return; const id = decodeURIComponent(url.pathname.split("/").pop()); const data = await readJsonBody(req); const status = String(data.status || ""); if (!APPLICATION_STATUSES.includes(status)) return publicError(res, origin, "Invalid application status", 400);
        const current = await collection("applications").findOne({ id, uid: user.uid }); if (!current) return publicError(res, origin, "Application not found", 404); if (!APPLICATION_TRANSITIONS[current.status]?.includes(status)) return publicError(res, origin, `Invalid transition from ${current.status} to ${status}`, 409);
        const saved = await collection("applications").findOneAndUpdate({ id, uid: user.uid }, { $set: { status, note: String(data.note || "").slice(0, 2000), updatedAt: new Date().toISOString() } }, { returnDocument: "after" }); return json(res, 200, stripId(saved), origin, configuredOrigins);
      }

      if (url.pathname === "/api/follows" && req.method === "GET") return json(res, 200, (await collection("follows").find({ uid: user.uid }).sort({ createdAt: -1 }).toArray()).map(stripId), origin, configuredOrigins);
      if (url.pathname === "/api/follows" && req.method === "POST") {
        if (!requireStudent(user, res)) return; const data = await readJsonBody(req); const company = requiredText(data.company, "Company", 160); const companyKey = normalizeCompany(company); const existing = await collection("follows").findOne({ uid: user.uid, companyKey });
        if (existing) { await collection("follows").deleteOne({ uid: user.uid, companyKey }); return json(res, 200, { following: false }, origin, configuredOrigins); } await collection("follows").insertOne({ id: `follow-${randomUUID()}`, uid: user.uid, company, companyKey, createdAt: new Date().toISOString() }); return json(res, 201, { following: true }, origin, configuredOrigins);
      }
      if (url.pathname === "/api/feed" && req.method === "GET") {
        if (!requireStudent(user, res)) return; const follows = await collection("follows").find({ uid: user.uid }).toArray(); const companyKeys = [...new Set(follows.map((f) => f.companyKey))]; const jobs = await listOpportunities(); const items = companyKeys.map((key) => { const roles = jobs.filter((o) => normalizeCompany(o.company) === key); return { company: roles[0]?.company || key, summary: `${roles.length} active opportunity${roles.length === 1 ? "" : "ies"} from ${roles[0]?.company || key}.`, roles }; }); return json(res, 200, { following: items.map((x) => x.company), items }, origin, configuredOrigins);
      }

      if (url.pathname === "/api/talent/candidates" && req.method === "GET") { if (!requireVerifiedOrganization(user, res)) return; return json(res, 200, await candidatePool({ skill: url.searchParams.get("skill"), role: url.searchParams.get("role"), year: url.searchParams.get("year") }), origin, configuredOrigins); }
      if (url.pathname === "/api/market" && req.method === "GET") {
        if (!requireVerifiedOrganization(user, res)) return; const students = await collection("students").find({ marketOptIn: true }, { projection: { id: 1, skills: 1, roles: 1, year: 1 } }).toArray(); const jobs = await listOpportunities(); const skills = new Map(), roles = new Map(), demand = new Map();
        for (const student of students) { for (const skill of student.skills || []) skills.set(skill, (skills.get(skill) || 0) + 1); for (const role of student.roles || []) roles.set(role, (roles.get(role) || 0) + 1); } for (const job of jobs) for (const skill of job.skills || []) demand.set(skill, (demand.get(skill) || 0) + 1);
        return json(res, 200, { students: students.length, opportunities: jobs.length, skills: [...skills].map(([skill, count]) => ({ skill, students: count, openings: demand.get(skill) || 0 })).sort((a, b) => b.students - a.students), roles: [...roles].map(([role, count]) => ({ role, students: count })).sort((a, b) => b.students - a.students), years: [...new Set(students.map((s) => s.year).filter(Boolean))].sort() }, origin, configuredOrigins);
      }
      if (url.pathname === "/api/company-intel" && req.method === "GET") { if (!requireVerifiedOrganization(user, res)) return; return json(res, 200, { query: String(url.searchParams.get("q") || ""), companies: (await marketByCompany()).filter((row) => !url.searchParams.get("q") || `${row.company} ${row.roles.join(" ")} ${row.topSkills.map((x) => x.skill).join(" ")}`.toLowerCase().includes(String(url.searchParams.get("q")).toLowerCase())) }, origin, configuredOrigins); }
      if (url.pathname === "/api/ai/profile" && req.method === "POST") { if (!requireStudent(user, res)) return; const data = await readJsonBody(req); return json(res, 200, parseStudentText(requiredText(data.text, "Description", 10000)), origin, configuredOrigins); }
      if (url.pathname === "/api/ai/job" && req.method === "POST") { if (!requireVerifiedOrganization(user, res)) return; const data = await readJsonBody(req); return json(res, 200, parseJobText(requiredText(data.text, "Description", 10000)), origin, configuredOrigins); }
      if (url.pathname === "/api/ai/skillpulse" && req.method === "GET") { if (!requireStudent(user, res)) return; const student = await currentProfile(user); const population = await collection("students").find({ marketOptIn: true }).toArray(); return json(res, 200, skillpulse(student, population, await listOpportunities()), origin, configuredOrigins); }
      if (url.pathname === "/api/ai/career" && req.method === "GET") { if (!requireStudent(user, res)) return; return json(res, 200, careerGap(await currentProfile(user), url.searchParams.get("role") || "software engineer", await listOpportunities()), origin, configuredOrigins); }
      if (url.pathname.startsWith("/api/ai/interview/") && req.method === "GET") { if (!requireStudent(user, res)) return; const opportunity = await getOpportunity(decodeURIComponent(url.pathname.split("/").pop())); if (!opportunity) return publicError(res, origin, "Opportunity not found", 404); return json(res, 200, { questions: interviewQuestions(opportunity, await currentProfile(user)), mode: "local-heuristic" }, origin, configuredOrigins); }
      if (url.pathname === "/api/organizations" && req.method === "POST") { const existing = await getOrganization(user.uid); if (existing) return json(res, 200, existing, origin, configuredOrigins); const data = await readJsonBody(req); return json(res, 201, await createOrganization(user.uid, requiredText(data.name || "Organization", "Name", 160)), origin, configuredOrigins); }
      return publicError(res, origin, "API route not found", 404);
    } catch (error) {
      if (error instanceof HttpError) return publicError(res, origin, error.message, error.status); console.error(error); return publicError(res, origin, "Internal server error", 500);
    }
  });
}

export async function start() { await connectMongo(); await seedDatabase(); const server = createServer(); server.listen(port, () => console.log(`SkillBridge server running at http://localhost:${port}`)); return server; }
