import test from "node:test";
import assert from "node:assert/strict";
import {
  matchStudentToOpportunity,
  relatedOverlap,
} from "../server/matcher.js";
test("related skill mapping catches adjacent technologies", () => {
  assert.equal(relatedOverlap(["javascript"], ["react"]), 1);
});
test("exact skills dominate the recommendation score", () => {
  const student = {
    skills: ["react", "javascript", "git"],
    interests: ["product"],
    experienceMonths: 6,
    preferredMode: "Hybrid",
    experience: "frontend",
  };
  const opportunity = {
    title: "Frontend Engineering Intern",
    description: "Build React interfaces",
    skills: ["react", "javascript", "git"],
    interests: ["product"],
    minExperienceMonths: 3,
    mode: "Hybrid",
  };
  const result = matchStudentToOpportunity(student, opportunity);
  assert.ok(result.score >= 80);
  assert.equal(result.components.exactSkill, 100);
});
test("experience requirement reduces fit when unmet", () => {
  const student = {
    skills: ["python"],
    interests: ["ai"],
    experienceMonths: 1,
    preferredMode: "Remote",
    experience: "student",
  };
  const opportunity = {
    title: "ML Intern",
    description: "Machine learning work",
    skills: ["python", "machine learning"],
    interests: ["ai"],
    minExperienceMonths: 12,
    mode: "Remote",
  };
  const result = matchStudentToOpportunity(student, opportunity);
  assert.equal(result.components.experience, 8);
});
