const STOP = new Set([
  "the","and","for","with","from","that","this","into","your","you","are","our","will","have","has","not","but","can","who","all","any","their","they","them","about","work","working","using","use","job","role","intern","internship"
]);

const VOCAB_ALIASES = {
  javascript: ["javascript","js","ecmascript"],
  typescript: ["typescript","ts"],
  react: ["react","reactjs"],
  node: ["node","node.js","nodejs"],
  python: ["python"],
  sql: ["sql","mysql","postgresql","postgres","sqlite"],
  mongodb: ["mongodb","mongo"],
  machinelearning: ["machine learning","ml","predictive modeling"],
  dataanalysis: ["data analysis","analytics","data analytics"],
  frontend: ["frontend","front-end","ui development","web development"],
  backend: ["backend","back-end","server-side","api development"],
  uiux: ["ui/ux","ux","ui design","product design","figma"],
  cloud: ["cloud","aws","azure","gcp"],
  devops: ["devops","docker","kubernetes","ci/cd"],
  communication: ["communication","presentation","public speaking"],
  product: ["product management","product","research","roadmapping"],
};

const ROLE_MAP = [
  ["frontend", ["frontend developer","front end developer","react developer","ui developer","frontend"]],
  ["backend", ["backend developer","back end developer","server developer","api developer","backend"]],
  ["fullstack", ["full stack","fullstack","full-stack"]],
  ["data analyst", ["data analyst","business analyst","analytics"]],
  ["data scientist", ["data scientist","data science"]],
  ["ml engineer", ["machine learning engineer","ml engineer","ai engineer"]],
  ["software engineer", ["software engineer","software developer","sde"]],
  ["ui/ux designer", ["ui/ux","ux designer","product designer"]],
  ["product intern", ["product manager","product intern","product"]],
  ["cloud/devops", ["devops","cloud engineer","site reliability"]],
];

function normalizeText(input) {
  return String(input || "").toLowerCase().replace(/[^a-z0-9+#.\-\s]/g, " ");
}

function tokens(input) {
  return normalizeText(input)
    .split(/\s+/)
    .filter(Boolean)
    .filter((x) => !STOP.has(x))
    .map((x) => x.replace(/^[-.]+|[-.]+$/g, ""))
    .filter((x) => x.length > 1);
}

function tf(text) {
  const counts = new Map();
  for (const token of tokens(text)) counts.set(token, (counts.get(token) || 0) + 1);
  return counts;
}

function cosineSimilarity(aText, bText) {
  const a = tf(aText); const b = tf(bText);
  if (!a.size || !b.size) return 0;
  const vocab = new Set([...a.keys(), ...b.keys()]);
  let dot = 0; let na = 0; let nb = 0;
  for (const term of vocab) {
    const av = a.get(term) || 0; const bv = b.get(term) || 0;
    dot += av * bv; na += av * av; nb += bv * bv;
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function aliasHits(text) {
  const n = normalizeText(text);
  const hits = [];
  for (const [canonical, aliases] of Object.entries(VOCAB_ALIASES)) {
    if (aliases.some((alias) => n.includes(alias))) hits.push(canonical);
  }
  return [...new Set(hits)];
}

function semanticSimilarity(aText, bText) {
  const raw = cosineSimilarity(aText, bText);
  const aAliases = new Set(aliasHits(aText));
  const bAliases = new Set(aliasHits(bText));
  const union = new Set([...aAliases, ...bAliases]);
  let overlap = 0;
  for (const x of aAliases) if (bAliases.has(x)) overlap++;
  const concept = union.size ? overlap / union.size : 0;
  return Math.min(1, raw * 0.45 + concept * 0.55);
}

function extractSkills(text) {
  const hits = aliasHits(text);
  const readable = {
    machinelearning: "machine learning", dataanalysis: "data analysis", uiux: "ui/ux", fullstack: "full-stack"
  };
  return [...new Set(hits.map((x) => readable[x] || x))];
}

function detectRoles(text) {
  const n = normalizeText(text);
  return ROLE_MAP.filter(([, patterns]) => patterns.some((p) => n.includes(p))).map(([role]) => role);
}

function extractNumber(text, patterns, fallback = 0) {
  const n = normalizeText(text);
  for (const p of patterns) {
    const m = n.match(p);
    if (m) return Number(m[1]);
  }
  return fallback;
}

function parseStudentText(text) {
  const skills = extractSkills(text);
  const roles = detectRoles(text);
  const months = extractNumber(text, [/(\d+)\s*months?/, /(\d+)\s*year/]);
  const interests = [...new Set(roles.concat(skills.filter((x) => ["ai","product","cloud","dataanalysis","uiux"].includes(x))))];
  return { skills, roles, interests, experienceMonths: months, confidence: Math.min(0.95, 0.45 + skills.length * 0.08 + roles.length * 0.06) };
}

function parseJobText(text) {
  const skills = extractSkills(text);
  const roles = detectRoles(text);
  const minExperienceMonths = extractNumber(text, [/(?:minimum|min)\s*(\d+)\s*months?/, /(\d+)\s*months?\s*(?:of\s*)?experience/, /(\d+)\s*years?\s*(?:of\s*)?experience/]) || 0;
  return { skills, roles, interests: roles, minExperienceMonths, confidence: Math.min(0.96, 0.5 + skills.length * 0.07 + roles.length * 0.05) };
}

function skillRarity(skill, students) {
  const normalized = String(skill).toLowerCase();
  if (!students.length) return 0;
  const n = students.filter((s) => (s.skills || []).map((x) => String(x).toLowerCase()).includes(normalized)).length;
  return 1 - n / students.length;
}

function marketDemand(skill, opportunities) {
  const normalized = String(skill).toLowerCase();
  if (!opportunities.length) return 0;
  const n = opportunities.filter((o) => (o.skills || []).map((x) => String(x).toLowerCase()).includes(normalized)).length;
  return n / opportunities.length;
}

function skillpulse(student, students, opportunities) {
  const pool = students;
  const targetSkills = new Set((student.skills || []).map((x) => String(x).toLowerCase()));
  const similar = pool.map((s) => {
    const other = new Set((s.skills || []).map((x) => String(x).toLowerCase()));
    let common = 0;
    for (const x of targetSkills) if (other.has(x)) common++;
    const union = new Set([...targetSkills, ...other]).size || 1;
    return { student: s, similarity: common / union };
  }).filter((x) => x.student.id !== student.id && x.similarity >= 0.45);
  const candidateSkills = [...new Set(opportunities.flatMap((o) => o.skills || []))];
  const signals = candidateSkills.map((skill) => {
    const rarity = skillRarity(skill, pool);
    const demand = marketDemand(skill, opportunities);
    const owned = targetSkills.has(String(skill).toLowerCase());
    const fit = owned ? 1 : semanticSimilarity(skill, [...targetSkills].join(" "));
    const opportunityScore = rarity * (0.5 + demand * 0.5) * (owned ? 0.2 : Math.max(0.2, fit));
    return { skill, rarity: Math.round(rarity * 100), demand: Math.round(demand * 100), opportunityScore: Math.round(opportunityScore * 100) };
  }).sort((a, b) => b.opportunityScore - a.opportunityScore);
  const common = [...targetSkills].map((skill) => ({ skill, rarity: Math.round(skillRarity(skill, pool) * 100) })).sort((a, b) => a.rarity - b.rarity);
  return {
    similarStudents: similar.length,
    population: pool.length,
    commonSkills: common.slice(0, 5),
    differentiators: common.slice(-5).reverse(),
    suggestedSkills: signals.filter((x) => !targetSkills.has(String(x.skill).toLowerCase())).slice(0, 5),
  };
}

function careerGap(student, targetRole, opportunities) {
  const role = String(targetRole || "").toLowerCase();
  const relevant = opportunities.filter((o) => String(o.title || "").toLowerCase().includes(role) || (o.roles || []).some((r) => String(r).toLowerCase() === role));
  const wanted = [...new Set(relevant.flatMap((o) => o.skills || []))];
  const have = new Set((student.skills || []).map((x) => String(x).toLowerCase()));
  const gaps = wanted.filter((x) => !have.has(String(x).toLowerCase())).slice(0, 8);
  return { targetRole, sampleRoles: relevant.length, currentSkills: [...have], missingSkills: gaps };
}

function interviewQuestions(opportunity, student) {
  const role = opportunity?.title || "this role";
  const skills = opportunity?.skills || [];
  const questions = [
    `Why are you interested in ${role}?`,
    `Walk me through a project where you used ${skills[0] || "your main skill"}.`,
    `How would you debug a problem in a ${role.toLowerCase()} task?`,
    `What would you improve in your current technical skill set for this role?`,
    `Tell me about a time you had to learn something quickly.`,
    `How would you approach collaborating with a teammate when you disagree?`,
  ];
  if (skills.includes("sql")) questions.push("Write a SQL query to find the top 3 records by a metric.");
  if (skills.includes("python")) questions.push("What is the difference between a list and a set in Python, and when would you choose each?");
  if (skills.includes("react")) questions.push("What causes a React component to re-render, and how would you control unnecessary work?");
  return questions.slice(0, 8).map((question, i) => ({ id: i + 1, question }));
}

export { cosineSimilarity, semanticSimilarity, parseStudentText, parseJobText, skillpulse, careerGap, interviewQuestions, extractSkills, detectRoles };
