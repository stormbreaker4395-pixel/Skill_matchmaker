import "dotenv/config";
import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;
let client;
let db;
let memory;

export async function connectMongo() {
  if (db || memory) return db || memory;
  if (!uri || uri.startsWith("YOUR_")) {
    memory = { __memory: true };
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
    console.warn(`MongoDB unavailable (${error.message}) — using local in-memory database.`);
    memory = { __memory: true };
    return memory;
  }
}

export function getDb() {
  if (!db && !memory) throw new Error("Database has not been connected");
  return db || memory;
}
export function isMemoryDb() { return Boolean(memory && !db); }
