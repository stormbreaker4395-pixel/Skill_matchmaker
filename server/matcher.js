const RELATED = {
  javascript: ["react", "node.js", "typescript", "express"],
  react: ["javascript", "next.js", "frontend", "ui/ux"],
  "node.js": ["javascript", "express", "backend", "api"],
  python: ["data analysis", "machine learning", "pandas", "flask"],
  "machine learning": [
    "python",
    "ai",
    "data analysis",
    "tensorflow",
    "pytorch",
  ],
  sql: ["database", "mysql", "postgresql", "sqlite"],
  figma: ["ui/ux", "product design", "wireframing"],
  "ui/ux": ["figma", "product design", "wireframing"],
  "data analysis": ["python", "sql", "pandas", "excel"],
  cloud: ["aws", "azure", "gcp", "devops"],
  aws: ["cloud", "devops"],
  git: ["github", "version control", "open source"],
  communication: ["presentation", "teamwork", "collaboration"],
  product: ["product management", "research", "analytics"],
};
function cleanList(values) {
  return [
    ...new Set(
      (values || []).map((v) => String(v).trim().toLowerCase()).filter(Boolean),
    ),
  ];
}
function jaccard(a, b) {
  const A = new Set(cleanList(a)),
    B = new Set(cleanList(b));
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / new Set([...A, ...B]).size;
}
function relatedOverlap(studentSkills, requiredSkills) {
  const student = cleanList(studentSkills),
    required = cleanList(requiredSkills);
  if (!required.length) return 0;
  let matched = 0;
  for (const req of required) {
    if (student.includes(req)) continue;
    const aliases = RELATED[req] || [];
    if (aliases.some((alias) => student.includes(alias))) matched++;
  }
  return matched / required.length;
}
function keywordSimilarity(student, opportunity) {
  const source = cleanList([
    ...(student.skills || []),
    ...(student.interests || []),
    student.experience || "",
  ]);
  const target = cleanList([
    opportunity.title,
    opportunity.description,
    ...(opportunity.skills || []),
    ...(opportunity.interests || []),
  ]);
  return jaccard(source, target);
}
function experienceFit(studentMonths = 0, requiredMonths = 0) {
  if (!requiredMonths) return 1;
  if (studentMonths >= requiredMonths) return 1;
  return Math.max(0, studentMonths / requiredMonths);
}
function workModeFit(studentMode, opportunityMode) {
  if (!studentMode || !opportunityMode || opportunityMode === "Flexible")
    return 1;
  return studentMode.toLowerCase() === opportunityMode.toLowerCase() ? 1 : 0.25;
}
function matchStudentToOpportunity(student, opportunity) {
  const skills = cleanList(student.skills),
    required = cleanList(opportunity.skills),
    interests = cleanList(student.interests),
    targetInterests = cleanList(opportunity.interests);
  const exactSkill = required.length
      ? skills.filter((s) => required.includes(s)).length / required.length
      : 0,
    relatedSkill = relatedOverlap(skills, required),
    interest = jaccard(interests, targetInterests),
    experience = experienceFit(
      Number(student.experienceMonths || 0),
      Number(opportunity.minExperienceMonths || 0),
    ),
    mode = workModeFit(student.preferredMode, opportunity.mode),
    text = keywordSimilarity(student, opportunity);
  const components = {
    exactSkill: Math.round(exactSkill * 100),
    relatedSkill: Math.round(relatedSkill * 100),
    interest: Math.round(interest * 100),
    experience: Math.round(experience * 100),
    workMode: Math.round(mode * 100),
    textSimilarity: Math.round(text * 100),
  };
  const score = Math.round(
    exactSkill * 50 +
      relatedSkill * 15 +
      interest * 15 +
      experience * 10 +
      mode * 5 +
      text * 5,
  );
  const reasons = [];
  const exactMatches = required.filter((s) => skills.includes(s)),
    relatedMatches = required.filter(
      (s) =>
        !skills.includes(s) &&
        (RELATED[s] || []).some((a) => skills.includes(a)),
    );
  if (exactMatches.length)
    reasons.push(
      `Matched ${exactMatches.length} of ${required.length} required skills`,
    );
  if (relatedMatches.length)
    reasons.push(
      `Related skills helped: ${relatedMatches.slice(0, 2).join(", ")}`,
    );
  if (components.interest >= 50)
    reasons.push(`Strong interest overlap (${components.interest}%)`);
  if (components.experience === 100) reasons.push("Experience requirement met");
  if (components.workMode === 100) reasons.push("Work mode preference aligned");
  if (!reasons.length)
    reasons.push("Baseline match from the profile and opportunity text");
  return { score, components, reasons };
}
function rankMatches(student, opportunities) {
  return opportunities
    .map((opportunity) => ({
      opportunity,
      ...matchStudentToOpportunity(student, opportunity),
    }))
    .sort((a, b) => b.score - a.score);
}
export {
  cleanList,
  jaccard,
  relatedOverlap,
  matchStudentToOpportunity,
  rankMatches,
};
