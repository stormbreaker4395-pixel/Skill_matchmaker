import { getDb } from "./mongodb.js";
import { rankMatches } from "./matcher.js";
import { normalizeCompany, normalizeRole, normalizeSkill } from "./taxonomy.js";

const stripId = (doc) => { if (!doc) return null; const { _id, ...rest } = doc; return rest; };
const rows = async (name, query = {}, options = {}) => (await getDb().collection(name).find(query, options).toArray()).map(stripId);
const decay = (time) => Math.exp(-Math.max(0, (Date.now() - new Date(time || Date.now()).getTime()) / 86400000) / 21);

function companyBoost(company, follows, events) {
  const key = normalizeCompany(company); let boost = follows.some((x) => normalizeCompany(x.company) === key) ? 7 : 0;
  for (const event of events.filter((x) => normalizeCompany(x.company) === key)) { const weight = decay(event.createdAt); if (event.type === "view") boost += 2.5 * weight; if (event.type === "save") boost += 4 * weight; if (event.type === "apply") boost += 5 * weight; }
  return boost;
}

export async function personalizedRecommendations(student) {
  const [jobs, follows, events] = await Promise.all([rows("opportunities"), rows("follows", { uid: student.uid }), rows("activity", { uid: student.uid })]);
  return rankMatches(student, jobs, { follows, activity: events }).map((match) => {
    const boost = companyBoost(match.opportunity.company, follows, events);
    const score = Math.min(100, Math.round(match.score + boost));
    const reasons = [...(match.reasons || [])];
    if (follows.some((f) => normalizeCompany(f.company) === normalizeCompany(match.opportunity.company))) reasons.unshift("From a company you follow");
    if (boost > 3) reasons.unshift("Matches recent activity");
    return { ...match, score, baseScore: match.score, personalization: Math.round(boost * 10) / 10, personalizedReasons: [...new Set(reasons)].slice(0, 5) };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score);
}

export async function candidatePool(filters = {}) {
  const query = { candidateOptIn: true };
  if (filters.year) query.year = Number(filters.year);
  const projection = { id: 1, name: 1, headline: 1, college: 1, degree: 1, branch: 1, year: 1, graduationYear: 1, skills: 1, skillDetails: 1, roles: 1, preferredMode: 1, preferredLocations: 1, projects: 1, experience: 1 };
  let candidates = await rows("students", query, { projection });
  const skill = filters.skill ? normalizeSkill(filters.skill) : "";
  const role = filters.role ? normalizeRole(filters.role) : "";
  if (skill) candidates = candidates.filter((student) => (student.skills || []).some((value) => normalizeSkill(value) === skill));
  if (role) candidates = candidates.filter((student) => (student.roles || []).some((value) => normalizeRole(value) === role));
  return candidates;
}

export async function marketByCompany() {
  const jobs = await rows("opportunities"); const groups = new Map();
  for (const job of jobs) {
    const key = normalizeCompany(job.company); if (!groups.has(key)) groups.set(key, { company: job.company, openings: 0, roles: [], skills: new Map(), stipends: [], currency: job.stipendCurrency || "INR" });
    const group = groups.get(key); group.openings++; group.roles.push(job.title); for (const skill of job.skills || []) group.skills.set(normalizeSkill(skill), (group.skills.get(normalizeSkill(skill)) || 0) + 1); if (Number(job.stipendAmount) > 0) group.stipends.push(Number(job.stipendAmount));
  }
  return [...groups.values()].map((group) => ({ company: group.company, openings: group.openings, roles: group.roles, topSkills: [...group.skills].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([skill, count]) => ({ skill, count })), stipend: group.stipends.length ? { min: Math.min(...group.stipends), max: Math.max(...group.stipends), average: Math.round(group.stipends.reduce((a, b) => a + b, 0) / group.stipends.length), currency: group.currency } : null }));
}
