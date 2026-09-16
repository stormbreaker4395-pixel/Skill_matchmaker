const SKILL_ALIASES = {
  javascript: ["javascript", "js", "ecmascript"],
  typescript: ["typescript", "ts"],
  react: ["react", "reactjs"],
  "node.js": ["node", "node.js", "nodejs"],
  python: ["python"],
  sql: ["sql", "mysql", "postgresql", "postgres", "sqlite"],
  mongodb: ["mongodb", "mongo"],
  "machine learning": ["machine learning", "ml", "predictive modeling"],
  "data analysis": ["data analysis", "analytics", "data analytics"],
  frontend: ["frontend", "front-end", "ui development", "web development"],
  backend: ["backend", "back-end", "server-side", "api development"],
  "ui/ux": ["ui/ux", "ux", "ui design", "product design", "figma"],
  cloud: ["cloud", "aws", "azure", "gcp"],
  devops: ["devops", "docker", "kubernetes", "ci/cd"],
  communication: ["communication", "presentation", "public speaking"],
  product: ["product management", "product", "research", "roadmapping"],
  excel: ["excel", "microsoft excel"],
  git: ["git"],
  api: ["api", "apis", "rest api", "rest apis"],
};

const ROLE_ALIASES = {
  frontend: ["frontend", "front end", "frontend developer", "front end developer", "react developer", "ui developer"],
  backend: ["backend", "back end", "backend developer", "back end developer", "server developer", "node developer", "api developer"],
  fullstack: ["full stack", "fullstack", "full-stack"],
  "data analyst": ["data analyst", "business analyst", "analytics"],
  "data scientist": ["data scientist", "data science"],
  "ml engineer": ["ml engineer", "machine learning engineer", "ai engineer"],
  "software engineer": ["software engineer", "software developer", "sde"],
  "ui/ux designer": ["ui/ux", "ux designer", "product designer"],
  "product intern": ["product manager", "product intern", "product"],
  "cloud/devops": ["devops", "cloud engineer", "cloud/devops", "site reliability"],
};

const ROLE_LOOKUP = new Map();
for (const [canonical, aliases] of Object.entries(ROLE_ALIASES)) {
  for (const alias of aliases) ROLE_LOOKUP.set(alias, canonical);
}

const SKILL_LOOKUP = new Map();
for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
  for (const alias of aliases) SKILL_LOOKUP.set(alias, canonical);
}

export function normalizeSkill(value) {
  const clean = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  return SKILL_LOOKUP.get(clean) || clean;
}

export function normalizeRole(value) {
  const clean = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  return ROLE_LOOKUP.get(clean) || clean;
}

export function normalizeCompany(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeList(values, normalizer = normalizeSkill) {
  const list = Array.isArray(values) ? values : String(values || "").split(",");
  return [...new Set(list.map((value) => normalizer(value)).filter(Boolean))];
}

export function canonicalSkills() {
  return Object.keys(SKILL_ALIASES);
}

export function canonicalRoles() {
  return Object.keys(ROLE_ALIASES);
}

export { SKILL_ALIASES, ROLE_ALIASES };
