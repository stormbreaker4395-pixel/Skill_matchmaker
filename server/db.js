import fs from "node:fs";
import path from "node:path";
const dir = path.resolve(process.cwd(), "server/data");
const file = path.join(dir, "skillbridge.json");
fs.mkdirSync(dir, { recursive: true });
const initial = {
  nextStudentId: 2,
  nextOpportunityId: 5,
  students: [
    {
      id: 1,
      name: "Aarav Mehta",
      headline: "Computer Science student · Full-stack & AI enthusiast",
      skills: ["javascript", "react", "python", "sql", "git"],
      interests: ["ai", "product", "startups"],
      experienceMonths: 8,
      preferredMode: "Hybrid",
      bio: "Builds practical web products and enjoys turning data into useful decisions.",
    },
  ],
  opportunities: [
    {
      id: 1,
      company: "Nova Labs",
      title: "AI Product Intern",
      description:
        "Prototype AI-assisted product features, work with product metrics, and ship experiments with engineers.",
      skills: ["python", "machine learning", "sql", "product"],
      interests: ["ai", "product", "startups"],
      minExperienceMonths: 6,
      mode: "Hybrid",
      location: "Bengaluru",
      stipend: "₹20,000 / month",
    },
    {
      id: 2,
      company: "PixelForge",
      title: "Frontend Engineering Intern",
      description:
        "Build polished React interfaces, collaborate with designers, and improve accessibility and performance.",
      skills: ["javascript", "react", "git", "ui/ux"],
      interests: ["product", "design", "startups"],
      minExperienceMonths: 3,
      mode: "On-site",
      location: "Bengaluru",
      stipend: "₹18,000 / month",
    },
    {
      id: 3,
      company: "DataMint",
      title: "Data Analytics Intern",
      description:
        "Use SQL and Python to clean datasets, automate reports, and communicate insights to business teams.",
      skills: ["python", "sql", "data analysis", "excel"],
      interests: ["analytics", "business", "ai"],
      minExperienceMonths: 4,
      mode: "Remote",
      location: "India",
      stipend: "₹15,000 / month",
    },
    {
      id: 4,
      company: "CloudNest",
      title: "Backend & Cloud Intern",
      description:
        "Develop APIs and lightweight services, learn cloud deployment, and help improve reliability.",
      skills: ["node.js", "javascript", "api", "cloud", "git"],
      interests: ["cloud", "devops", "startups"],
      minExperienceMonths: 6,
      mode: "Flexible",
      location: "Remote",
      stipend: "₹22,000 / month",
    },
  ],
};
function load() {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(initial, null, 2));
    return structuredClone(initial);
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return structuredClone(initial);
  }
}
function save(data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
export function listStudents() {
  return load().students;
}
export function getStudent(id) {
  return load().students.find((s) => s.id === id) || null;
}
export function createStudent(data) {
  const db = load();
  const student = {
    id: db.nextStudentId++,
    name: data.name,
    headline: data.headline || "",
    skills: data.skills || [],
    interests: data.interests || [],
    experienceMonths: Number(data.experienceMonths || 0),
    preferredMode: data.preferredMode || "Flexible",
    bio: data.bio || "",
  };
  db.students.unshift(student);
  save(db);
  return student;
}
export function updateStudent(id, data) {
  const db = load(),
    index = db.students.findIndex((s) => s.id === id);
  if (index < 0) return null;
  db.students[index] = {
    ...db.students[index],
    ...data,
    id,
    experienceMonths: Number(data.experienceMonths || 0),
  };
  save(db);
  return db.students[index];
}
export function listOpportunities() {
  return load().opportunities;
}
export function createOpportunity(data) {
  const db = load();
  const opportunity = {
    id: db.nextOpportunityId++,
    company: data.company,
    title: data.title,
    description: data.description,
    skills: data.skills || [],
    interests: data.interests || [],
    minExperienceMonths: Number(data.minExperienceMonths || 0),
    mode: data.mode || "Flexible",
    location: data.location || "Remote",
    stipend: data.stipend || "Unpaid / Not specified",
  };
  db.opportunities.unshift(opportunity);
  save(db);
  return opportunity;
}
