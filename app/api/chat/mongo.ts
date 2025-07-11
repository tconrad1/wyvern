import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const client = new MongoClient(uri);

let dbPromise: Promise<any> | null = null;

export async function getDb() {
  if (!dbPromise) {
    dbPromise = client.connect().then(() => client.db("wyvern"));
  }
  return dbPromise;
}
