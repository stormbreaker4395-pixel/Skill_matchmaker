import "dotenv/config";
import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;
let client;
let db;
let memory;

function matches(doc, query = {}) {
  return Object.entries(query).every(([key, value]) => doc[key] === value);
}

function makeMemoryDb() {
  const collections = new Map();
  return {
    __memory: true,
    collection(name) {
      if (!collections.has(name)) collections.set(name, []);
      const data = collections.get(name);
      return {
        async countDocuments(query = {}) { return data.filter((x) => matches(x, query)).length; },
        async insertMany(docs) { data.push(...docs.map((x) => ({ ...x }))); },
        async insertOne(doc) { data.push({ ...doc }); return { insertedId: doc.id }; },
        async findOne(query = {}, options = {}) {
          let rows = data.filter((x) => matches(x, query));
          if (options.sort) {
            const [[field, direction]] = Object.entries(options.sort);
            rows.sort((a, b) => (Number(a[field] || 0) - Number(b[field] || 0)) * direction);
          }
          return rows[0] ? { ...rows[0] } : null;
        },
        find(query = {}) {
          let rows = data.filter((x) => matches(x, query)).map((x) => ({ ...x }));
          return {
            sort(spec = {}) {
              const [[field, direction]] = Object.entries(spec);
              rows.sort((a, b) => (a[field] > b[field] ? direction : a[field] < b[field] ? -direction : 0));
              return this;
            },
            async toArray() { return rows; },
          };
        },
        async findOneAndUpdate(query, update, options = {}) {
          const index = data.findIndex((x) => matches(x, query));
          if (index < 0) return null;
          data[index] = { ...data[index], ...(update.$set || {}) };
          return options.returnDocument === "after" ? { ...data[index] } : null;
        },
      };
    },
  };
}

export async function connectMongo() {
  if (db || memory) return db || memory;
  if (!uri || uri.startsWith("YOUR_")) {
    memory = makeMemoryDb();
    console.warn("MONGODB_URI not configured — using local in-memory database. Data resets when the server stops.");
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
    memory = makeMemoryDb();
    console.warn(`MongoDB unavailable (${error.message}) — using local in-memory database.`);
    return memory;
  }
}

export function getDb() {
  if (!db && !memory) throw new Error("Database has not been connected");
  return db || memory;
}
