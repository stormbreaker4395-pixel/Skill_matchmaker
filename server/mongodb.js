import "dotenv/config";
import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is not set");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

export async function connectMongo() {
  if (db) return db;

  await client.connect();
  db = client.db(process.env.MONGODB_DB_NAME || "skillbridge");
  await db.command({ ping: 1 });

  console.log("MongoDB connected");
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error("MongoDB has not been connected");
  }

  return db;
}
