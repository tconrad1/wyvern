import { NextRequest } from "next/server";
import { MongoClient } from "mongodb";
import slugify from "slugify";

const mongoClient = new MongoClient(process.env.MONGODB_URI!);
const db = mongoClient.db("wyvern_ai");
const campaigns = db.collection("campaigns");

export async function GET() {
  const all = await campaigns.find({}).sort({ createdAt: -1 }).toArray();
  return Response.json(all);
}

export async function POST(req: NextRequest) {
  const { name, password } = await req.json();
  if (!name) return new Response("Name required", { status: 400 });

  const slug = slugify(name.toLowerCase(), { lower: true });

  const exists = await campaigns.findOne({ _id: slug });
  if (exists) return new Response("Campaign already exists", { status: 409 });

  await campaigns.insertOne({
    _id: slug,
    name,
    createdAt: new Date(),
    ...(password ? { password } : {}),
  });

  return Response.json({ _id: slug, name });
}
