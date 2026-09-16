import { semanticSimilarity } from "./ai.js";
import { normalizeCompany, normalizeList, normalizeRole } from "./taxonomy.js";

const RELATED_PAIRS = [
  ["javascript", "react"], ["javascript", "node.js"], ["javascript", "typescript"], ["javascript", "express"],
  ["react", "next.js"], ["react", "frontend"], ["react", "ui/ux"], ["node.js", "backend"], ["node.js", "api"],
  ["node.js", "express"], ["python", "data analysis"], ["python", "machine learning"], ["python", "pandas"], ["python", "flask"],
  ["machine learning", "ai"], ["machine learning", "tensorflow"], ["machine learning", "pytorch"], ["machine learning", "data analysis"],
  ["sql", "database"], ["sql", "mysql"], ["sql", "postgresql"], ["figma", "ui/ux"], ["ui/ux", "product design"],
  ["cloud", "aws"], ["cloud", "azure"], ["cloud", "gcp"], ["cloud", "devops"], ["git", "github"], ["git", "version control"],
  ["communication", "presentation"], ["communication", "teamwork"], ["communication", "collaboration"], ["product", "analytics"],
];
const RELATED = Object.create(null);
for (const [a, b] of RELATED_PAIRS) {
  RELATED[a] ||= new Set(); RELATED[b] ||= new Set();
  RELATED[a].add(b); RELATED[b].add(a);
}

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : 0));
const cleanSkills = (values) => normalizeList(values);
const cleanRoles = (values) => normalizeList(values, normalizeRole);

function jaccard(a, b) {
  const A = new Set(a || []); const B = new Set(b || []); if (!A.size || !B.size) return 0;
  let intersection = 0; for (const x of A) if (B.has(x)) intersection++;
  return intersection / new Set([...A, ...B]).size;
}
function roleFit(studentRoles, opportunityRoles) {
  const student = cleanRoles(studentRoles), target = cleanRoles(opportunityRoles); if (!student.length || !target.length) return 0;
  const hits = student.filter((role) => target.includes(role)).length; return clamp(hits / Math.min(student.length, target.length));
}
function relatedOverlap(studentSkills, requiredSkills) {
  const student = cleanSkills(studentSkills), required = cleanSkills(requiredSkills); if (!required.length) return 0;
  return required.filter((req) => !student.includes(req) && [...(RELATED[req] || [])].some((related) => student.includes(related))).length / required.length;
}
function experienceFit(studentMonths = 0, requiredMonths = 0) { return !requiredMonths ? 1 : clamp(Number(studentMonths || 0) / Number(requiredMonths || 1)); }
function workModeFit(studentMode, opportunityMode) { if (!studentMode || !opportunityMode || String(opportunityMode).toLowerCase() === "flexible") return 1; return String(studentMode).toLowerCase() === String(opportunityMode).toLowerCase() ? 1 : 0.25; }
function educationFit(student, opportunity) { return !opportunity.targetYears?.length || opportunity.targetYears.map(Number).includes(Number(student.year)) ? 1 : 0; }
function locationFit(student, opportunity) {
  const preferences = normalizeList(student.preferredLocations, (x) => String(x).trim().toLowerCase()); if (!preferences.length || !opportunity.location) return 0.5;
  const location = String(opportunity.location).toLowerCase(); if (preferences.some((x) => location.includes(x) || x.includes(location))) return 1;
  if (preferences.includes("remote") && String(opportunity.mode || "").toLowerCase() === "remote") return 1; return 0.15;
}
function skillConfidence(student, required) {
  const details = new Map((student.skillDetails || []).map((x) => [cleanSkills([x.name])[0], String(x.level || "").toLowerCase()]));
  const levels = { beginner: 0.45, learning: 0.65, comfortable: 0.82, advanced: 0.94, expert: 1 }; if (!required.length) return 0;
  const owned = new Set(cleanSkills(student.skills)); let total = 0;
  for (const skill of required) if (owned.has(skill)) total += levels[details.get(skill)] || 0.7;
  return clamp(total / required.length);
}
function evidenceFit(student, required) {
  const projects = (student.projects || []).map((p) => `${p.title || ""} ${p.description || ""} ${(p.technologies || []).join(" ")}`).join(" ").toLowerCase();
  const experience = (student.experience || []).map((p) => `${p.title || ""} ${p.description || ""}`).join(" ").toLowerCase(); if (!required.length) return 0;
  let score = 0; for (const skill of required) { const value = String(skill).toLowerCase(); if (projects.includes(value)) score += 0.65; if (experience.includes(value)) score += 0.35; }
  return clamp(score / required.length);
}
function personalizationSignals(student, opportunity, activity = [], follows = []) {
  const company = normalizeCompany(opportunity.company); const relevant = activity.filter((x) => normalizeCompany(x.company) === company); const followed = follows.some((x) => normalizeCompany(x.company) === company);
  return { followed, activityBoost: clamp(Math.min(1, relevant.length / 3) * 0.7 + (followed ? 0.3 : 0)), roleHistory: jaccard(cleanRoles(student.roles), cleanRoles(opportunity.roles)) };
}
function textScore(student, opportunity) {
  const source = [...(student.skills || []), ...(student.interests || []), ...(student.roles || []), student.headline, student.bio, ...(student.preferredLocations || [])].filter(Boolean).join(" ");
  const target = [opportunity.title, opportunity.description, ...(opportunity.skills || []), ...(opportunity.interests || []), ...(opportunity.roles || []), opportunity.location].filter(Boolean).join(" ");
  return clamp(semanticSimilarity(source, target));
}

export function matchStudentToOpportunity(student, opportunity, context = {}) {
  const skills = cleanSkills(student.skills), required = cleanSkills(opportunity.skills);
  const exact = required.length ? required.filter((skill) => skills.includes(skill)).length / required.length : 0;
  const related = relatedOverlap(skills, required), confidence = skillConfidence(student, required), evidence = evidenceFit(student, required);
  const interest = jaccard(normalizeList(student.interests, (x) => String(x).trim().toLowerCase()), normalizeList(opportunity.interests, (x) => String(x).trim().toLowerCase()));
  const experience = experienceFit(student.experienceMonths, opportunity.minExperienceMonths), mode = workModeFit(student.preferredMode, opportunity.mode), education = educationFit(student, opportunity), location = locationFit(student, opportunity), roles = roleFit(student.roles, opportunity.roles), semantic = textScore(student, opportunity);
  const personalization = personalizationSignals(student, opportunity, context.activity || [], context.follows || []);
  const eligible = education === 1 && experience >= 1;
  const base = 0.24 * exact + 0.12 * related + 0.10 * confidence + 0.10 * evidence + 0.10 * roles + 0.08 * interest + 0.08 * experience + 0.05 * mode + 0.05 * education + 0.04 * location + 0.04 * semantic;
  const personalized = clamp(base + personalization.activityBoost * 0.05 + personalization.roleHistory * 0.03);
  const score = Math.round(personalized * 100);
  const exactMatches = required.filter((x) => skills.includes(x));
  const relatedMatches = required.filter((x) => !skills.includes(x) && [...(RELATED[x] || [])].some((r) => skills.includes(r)));
  const gaps = required.filter((x) => !skills.includes(x));
  const reasons = [];
  if (exactMatches.length) reasons.push(`${exactMatches.length}/${required.length} required skills matched`);
  if (relatedMatches.length) reasons.push(`Related skills cover ${relatedMatches.length} requirement${relatedMatches.length === 1 ? "" : "s"}`);
  if (confidence > 0.75) reasons.push("Strong skill confidence");
  if (evidence > 0.35) reasons.push("Project/experience evidence found");
  if (roles >= 0.5) reasons.push("Target role aligned");
  if (location >= 0.8) reasons.push("Location preference aligned");
  if (personalization.followed) reasons.push("You follow this company");
  if (personalization.activityBoost > 0.2) reasons.push("Recent activity with this company");
  if (!eligible) reasons.unshift("Below the current experience/education eligibility threshold");
  if (!reasons.length) reasons.push("Partial profile-to-role similarity");
  return {
    eligible, score,
    components: { exactSkill: Math.round(exact * 100), relatedSkill: Math.round(related * 100), skillConfidence: Math.round(confidence * 100), evidence: Math.round(evidence * 100), roleFit: Math.round(roles * 100), interest: Math.round(interest * 100), experience: Math.round(experience * 100), workMode: Math.round(mode * 100), education: Math.round(education * 100), location: Math.round(location * 100), semantic: Math.round(semantic * 100), personalization: Math.round(personalization.activityBoost * 100) },
    reasons, gaps, relatedMatches, personalization,
    explainability: { formula: "0.24E + 0.12R + 0.10C + 0.10V + 0.10Role + 0.08I + 0.08X + 0.05M + 0.05Edu + 0.04Loc + 0.04Sem + personalization", weights: { exactSkill: 24, relatedSkill: 12, skillConfidence: 10, evidence: 10, roleFit: 10, interest: 8, experience: 8, workMode: 5, education: 5, location: 4, semantic: 4 } },
  };
}

export function rankMatches(student, opportunities, context = {}) {
  return opportunities.map((opportunity) => ({ opportunity, ...matchStudentToOpportunity(student, opportunity, context) })).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score);
}

export { cleanSkills, cleanRoles, relatedOverlap, jaccard };
