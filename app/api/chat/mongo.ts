import { MongoClient, Db } from "mongodb";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

const MONGODB_URI = process.env.MONGODB_URI; // Make sure this is set in your .env.local

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env.local"
  );
}

export async function getDB() {
  if (cachedClient && cachedDb) {
    try {
      await cachedDb.admin().ping();
      return { mongoClient: cachedClient, db: cachedDb };
    } catch (err) {
      console.warn("Cached Mongo client found but ping failed, reconnecting...");
      // fall through to reconnect
    }
  }

  const client = new MongoClient(MONGODB_URI!);
  await client.connect();
  const db = client.db(new URL(MONGODB_URI!).pathname.substring(1));
  cachedClient = client;
  cachedDb = db;

  return { mongoClient: client, db: db };
}
