import { streamText, tool } from "ai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { MongoClient, ObjectId, Db, Filter } from "mongodb";
import { NextRequest } from "next/server";
import z from "zod";

import { getModelInfo } from "./modelRouter";
import { getDB } from "./mongo";
import { getWeaviateSingleton } from "./weaviateSingleton";
import { convertToolsToGemini } from "./toolCallingUtility";
import { prompts } from "../../../scripts/prompt";
import { PlayerObject, MonsterObject } from "../../../scripts/dataTypes";
import { GoogleGenerativeAI, FunctionDeclaration, Content } from '@google/generative-ai';
//fix gameState issue 
// === Schemas ===
const classSchema = z.object({
  className: z.string(),
  subclassName: z.string().optional(),
  level: z.number().optional(),
  primaryClass: z.boolean().optional(),
});
// interface GameState {
//   players: Record<string, PlayerObject>;
//   monsters: Record<string, MonsterObject>;
// }
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
});

const monsterSchema = z.object({
  type: z.string(),
  hp: z.number(),
  status: z.string().optional(),
  class: classSchema.optional(),
});

// Utility to build MongoDB _id filter correctly
function getIdFilter(id: string | ObjectId): Filter<Document> {
  if (typeof id === "string" && ObjectId.isValid(id)) return { _id: new ObjectId(id) };
  if (id instanceof ObjectId) return { _id: id };
  return { _id: id as any }; // for custom string IDs
}

function isValidPlayer(player: PlayerObject): boolean {
  return player && typeof player.hp === "number";
}

function isValidMonster(monster: MonsterObject): boolean {
  return monster && typeof monster.hp === "number" && typeof monster.type === "string";
}

// Main handler
export async function POST(req: NextRequest) {
  let mongoClient: MongoClient | undefined;

  try {
    const { mongoClient: client, db } = await getDB();
    mongoClient = client;

    const weaviate = await getWeaviateSingleton();

    const { campaignId, messages, model: modelName } = await req.json();
    if (!modelName || !campaignId)
      return new Response("Missing model or campaignId", { status: 400 });

    const { model, provider } = getModelInfo(modelName);
    const isGemini = provider === "gemini";

    const latestMessage = messages[messages.length - 1]?.content ?? "";
    let docContext = "";

    try {
      const result = await weaviate.collections
        .get("RuleContext")
        .query.nearText([latestMessage], { limit: 10, returnMetadata: ["certainty"] });

      docContext = JSON.stringify(result.objects.map(obj => obj.properties?.text).filter(Boolean));
    } catch (err) {
      console.error("Weaviate query failed:", err);
    }

    // Load game state from MongoDB
    let gameState : any = { players: {}, monsters: {} };
    try {
      const [players, monsters] = await Promise.all([
        db.collection("players").find({ campaignId }).toArray(),
        db.collection("monsters").find({ campaignId }).toArray(),
      ]);

      gameState = {
        players: Object.fromEntries(players.map(p => [p._id.toString(), p])),
        monsters: Object.fromEntries(monsters.map(m => [m._id.toString(), m])),
      };
    } catch (err) {
      console.warn("Using new empty game state:", err);
      await Promise.all([
        db.createCollection("players").catch(() => {}),
        db.createCollection("monsters").catch(() => {}),
        db.createCollection("campaign_log").catch(() => {}),
      ]);
    }

    const prompt = prompts(gameState, docContext).dm;

    // Define tool functions
    const tools = {
      async updatePlayer({ id, data }) {
        const col = db.collection("players");
        if (isValidPlayer(data)) {
          await col.updateOne(getIdFilter(id), { $set: { ...data, campaignId } }, { upsert: true });
        }
      },
      async updateMonster({ id, data }) {
        const col = db.collection("monsters");
        if (isValidMonster(data)) {
          await col.updateOne(getIdFilter(id), { $set: { ...data, campaignId } }, { upsert: true });
        }
      },
      async logCampaign({ narration, updates }) {
        await db.collection("campaign_log").insertOne({
          timestamp: new Date(),
          user_message: latestMessage,
          narration,
          updates_applied: updates || null,
        });
      },
      async RollDie({sides, advantage, disadvantage, offset}){
        let roll;
        if ((advantage && disadvantage) || !(advantage || disadvantage)) {
          roll = Math.floor(Math.random() * (sides - 1) + 1) + offset;
        } else if (advantage) {
          roll = Math.max(
            Math.floor(Math.random() * (sides - 1) + 1) + offset,
            Math.floor(Math.random() * (sides - 1) + 1) + offset
          );
        } else {
          roll = Math.min(
            Math.floor(Math.random() * (sides - 1) + 1) + offset,
            Math.floor(Math.random() * (sides - 1) + 1) + offset
          );
        }
        return { result: roll };
      },
    };

    // Tool definitions for OpenAI (no RollDie)
    const sharedToolDefs = [
      {
        name: "updatePlayer",
        description: "Update player info",
        parameters: playerSchema,
        execute: tools.updatePlayer,
      },
      {
        name: "updateMonster",
        description: "Update monster info",
        parameters: monsterSchema,
        execute: tools.updateMonster,
      },
      {
        name: "logCampaign",
        description: "Log narration and updates",
        parameters: z.object({
          narration: z.string(),
          updates: z.any().optional(),
        }),
        execute: tools.logCampaign,
      }
    ];
    // Tool definitions for Gemini (includes RollDie)
    const geminiToolDefs = [
      ...sharedToolDefs,
      {
        name: "RollDie",
        description: "Roll a die, number of sides, rolled with advantage, rolled with disadvantage, and offset are paramaters.",
        parameters : z.object({
          sides: z.number(),
          advantage: z.boolean(),
          disadvantage: z.boolean(),
          offset: z.number(),
        }),
        execute: tools.RollDie,
      }
    ];

    if (isGemini) {
      // Gemini tool-calling using @google/generative-ai
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY_GEMINI || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!apiKey) {
        throw new Error("Missing GOOGLE_API_KEY for Gemini");
      }
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Convert tools to Gemini function declarations
      const geminiFunctions: FunctionDeclaration[] = convertToolsToGemini(
        geminiToolDefs.map(def => {
          let jsonSchema = zodToJsonSchema(def.parameters);
          if (
            def.name === "logCampaign" &&
            (jsonSchema as any).properties &&
            (jsonSchema as any).properties.updates &&
            !(jsonSchema as any).properties.updates.type
          ) {
            (jsonSchema as any).properties.updates.type = "object";
          }
          return {
            type: "function",
            function: {
              name: def.name,
              description: def.description,
              parameters: jsonSchema,
            },
          };
        })
      );
      const geminiTools = [{ functionDeclarations: geminiFunctions }];

      // Prepare Gemini content
      // Gemini does not support 'system' role. Prepend system prompt as first user message.
      let geminiMessages: Content[] = [
        { role: "user", parts: [{ text: prompt }] },
        ...messages.map(m => ({ role: m.role, parts: [{ text: m.content }] }))
      ];

      // Tool call/response loop
      let toolCallCount = 0;
      let response;
      while (true) {
        console.log("Gemini messages before generateContent:", JSON.stringify(geminiMessages, null, 2));
        response = await model.generateContent({
          contents: geminiMessages,
          tools: geminiTools,
        });
        const functionCalls = response.response.functionCalls?.() || [];
        console.log("Gemini functionCalls count:", functionCalls.length);
        if (!functionCalls.length) break;
        // Prepare functionResponse parts for each tool call
        const functionResponseParts = [];
        for (const call of functionCalls) {
          const toolDef = geminiToolDefs.find(t => t.name === call.name);
          if (toolDef && toolDef.execute) {
            const result = await toolDef.execute(call.args);
            functionResponseParts.push({
              functionResponse: {
                name: call.name,
                response: result,
              },
            });
          }
        }
        console.log("Gemini functionResponseParts count:", functionResponseParts.length);
        // Remove any trailing tool messages (shouldn't be there, but just in case)
        while (geminiMessages.length && geminiMessages[geminiMessages.length - 1].role === "tool") {
          geminiMessages.pop();
        }
        // After a function call turn, the very next message must be a single tool message
        // with exactly the right number of functionResponse parts, and nothing else.
        geminiMessages.push({ role: "tool", parts: functionResponseParts });
      }
      // Return the final response text
      const text = response.response.text();
      return new Response(JSON.stringify({ text }), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    } else {
      // OpenAI style: pass tools as object ToolSet
      const openAIToolObject = Object.fromEntries(
        sharedToolDefs.map(def => [
          def.name,
          tool({
            description: def.description,
            parameters: def.parameters,
            execute: def.execute,
          }),
        ])
      );

      const streamResult = await streamText({
        model,
        messages: [
          { role: "system", content: prompt },
          ...messages,
        ],
        tools: openAIToolObject,
      });

      return new Response(streamResult.textStream, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Transfer-Encoding": "chunked",
          "Cache-Control": "no-cache",
        },
      });
    }
  } catch (err) {
    console.error("Fatal error in POST:", err);
    return new Response("Internal Server Error", { status: 500 });
  } finally {
    if (mongoClient) await mongoClient.close();
  }
}
