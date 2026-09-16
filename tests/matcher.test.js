import test from "node:test";
import assert from "node:assert/strict";
import { matchStudentToOpportunity, relatedOverlap, rankMatches } from "../server/matcher.js";
import { semanticSimilarity, parseStudentText, parseJobText, extractSkills } from "../server/ai.js";
import { normalizeSkill, normalizeRole } from "../server/taxonomy.js";

test("related skills are symmetric", () => {
  assert.equal(relatedOverlap(["javascript"], ["react"]), 1);
  assert.equal(relatedOverlap(["react"], ["javascript"]), 1);
});

test("shared aliases normalize consistently", () => {
  assert.equal(normalizeSkill("NodeJS"), "node.js");
  assert.equal(normalizeSkill("node"), "node.js");
  assert.equal(normalizeSkill("JS"), "javascript");
  assert.equal(normalizeRole("React Developer"), "frontend");
  assert.deepEqual([...extractSkills("JS NodeJS React PostgreSQL")].sort(), ["javascript", "node.js", "react", "sql"].sort());
});

test("semantic similarity is bounded", () => {
  const score = semanticSimilarity("React JavaScript frontend", "Frontend React developer");
  assert.ok(Number.isFinite(score));
  assert.ok(score >= 0 && score <= 1);
});

test("exact skills, evidence, and eligibility produce explainable match", () => {
  const student = { skills: ["react", "javascript", "git"], skillDetails: [{ name: "react", level: "comfortable" }, { name: "javascript", level: "advanced" }, { name: "git", level: "comfortable" }], interests: ["product"], roles: ["frontend"], experienceMonths: 12, preferredMode: "Hybrid", preferredLocations: ["Bengaluru"], year: 2, projects: [{ title: "Web app", description: "Frontend app", technologies: ["react", "javascript", "git"] }] };
  const opportunity = { company: "Nova", title: "Frontend Engineering Intern", description: "Build React interfaces", skills: ["react", "javascript", "git"], interests: ["product"], roles: ["frontend"], minExperienceMonths: 3, mode: "Hybrid", location: "Bengaluru", targetYears: [2, 3] };
  const result = matchStudentToOpportunity(student, opportunity);
  assert.equal(result.eligible, true);
  assert.equal(result.components.exactSkill, 100);
  assert.ok(result.components.skillConfidence >= 80);
  assert.ok(result.components.evidence > 0);
  assert.ok(Number.isFinite(result.score));
  assert.ok(result.explainability.formula.includes("personalization"));
});

test("experience and education requirements can make a candidate ineligible", () => {
  const result = matchStudentToOpportunity({ skills: ["python"], interests: ["ai"], experienceMonths: 1, preferredMode: "Remote", year: 1 }, { title: "ML Intern", description: "Machine learning work", skills: ["python", "machine learning"], interests: ["ai"], minExperienceMonths: 12, mode: "Remote", targetYears: [2] });
  assert.equal(result.eligible, false);
  assert.equal(result.components.experience, 8);
  assert.equal(result.components.education, 0);
});

test("company follow and activity provide bounded personalization", () => {
  const student = { skills: ["python"], roles: ["software engineer"], experienceMonths: 12, year: 2 };
  const opportunity = { company: "Nova", skills: ["python"], roles: ["software engineer"], minExperienceMonths: 3, targetYears: [2] };
  const base = matchStudentToOpportunity(student, opportunity);
  const personalized = matchStudentToOpportunity(student, opportunity, { follows: [{ company: "Nova" }], activity: [{ company: "Nova", type: "view" }, { company: "Nova", type: "apply" }] });
  assert.ok(personalized.score >= base.score);
  assert.ok(personalized.components.personalization > 0);
});

test("ranking prioritizes eligible matches", () => {
  const student = { skills: ["react"], experienceMonths: 6, year: 2 };
  const ranked = rankMatches(student, [{ title: "A", skills: ["react"], minExperienceMonths: 12, targetYears: [2] }, { title: "B", skills: ["react"], minExperienceMonths: 3, targetYears: [2] }]);
  assert.equal(ranked[0].opportunity.title, "B");
  assert.equal(ranked[0].eligible, true);
  assert.equal(ranked[1].eligible, false);
});

test("duration parsing converts years into months", () => {
  assert.equal(parseStudentText("I have 2 years of experience").experienceMonths, 24);
  assert.equal(parseJobText("minimum 3 years of experience").minExperienceMonths, 36);
});
