import "dotenv/config";
import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;
let client;
let db;
let memory;

function matchesValue(actual, expected) {
  if (expected && typeof expected === "object" && "$in" in expected) return expected.$in.some((v) => String(actual) === String(v));
  return actual === expected;
}
function matches(doc, query = {}) { return Object.entries(query).every(([key, expected]) => matchesValue(doc[key], expected)); }
function project(doc, projection) {
  if (!projection) return { ...doc };
  const include = Object.entries(projection).filter(([, v]) => v === 1).map(([k]) => k);
  if (!include.length) return { ...doc };
  const out = {};
  for (const key of include) if (key in doc) out[key] = doc[key];
  if (projection._id !== 0 && "_id" in doc) out._id = doc._id;
  return out;
}

function makeMemoryDb() {
  const cols = new Map();
  const collection = (name) => {
    if (!cols.has(name)) cols.set(name, []);
    const data = cols.get(name);
    return {
      async countDocuments(query = {}) { return data.filter((x) => matches(x, query)).length; },
      async insertMany(docs) { data.push(...docs.map((x) => ({ ...x }))); },
      async insertOne(doc) { if (doc.uid && data.some((x) => x.uid === doc.uid && name === "students")) { const e = new Error("Duplicate uid"); e.code = 11000; throw e; } data.push({ ...doc }); return { insertedId: doc.id }; },
      async deleteOne(query) { const index = data.findIndex((x) => matches(x, query)); if (index < 0) return { deletedCount: 0 }; data.splice(index, 1); return { deletedCount: 1 }; },
      async findOne(query = {}, options = {}) { const row = data.find((x) => matches(x, query)); return row ? project(row, options.projection) : null; },
      find(query = {}, options = {}) {
        let rows = data.filter((x) => matches(x, query)).map((x) => project(x, options.projection));
        return {
          sort(sortSpec = {}) { const [[field, direction]] = Object.entries(sortSpec); rows.sort((a, b) => a[field] > b[field] ? direction : a[field] < b[field] ? -direction : 0); return this; },
          limit(n) { rows = rows.slice(0, n); return this; },
          async toArray() { return rows.map((x) => ({ ...x })); },
        };
      },
      async findOneAndUpdate(query, update, options = {}) { const index = data.findIndex((x) => matches(x, query)); if (index < 0) return null; data[index] = { ...data[index], ...(update.$set || {}) }; return options.returnDocument === "after" ? { ...data[index] } : null; },
      async createIndex() { return "memory-index"; },
    };
  };
  return { __memory: true, collection };
}

export async function connectMongo() {
  if (db || memory) return db || memory;
  const allowFallback = process.env.NODE_ENV !== "production";
  if (!uri || uri.startsWith("YOUR_")) {
    if (!allowFallback) throw new Error("MONGODB_URI is required in production. Refusing to start with an in-memory database.");
    memory = makeMemoryDb();
    console.warn("MONGODB_URI not configured — using development-only in-memory database. Data resets when the server stops.");
    return memory;
  }
  client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true } });
  try {
    await client.connect();
    db = client.db(process.env.MONGODB_DB_NAME || "skillbridge");
    await db.command({ ping: 1 });
    console.log("MongoDB connected");
    return db;
  } catch (error) {
    if (!allowFallback) throw new Error(`MongoDB connection failed in production: ${error.message}`);
    memory = makeMemoryDb();
    console.warn(`MongoDB unavailable — using development-only in-memory database: ${error.message}`);
    return memory;
  }
}

export function getDb() {
  if (!db && !memory) throw new Error("Database has not been connected");
  return db || memory;
}
