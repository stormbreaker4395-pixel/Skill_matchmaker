import test from "node:test";
import assert from "node:assert/strict";
import { matchStudentToOpportunity, relatedOverlap, rankMatches } from "../server/matcher.js";
import { semanticSimilarity, parseStudentText, parseJobText } from "../server/ai.js";

test("related skill mapping catches adjacent technologies", () => {
  assert.equal(relatedOverlap(["javascript"], ["react"]), 1);
});

test("semantic similarity is finite and bounded", () => {
  const score = semanticSimilarity("React JavaScript frontend", "Frontend React developer");
  assert.equal(Number.isFinite(score), true);
  assert.ok(score >= 0 && score <= 1);
});

test("exact skills and evidence produce an eligible explainable match", () => {
  const student = {
    skills: ["react", "javascript", "git"],
    skillDetails: [
      { name: "react", level: "comfortable" },
      { name: "javascript", level: "advanced" },
      { name: "git", level: "comfortable" },
    ],
    interests: ["product"],
    roles: ["frontend"],
    experienceMonths: 12,
    preferredMode: "Hybrid",
    preferredLocations: ["Bengaluru"],
    year: 2,
    projects: [{ title: "Web app", description: "Frontend app", technologies: ["react", "javascript", "git"] }],
  };
  const opportunity = {
    company: "Nova",
    title: "Frontend Engineering Intern",
    description: "Build React interfaces",
    skills: ["react", "javascript", "git"],
    interests: ["product"],
    roles: ["frontend"],
    minExperienceMonths: 3,
    mode: "Hybrid",
    location: "Bengaluru",
    targetYears: [2, 3],
  };
  const result = matchStudentToOpportunity(student, opportunity);
  assert.equal(result.eligible, true);
  assert.equal(result.components.exactSkill, 100);
  assert.ok(result.components.skillConfidence >= 80);
  assert.ok(result.components.evidence > 0);
  assert.ok(Number.isFinite(result.score));
  assert.ok(result.explainability.formula.includes("personalization"));
});

test("experience and education requirements can make a candidate ineligible", () => {
  const student = {
    skills: ["python"],
    interests: ["ai"],
    experienceMonths: 1,
    preferredMode: "Remote",
    year: 1,
  };
  const opportunity = {
    title: "ML Intern",
    description: "Machine learning work",
    skills: ["python", "machine learning"],
    interests: ["ai"],
    minExperienceMonths: 12,
    mode: "Remote",
    targetYears: [2],
  };
  const result = matchStudentToOpportunity(student, opportunity);
  assert.equal(result.eligible, false);
  assert.equal(result.components.experience, 8);
  assert.equal(result.components.education, 0);
  assert.ok(result.reasons[0].includes("eligibility"));
});

test("following a company adds a bounded positive personalization signal", () => {
  const student = { skills: ["python"], roles: ["software engineer"], experienceMonths: 12, year: 2 };
  const opportunity = { company: "Nova", skills: ["python"], roles: ["software engineer"], minExperienceMonths: 3, targetYears: [2] };
  const base = matchStudentToOpportunity(student, opportunity);
  const followed = matchStudentToOpportunity(student, opportunity, { follows: [{ company: "Nova" }] });
  assert.ok(followed.score >= base.score);
  assert.ok(followed.components.personalization > 0);
  assert.ok(followed.reasons.some((x) => x.includes("follow")));
});

test("recent activity adds personalization without breaking eligibility", () => {
  const student = { skills: ["react"], roles: ["frontend"], experienceMonths: 6, year: 2 };
  const opportunity = { company: "PixelForge", skills: ["react"], roles: ["frontend"], minExperienceMonths: 3, targetYears: [2] };
  const result = matchStudentToOpportunity(student, opportunity, {
    activity: [
      { company: "PixelForge", type: "view" },
      { company: "PixelForge", type: "apply" },
    ],
  });
  assert.equal(result.eligible, true);
  assert.ok(result.components.personalization > 0);
  assert.ok(result.reasons.some((x) => x.includes("activity")));
});

test("ranking prioritizes eligible candidates before ineligible matches", () => {
  const student = { skills: ["react"], experienceMonths: 6, year: 2 };
  const opportunities = [
    { title: "A", skills: ["react"], minExperienceMonths: 12, targetYears: [2] },
    { title: "B", skills: ["react"], minExperienceMonths: 3, targetYears: [2] },
  ];
  const ranked = rankMatches(student, opportunities);
  assert.equal(ranked[0].opportunity.title, "B");
  assert.equal(ranked[0].eligible, true);
  assert.equal(ranked[1].eligible, false);
});

test("local AI profile/job parsers return structured signals", () => {
  const profile = parseStudentText("Second-year CSE student with React and Python, wants frontend roles and has 8 months experience");
  assert.ok(profile.skills.length >= 2);
  assert.ok(profile.roles.includes("frontend"));
  assert.equal(profile.experienceMonths, 8);
  const job = parseJobText("Frontend developer with React and JavaScript, minimum 6 months experience");
  assert.ok(job.skills.includes("react"));
  assert.ok(job.roles.includes("frontend"));
  assert.equal(job.minExperienceMonths, 6);
});
