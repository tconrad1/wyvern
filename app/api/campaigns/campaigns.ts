import { MongoClient } from "mongodb";
import { NextRequest } from "next/server";

const client = new MongoClient(process.env.MONGODB_URI!);
const dbName = "wyvern_ai";

export async function GET() {
  await client.connect();
  const db = client.db(dbName);
  const campaigns = await db.collection("campaigns").find({}).toArray();

  return new Response(JSON.stringify(campaigns), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();

  if (!name) {
    return new Response("Missing campaign name", { status: 400 });
  }

  const campaignId = name.toLowerCase().replace(/\s+/g, "-");

  await client.connect();
  const db = client.db(dbName);
  const existing = await db.collection("campaigns").findOne({ _id: campaignId });

  if (existing) {
    return new Response("Campaign already exists", { status: 409 });
  }

  const newCampaign = {
    _id: campaignId,
    name,
    createdAt: new Date(),
  };

  await db.collection("campaigns").insertOne(newCampaign);

  return new Response(JSON.stringify(newCampaign), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
