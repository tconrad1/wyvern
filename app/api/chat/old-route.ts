import { streamText, streamObject, zodSchema, tool } from "ai";
import { MongoClient, ObjectId, Db } from "mongodb";
import { NextRequest } from "next/server";
import { getModelInfo } from "./modelRouter";
import { prompts } from "../../../scripts/prompt";
import { PlayerObject, MonsterObject } from "../../../scripts/dataTypes";
import z, { object } from "zod";
import {getDB} from "./mongo";
import weaviate, { WeaviateClient, ApiKey } from "weaviate-client"; 
import {getWeaviateSingleton} from './weaviateSingleton'
import { convertToolsToGemini } from "./toolCallingUtility";


const classSchema = z.object({
  className: z.string(),
  subclassName: z.string().optional(),
  level: z.number().optional(),
  primaryClass: z.boolean().optional(),
});
const playerSchema = z.object({
      hp: z.number(),
      name: z.string(),
      status: z.string().optional(),
      class: z.array(classSchema).optional(),
      level: z.number().optional(),
      species: z.string().optional(),
      spells: z.array(z.string()).optional(),
      inventory: z.array(z.string()).optional(),
      spellSlots: z.object({
        level1: z.number().optional(),
        level2: z.number().optional(),
        level3: z.number().optional(),
        level4: z.number().optional(),
        level5: z.number().optional(),
        level6: z.number().optional(),
        level7: z.number().optional(),
        level8: z.number().optional(),
        level9: z.number().optional(),
      }).optional(),
      background: z.string().optional(),
      alignment: z.string().optional(),
      feats: z.array(z.string()).optional(),
    })
const monsterSchema = z.object({
  type: z.string(),
  hp: z.number(),
  status: z.string().optional(),
  class: classSchema.optional(),
});

const myZodSchema = z.object({
  players: z.record(
    playerSchema
  ),
  monsters: z.record(
    z.object({
      type: z.string(),
      hp: z.number(),
      status: z.string().optional(),
      class: classSchema.optional(),
    })
  ),
  campaignLog: z.array(z.string())

});




// const weaviateClient = weaviate.client({ scheme: "http", host: "localhost:8080" });

function cleanChunk(chunk: string): string {
  return chunk
    .replace(/\\n/g, "\n")            // convert \n to real line breaks
    .replace(/\\\//g, "/")            // allow escaped slashes
    .replace(/(?<!\\)\//g, "")        // remove raw slashes
    .replace(/```(?:json)?/g, "")     // strip ``` and ```json
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ""); // strip bad chars
}

function getIdFilter(id: string): { _id: ObjectId | string } {
  return ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
}

function isValidPlayer(player: PlayerObject): boolean {
  return player && typeof player.hp === "number";
}

function isValidMonster(monster: MonsterObject): boolean {
  return monster && typeof monster.hp === "number" && typeof monster.type === "string";
}

export async function POST(req: NextRequest) {
  let mongoClient: MongoClient ; 
  let db: Db ; 
  let weaviateClient: WeaviateClient;
  try {
    // Establish connection for this request
    
   const dbObject = await getDB();
    mongoClient = dbObject.mongoClient;
    db = dbObject.db;


    if (!mongoClient || !db) {
      console.error("Failed to connect to MongoDB within POST handler");
      return new Response("Database connection failed", { status: 500 });
    }

   

    // Ping to verify connection (optional, but good for debugging)
    try {
      await db.admin().ping();
      // console.log("MongoDB connection verified."); // For debugging
    } catch (error) {
      console.error("MongoDB ping error after connection:", error);
      // Depending on your error handling, you might want to return an error here
    }
      // Get the Weaviate client using the singleton
    weaviateClient = await getWeaviateSingleton();

    try {
      await weaviateClient.isLive();
      console.log("Weaviate connection verified.");
    } catch (weaviateErr) {
      console.error("Weaviate liveness check failed:", weaviateErr);
    }
    const { campaignId, messages, model: modelName } = await req.json();
    if (!modelName) return new Response("Model not specified", { status: 400 });
    if (!campaignId) {
      return new Response("Campaign ID is required", { status: 400 });
    }

    const { model } = getModelInfo(modelName);

    








    const latestMessage = messages[messages.length - 1]?.content;
    let docContext = "";
    
    try {
      
    
      const result = await weaviateClient.collections
    .get("RuleContext")
    .query
    .nearText([latestMessage], { limit: 10, returnMetadata: ["certainty"] })
    .then(res => res); // `res.objects` is your result list

  const texts = result.objects.map(obj => obj.properties?.text).filter(Boolean);
  const docContext = JSON.stringify(texts);

    } catch (err) {
      console.error("Weaviate search failed:", err);
    }

    let gameState = { players: {}, monsters: {} } as any;
    try {
      const [players, monsters] = await Promise.all([
        db.collection("players").find({ campaignId }).toArray(),
        db.collection("monsters").find({ campaignId }).toArray()
      ]);

      gameState = {
        players: Object.fromEntries(players.map(p => [p._id.toString(), p])),
        monsters: Object.fromEntries(monsters.map(m => [m._id.toString(), m])),
      };
    } catch (err) {
      console.error("Game state load failed:", err);
      console.warn("Using a new empty game state. This may lead to unexpected behavior.");

      // Ensure collections exist if they are being accessed for the first time
      await db.createCollection("players").catch(console.warn);
      await db.createCollection("monsters").catch(console.warn);
      await db.createCollection("campaign_log").catch(console.warn);
      gameState = { players: {}, monsters: {} };
    }

    const prompt = prompts(gameState, docContext).dm;
    await db.collection("players").insertOne({ _id: new ObjectId(), hp: 10 });

    // --- TOOL CALL HANDLERS ---
    const tools = {
      async updatePlayer({ id, data }: { id: string, data: any }) {
        try {
          console.log("🛠️ updatePlayer called:", id, data);

          const playersCol = db!.collection<PlayerObject>("players"); // Use db! because it's guaranteed to be connected here
          if (isValidPlayer(data)) {
            await playersCol.updateOne(getIdFilter(id), { $set: { ...data, _id: id, campaignId } }, { upsert: true });
          } else {
            console.warn(`Invalid player update: ${id}`, data);
          }
        } catch (err) {
          console.error("Failed to update player:", err);
          // Re-create collection only if the error specifically indicates it doesn't exist
          if (err instanceof Error && err.message.includes("collection not found")) {
            const playersCol = await db!.createCollection("players");
            await playersCol.insertOne({ _id: id, ...data, campaignId });
          } else {
            console.warn("Using a new empty player object. This may lead to unexpected behavior.");
          }
        }
      },
      async updateMonster({ id, data }: { id: string, data: any }) {
        try {
            console.log("🛠️ updateMonster called:", id, data);

          const monstersCol = db!.collection<MonsterObject>("monsters"); // Use db!
          if (isValidMonster(data)) {
            await monstersCol.updateOne(getIdFilter(id), { $set: { ...data, _id: id, campaignId } }, { upsert: true });
          } else {
            console.warn(`Invalid monster update: ${id}`, data);
          }
        } catch (err) {
          console.error("Failed to update monster:", err);
          if (err instanceof Error && err.message.includes("collection not found")) {
            const monstersCol = await db!.createCollection("monsters");
            await monstersCol.insertOne({ _id: id, ...data, campaignId });
          } else {
            console.warn("Using a new empty monster object. This may lead to unexpected behavior.");
          }
        }
      },
      async logCampaign({ narration, updates }: { narration: string, updates: any }) {
        console.log("Update logCampaign called with " , narration, updates);

        await db!.collection("campaign_log").insertOne({ // Use db!
          timestamp: new Date(),
          user_message: latestMessage,
          narration,
          updates_applied: updates || null,
        });
      }
    };
   

    
    // --- STREAM OBJECT WITH TOOLS ---
    const streamResult = await streamText({
      model:model,
      messages: [
        { role: "system", content: prompt },
        ...messages,
      ],
      tools: {
        updatePlayer: tool({
          description: "Update or create a player's information in the campaign and playersheet",
          parameters: playerSchema,
          execute: tools.updatePlayer
        }),
        updateMonster: tool({
          description: "Update or create a monster's information in the campaign",
          parameters: monsterSchema,
          execute: tools.updateMonster
        }),
        logCampaign: tool({
          description: "Update the log of our campaign, with both narration and any updates to the game state",
          parameters: z.object({
            narration: z.string(),
            updates: z.any().optional(),
          }),
          execute: tools.logCampaign
        }),
      },
    });
     
    // Stream the response to the client
    const textStream = streamResult.textStream;
    if (textStream instanceof ReadableStream) {
      return new Response(textStream, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Transfer-Encoding": "chunked",
          "Cache-Control": "no-cache",
        },
      });
    } else if (textStream && typeof textStream[Symbol.asyncIterator] === "function") {
      return new Response(
        new ReadableStream({
          async pull(controller) {
            for await (const chunk of textStream as AsyncIterable<Uint8Array | string>) {
              controller.enqueue(typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk);
            }
            controller.close();
          }
        }),
        {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Transfer-Encoding": "chunked",
            "Cache-Control": "no-cache",
          },
        }
      );
    } else {
      return new Response("Internal Server Error: Invalid textStream", { status: 500 });
    }
  
  } catch (err) {
    console.error("Fatal error in POST route:", err);
    return new Response("Internal Server Error", { status: 500 });
  } finally {
    // Only close if a client was actually connected for this request
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}

