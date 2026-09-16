import { randomUUID } from "node:crypto";
import { getDb } from "./mongodb.js";
import { normalizeCompany, normalizeList, normalizeRole } from "./taxonomy.js";
import { demoSeed } from "./demo-seed.js";

const cleanText = (value) => String(value || "").trim();
const newId = (prefix) => `${prefix}-${randomUUID()}`;
const stripMongoId = (doc) => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
};
const idVariants = (value) => {
  const text = String(value);
  return /^\d+$/.test(text) ? [text, Number(text)] : [text];
};

const initial = {
  students: [
    {
      id: "stu-demo-1", uid: "demo-student", name: "Aarav Mehta", headline: "Computer Science student · Full-stack & AI enthusiast",
      skills: normalizeList(["javascript", "react", "python", "sql", "git"]), interests: ["ai", "product", "startups"], experienceMonths: 8,
      preferredMode: "Hybrid", preferredLocations: ["bengaluru", "remote"], bio: "Builds practical web products and enjoys turning data into useful decisions.",
      year: 2, college: "Christ University", degree: "B.Tech", branch: "Computer Science Engineering", graduationYear: 2028,
      roles: ["frontend", "software engineer"].map(normalizeRole), candidateOptIn: false, marketOptIn: true,
      projects: [{ title: "SkillBridge", description: "Student skill matching platform using JavaScript, Node.js and MongoDB", technologies: normalizeList(["javascript", "node.js", "mongodb"]) }],
      experience: [{ title: "Student Developer", description: "Built academic and hackathon software products", months: 8 }],
      skillDetails: [{ name: "javascript", level: "comfortable", learnedFrom: "projects" }, { name: "react", level: "learning", learnedFrom: "college" }], onboardingComplete: true,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "stu-demo-2", uid: "demo-student-2", name: "Demo Student 2", headline: "Data and Python learner", skills: normalizeList(["python", "sql", "excel"]), interests: ["analytics", "ai"], experienceMonths: 2,
      preferredMode: "Remote", preferredLocations: ["remote"], bio: "", year: 2, college: "Christ University", degree: "B.Tech", branch: "Computer Science", graduationYear: 2028,
      roles: ["data analyst"], candidateOptIn: false, marketOptIn: true, projects: [], experience: [], skillDetails: [], onboardingComplete: true,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "stu-demo-3", uid: "demo-student-3", name: "Demo Student 3", headline: "Backend learner", skills: normalizeList(["javascript", "node.js", "git"]), interests: ["cloud", "startups"], experienceMonths: 4,
      preferredMode: "Hybrid", preferredLocations: ["bengaluru"], bio: "", year: 2, college: "PES University", degree: "B.Tech", branch: "Computer Science", graduationYear: 2028,
      roles: ["backend"], candidateOptIn: false, marketOptIn: true, projects: [], experience: [], skillDetails: [], onboardingComplete: true,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "stu-demo-4", uid: "demo-student-4", name: "Demo Student 4", headline: "Design and frontend learner", skills: normalizeList(["react", "javascript", "ui/ux"]), interests: ["design", "product"], experienceMonths: 3,
      preferredMode: "On-site", preferredLocations: ["bengaluru"], bio: "", year: 3, college: "RV College of Engineering", degree: "B.Tech", branch: "Computer Science", graduationYear: 2027,
      roles: ["frontend", "ui/ux designer"].map(normalizeRole), candidateOptIn: false, marketOptIn: true, projects: [], experience: [], skillDetails: [], onboardingComplete: true,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  opportunities: [
    { id: "opp-1", company: "Nova Labs", companyKey: "nova labs", title: "AI Product Intern", description: "Prototype AI-assisted product features, work with product metrics, and ship experiments with engineers.", skills: normalizeList(["python", "machine learning", "sql", "product"]), interests: ["ai", "product", "startups"], minExperienceMonths: 6, mode: "Hybrid", location: "Bengaluru", stipend: "₹20,000 / month", stipendAmount: 20000, stipendCurrency: "INR", roles: ["product intern", "ml engineer"].map(normalizeRole), targetYears: [2, 3], organizationUid: "demo-org", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "opp-2", company: "PixelForge", companyKey: "pixelforge", title: "Frontend Engineering Intern", description: "Build polished React interfaces, collaborate with designers, and improve accessibility and performance.", skills: normalizeList(["javascript", "react", "git", "ui/ux"]), interests: ["product", "design", "startups"], minExperienceMonths: 3, mode: "On-site", location: "Bengaluru", stipend: "₹18,000 / month", stipendAmount: 18000, stipendCurrency: "INR", roles: ["frontend"].map(normalizeRole), targetYears: [2, 3], organizationUid: "demo-org", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "opp-3", company: "DataMint", companyKey: "datamint", title: "Data Analytics Intern", description: "Use SQL and Python to clean datasets, automate reports, and communicate insights to business teams.", skills: normalizeList(["python", "sql", "data analysis", "excel"]), interests: ["analytics", "business", "ai"], minExperienceMonths: 4, mode: "Remote", location: "India", stipend: "₹15,000 / month", stipendAmount: 15000, stipendCurrency: "INR", roles: ["data analyst"].map(normalizeRole), targetYears: [2, 3], organizationUid: "demo-org", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "opp-4", company: "CloudNest", companyKey: "cloudnest", title: "Backend & Cloud Intern", description: "Develop APIs and lightweight services, learn cloud deployment, and help improve reliability.", skills: normalizeList(["node.js", "javascript", "api", "cloud", "git"]), interests: ["cloud", "devops", "startups"], minExperienceMonths: 6, mode: "Flexible", location: "Remote", stipend: "₹22,000 / month", stipendAmount: 22000, stipendCurrency: "INR", roles: ["backend", "cloud/devops"].map(normalizeRole), targetYears: [3], organizationUid: "demo-org", createdAt: "2026-01-01T00:00:00.000Z" },
  ],
  organizations: [{ uid: "demo-org", name: "SkillBridge Demo Organization", verified: true, createdAt: "2026-01-01T00:00:00.000Z" }],
};

function normalizeStudent(data, uid, current = {}) {
  return {
    id: data.id || current.id || newId("stu"), uid,
    name: cleanText(data.name) || "Student", headline: cleanText(data.headline), skills: normalizeList(data.skills),
    interests: normalizeList(data.interests, (x) => cleanText(x).toLowerCase()), experienceMonths: Math.max(0, Number(data.experienceMonths || 0)),
    preferredMode: cleanText(data.preferredMode) || "Flexible", preferredLocations: normalizeList(data.preferredLocations, (x) => cleanText(x).toLowerCase()), bio: cleanText(data.bio),
    year: Math.max(1, Number(data.year || 1)), college: cleanText(data.college), degree: cleanText(data.degree), branch: cleanText(data.branch), graduationYear: data.graduationYear || "",
    roles: normalizeList(data.roles, normalizeRole), candidateOptIn: Boolean(data.candidateOptIn), marketOptIn: data.marketOptIn === undefined ? Boolean(current.marketOptIn) : Boolean(data.marketOptIn),
    projects: Array.isArray(data.projects) ? data.projects : [], experience: Array.isArray(data.experience) ? data.experience : [],
    skillDetails: Array.isArray(data.skillDetails) ? data.skillDetails.map((x) => ({ ...x, name: normalizeList([x?.name])[0] || "" })) : [], onboardingComplete: Boolean(data.onboardingComplete),
    createdAt: data.createdAt || current.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

async function safeIndex(collection, spec, options) { try { await collection.createIndex(spec, options); } catch { /* existing indexes or local DB */ } }
async function ensureSeeded(collection, docs, key = "id") {
  if (!docs?.length) return;
  const keys = docs.map((doc) => doc[key]).filter(Boolean);
  if (!keys.length) return;
  const existing = new Set((await collection.find({ [key]: { $in: keys } }, { projection: { [key]: 1 } }).toArray()).map((doc) => String(doc[key])));
  const missing = docs.filter((doc) => doc[key] && !existing.has(String(doc[key])));
  if (missing.length) await collection.insertMany(missing, { ordered: true });
}

export async function seedDatabase() {
  const db = getDb(); const students = db.collection("students"); const opportunities = db.collection("opportunities"); const organizations = db.collection("organizations");
  await ensureSeeded(students, initial.students);
  await ensureSeeded(opportunities, initial.opportunities);
  await ensureSeeded(organizations, initial.organizations, "uid");

  if (process.env.NODE_ENV !== "production" && process.env.DEMO_DATA !== "false") {
    await ensureSeeded(students, demoSeed.students);
    await ensureSeeded(opportunities, demoSeed.opportunities);
    await ensureSeeded(db.collection("applications"), demoSeed.applications);
    await ensureSeeded(db.collection("follows"), demoSeed.follows);
    await ensureSeeded(db.collection("activity"), demoSeed.activity);
  }

  await safeIndex(students, { uid: 1 }, { unique: true }); await safeIndex(students, { candidateOptIn: 1 }); await safeIndex(students, { marketOptIn: 1 });
  await safeIndex(opportunities, { organizationUid: 1 }); await safeIndex(opportunities, { companyKey: 1 }); await safeIndex(organizations, { uid: 1 }, { unique: true });
  await safeIndex(db.collection("applications"), { uid: 1, opportunityId: 1 }, { unique: true });
  await safeIndex(db.collection("follows"), { uid: 1, companyKey: 1 }, { unique: true });
  await safeIndex(db.collection("activity"), { uid: 1, createdAt: -1 });
}

export async function getStudentByUid(uid) { return stripMongoId(await getDb().collection("students").findOne({ uid })); }
export async function listStudents(uid) { const q = uid ? { uid } : { marketOptIn: true }; return (await getDb().collection("students").find(q).sort({ createdAt: -1 }).toArray()).map(stripMongoId); }
export async function getStudent(value, uid) { const q = { id: { $in: idVariants(value) }, ...(uid ? { uid } : {}) }; return stripMongoId(await getDb().collection("students").findOne(q)); }

export async function ensureStudentForUser(uid, email = "") {
  const existing = await getStudentByUid(uid); if (existing) return existing;
  const name = String(email || "Student").split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Student";
  const student = normalizeStudent({ name, onboardingComplete: false, marketOptIn: false }, uid); await getDb().collection("students").insertOne(student); return student;
}
export async function createStudent(data, uid) { const student = normalizeStudent(data, uid); await getDb().collection("students").insertOne(student); return student; }
export async function updateStudent(value, data, uid) { const current = await getStudent(value, uid); if (!current) return null; const student = normalizeStudent(data, uid, current); student.id = current.id; return stripMongoId(await getDb().collection("students").findOneAndUpdate({ id: current.id, uid }, { $set: student }, { returnDocument: "after" })); }

export async function listOpportunities(filters = {}) { return (await getDb().collection("opportunities").find(filters).sort({ createdAt: -1 }).toArray()).map(stripMongoId); }
export async function getOpportunity(value) { return stripMongoId(await getDb().collection("opportunities").findOne({ id: { $in: idVariants(value) } })); }
export async function createOpportunity(data) {
  const amount = Math.max(0, Number(data.stipendAmount || 0));
  const opportunity = { id: newId("opp"), company: cleanText(data.company), companyKey: normalizeCompany(data.company), title: cleanText(data.title), description: cleanText(data.description), skills: normalizeList(data.skills), interests: normalizeList(data.interests, (x) => cleanText(x).toLowerCase()), minExperienceMonths: Math.max(0, Number(data.minExperienceMonths || 0)), mode: cleanText(data.mode) || "Flexible", location: cleanText(data.location) || "Remote", stipend: cleanText(data.stipend) || "Unpaid / Not specified", stipendAmount: amount, stipendCurrency: cleanText(data.stipendCurrency) || "INR", roles: normalizeList(data.roles, normalizeRole), targetYears: Array.isArray(data.targetYears) ? data.targetYears.map(Number).filter(Number.isFinite) : [], organizationUid: data.organizationUid || "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await getDb().collection("opportunities").insertOne(opportunity); return opportunity;
}

export async function getOrganization(uid) { return stripMongoId(await getDb().collection("organizations").findOne({ uid })); }
export async function createOrganization(uid, name) { const org = { uid, name: cleanText(name) || "Organization", verified: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; await getDb().collection("organizations").insertOne(org); return org; }
export const idList = idVariants;
