import { getDb } from "./mongodb.js";

const initial = {
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

function withoutMongoId(document) {
  if (!document) return null;
  const { _id, ...data } = document;
  return data;
}

export async function seedDatabase() {
  const db = getDb();
  const students = db.collection("students");
  const opportunities = db.collection("opportunities");

  if ((await students.countDocuments()) === 0) {
    await students.insertMany(initial.students);
  }

  if ((await opportunities.countDocuments()) === 0) {
    await opportunities.insertMany(initial.opportunities);
  }
}

export async function listStudents(uid) {
  const db = getDb();
  return (
    await db
      .collection("students")
      .find({ uid })
      .sort({ id: 1 })
      .toArray()
  ).map(withoutMongoId);
}

export async function getStudent(id, uid) {
  const db = getDb();
  return withoutMongoId(
    await db.collection("students").findOne({ id, uid }),
  );
}

export async function ensureStudentForUser(uid, email = "") {
  const db = getDb();
  const collection = db.collection("students");

  const existing = await collection.findOne({ uid });
  if (existing) return withoutMongoId(existing);

  const last = await collection.findOne({}, { sort: { id: -1 } });
  const fallbackName =
    String(email || "Student")
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) ||
    "Student";

  const student = {
    id: Number(last?.id || 0) + 1,
    uid,
    name: fallbackName,
    headline: "Student",
    skills: [],
    interests: [],
    experienceMonths: 0,
    preferredMode: "Flexible",
    bio: "",
  };

  await collection.insertOne(student);
  return withoutMongoId(student);
}

export async function createStudent(data, uid) {
  const db = getDb();
  const collection = db.collection("students");
  const last = await collection.findOne({}, { sort: { id: -1 } });

  const student = {
    id: Number(last?.id || 0) + 1,
    uid,
    name: data.name,
    headline: data.headline || "",
    skills: Array.isArray(data.skills) ? data.skills : [],
    interests: Array.isArray(data.interests) ? data.interests : [],
    experienceMonths: Number(data.experienceMonths || 0),
    preferredMode: data.preferredMode || "Flexible",
    bio: data.bio || "",
  };

  await collection.insertOne(student);
  return student;
}

export async function updateStudent(id, data, uid) {
  const db = getDb();
  const collection = db.collection("students");

  const update = {
    name: data.name,
    headline: data.headline || "",
    skills: Array.isArray(data.skills) ? data.skills : [],
    interests: Array.isArray(data.interests) ? data.interests : [],
    experienceMonths: Number(data.experienceMonths || 0),
    preferredMode: data.preferredMode || "Flexible",
    bio: data.bio || "",
  };

  const result = await collection.findOneAndUpdate(
    { id, uid },
    { $set: update },
    { returnDocument: "after" },
  );

  return withoutMongoId(result);
}

export async function listOpportunities() {
  const db = getDb();
  return (
    await db
      .collection("opportunities")
      .find({})
      .sort({ id: -1 })
      .toArray()
  ).map(withoutMongoId);
}

export async function getOpportunity(id) {
  const db = getDb();
  return withoutMongoId(
    await db.collection("opportunities").findOne({ id }),
  );
}

export async function createOpportunity(data) {
  const db = getDb();
  const collection = db.collection("opportunities");
  const last = await collection.findOne({}, { sort: { id: -1 } });

  const opportunity = {
    id: Number(last?.id || 0) + 1,
    company: data.company,
    title: data.title,
    description: data.description,
    skills: Array.isArray(data.skills) ? data.skills : [],
    interests: Array.isArray(data.interests) ? data.interests : [],
    minExperienceMonths: Number(data.minExperienceMonths || 0),
    mode: data.mode || "Flexible",
    location: data.location || "Remote",
    stipend: data.stipend || "Unpaid / Not specified",
  };

  await collection.insertOne(opportunity);
  return opportunity;
}
