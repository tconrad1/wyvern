import { streamText, streamObject, zodSchema, tool } from "ai";
import { MongoClient, ObjectId } from "mongodb";
import { NextRequest } from "next/server";
import { getModelInfo } from "./modelRouter";
import { prompts } from "../../../scripts/prompt";
import { PlayerObject, MonsterObject } from "../../../scripts/dataTypes";
import weaviate from "weaviate-ts-client";
import z, { object } from "zod";

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



const mongoClient = new MongoClient(process.env.MONGODB_URI!);
const weaviateClient = weaviate.client({ scheme: "http", host: "localhost:8080" });

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
  try {
    const { campaignId, messages, model: modelName } = await req.json();
    if (!modelName) return new Response("Model not specified", { status: 400 });
    if (!campaignId) {
      return new Response("Campaign ID is required", { status: 400 });
    }

    const { model } = getModelInfo(modelName);
    await mongoClient.connect();
    const db = mongoClient.db("wyvern_ai");

    const latestMessage = messages[messages.length - 1]?.content;
    let docContext = "";

    try {
      const results = await weaviateClient.graphql.get()
        .withClassName("RuleContext")
        .withFields("text _additional { certainty }")
        .withNearText({ concepts: [latestMessage] })
        .withLimit(10)
        .do();
      const texts = results.data.Get.RuleContext?.map((r: any) => r.text) || [];
      docContext = JSON.stringify(texts);
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
    }

    const prompt = prompts(gameState, docContext).dm;

    // --- TOOL CALL HANDLERS ---
    const tools = {
      async updatePlayer({ id, data }: { id: string, data: any }) {
        const playersCol = db.collection<PlayerObject>("players");
        if (isValidPlayer(data)) {
          await playersCol.updateOne(getIdFilter(id), { $set: { ...data, _id: id, campaignId } }, { upsert: true });
        } else {
          console.warn(`Invalid player update: ${id}`, data);
        }
      },
      async updateMonster({ id, data }: { id: string, data: any }) {
        const monstersCol = db.collection<MonsterObject>("monsters");
        if (isValidMonster(data)) {
          await monstersCol.updateOne(getIdFilter(id), { $set: { ...data, _id: id, campaignId } }, { upsert: true });
        } else {
          console.warn(`Invalid monster update: ${id}`, data);
        }
      },
      async logCampaign({ narration, updates }: { narration: string, updates: any }) {
        await db.collection("campaign_log").insertOne({
          timestamp: new Date(),
          user_message: latestMessage,
          narration,
          updates_applied: updates || null,
        });
      }
    };

    // --- STREAM OBJECT WITH TOOLS ---
    const streamResult = streamText({
      model,
      messages: [
        { role: "system", content: prompt },
        ...messages,
      ],
      tools: {
        updatePlayer: tool({
          description: "Update a player's information in the campaign",
          parameters: playerSchema,
          execute: tools.updatePlayer
        }),
        updateMonster: tool({
          description: "Update a monster's information in the campaign",
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
    await mongoClient.close();
  }
}
