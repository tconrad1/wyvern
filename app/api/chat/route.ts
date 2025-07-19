import { MongoClient, ObjectId, Db, Filter } from "mongodb";
import { NextRequest } from "next/server";
import z from "zod";
import { GoogleGenerativeAI, FunctionDeclaration, Content } from '@google/generative-ai';

import { getDB } from "./mongo";
import { getWeaviateSingleton } from "./weaviateSingleton";
import { prompts } from "../../../scripts/prompt";
import { PlayerObject, MonsterObject } from "../../../scripts/dataTypes";

// === Schemas ===
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

// Convert Zod schema to Gemini function declaration
function zodToGeminiFunction(name: string, description: string, schema: z.ZodTypeAny): FunctionDeclaration {
  // Convert Zod schema to JSON Schema format that Gemini expects
  function zodToJsonSchema(zodSchema: z.ZodTypeAny): any {
    if (zodSchema instanceof z.ZodObject) {
      const shape = zodSchema.shape;
      const properties: Record<string, any> = {};
      const required: string[] = [];
      
      for (const [key, value] of Object.entries(shape)) {
        if (value instanceof z.ZodString) {
          properties[key] = { type: 'STRING' };
        } else if (value instanceof z.ZodNumber) {
          properties[key] = { type: 'NUMBER' };
        } else if (value instanceof z.ZodBoolean) {
          properties[key] = { type: 'BOOLEAN' };
        } else if (value instanceof z.ZodArray) {
          properties[key] = { type: 'ARRAY' };
        } else if (value instanceof z.ZodObject) {
          properties[key] = zodToJsonSchema(value);
        } else if (value instanceof z.ZodOptional) {
          // Optional fields don't go in required array
          properties[key] = zodToJsonSchema(value.unwrap());
        } else {
          properties[key] = { type: 'STRING' }; // Default to string
        }
        
        // Add to required if not optional
        if (!(value instanceof z.ZodOptional)) {
          required.push(key);
        }
      }
      
      return {
        type: 'OBJECT',
        properties,
        required
      };
    }
    
    return { type: 'STRING' }; // Default fallback
  }
  
  return {
    name,
    description,
    parameters: zodToJsonSchema(schema)
  };
}

// === GET: Fetch all messages for a campaign ===
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");
  if (!campaignId) {
    return new Response("Missing campaignId", { status: 400 });
  }
  let mongoClient: MongoClient | undefined;
  try {
    const { mongoClient: client, db } = await getDB();
    mongoClient = client;
    const messages = await db
      .collection("messages")
      .find({ campaignId })
      .sort({ timestamp: 1 })
      .toArray();
    return new Response(JSON.stringify(messages), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error fetching messages:", err);
    return new Response("Internal Server Error", { status: 500 });
  } finally {
    if (mongoClient) await mongoClient.close();
  }
}

// Main handler
export async function POST(req: NextRequest) {
  let mongoClient: MongoClient | undefined;

  try {
    const { mongoClient: client, db } = await getDB();
    mongoClient = client;

    const weaviate = await getWeaviateSingleton();

    const { campaignId, messages } = await req.json();
    if (!campaignId) {
      return new Response("Missing campaignId", { status: 400 });
    }

    // Save all incoming messages to the DB (if not already present)
    if (Array.isArray(messages)) {
      const bulk = messages.map((m) => ({
        updateOne: {
          filter: { id: m.id },
          update: {
            $setOnInsert: {
              id: m.id,
              campaignId,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp || new Date(),
            },
          },
          upsert: true,
        },
      }));
      if (bulk.length > 0) {
        await db.collection("messages").bulkWrite(bulk, { ordered: false });
      }
    }

    const latestMessage = messages[messages.length - 1]?.content ?? "";
    let docContext = "";

    try {
      const result = await weaviate.collections
        .get("RuleContext")
        .query.nearText([latestMessage], { limit: 10, returnMetadata: ["certainty"] });

      docContext = JSON.stringify(result.objects.map(obj => obj.properties?.text).filter(Boolean));
    } catch (err) {
      console.error("Weaviate query failed:", err);
      // Use empty context if Weaviate fails - this is expected when Ollama isn't running
      docContext = "";
    }

    // Load game state from MongoDB
    let gameState: any = { players: {}, monsters: {} };
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
      async updatePlayer({ id, data }: { id: string; data: any }) {
        const col = db.collection("players");
        if (isValidPlayer(data)) {
          await col.updateOne(getIdFilter(id), { $set: { ...data, campaignId } }, { upsert: true });
          return { success: true, message: `Updated player ${id}` };
        }
        return { success: false, message: "Invalid player data" };
      },
      
      async updateMonster({ id, data }: { id: string; data: any }) {
        const col = db.collection("monsters");
        if (isValidMonster(data)) {
          await col.updateOne(getIdFilter(id), { $set: { ...data, campaignId } }, { upsert: true });
          return { success: true, message: `Updated monster ${id}` };
        }
        return { success: false, message: "Invalid monster data" };
      },
      
      async logCampaign({ narration, updates }: { narration: string; updates?: any }) {
        await db.collection("campaign_log").insertOne({
          timestamp: new Date(),
          user_message: latestMessage,
          narration,
          updates_applied: updates || null,
        });
        return { success: true, message: "Campaign logged" };
      },
      
      async rollDie({ sides, advantage, disadvantage, offset }: { 
        sides: number; 
        advantage: boolean; 
        disadvantage: boolean; 
        offset: number;
      }) {
        let roll;
        if ((advantage && disadvantage) || !(advantage || disadvantage)) {
          roll = Math.floor(Math.random() * sides) + 1 + offset;
        } else if (advantage) {
          const roll1 = Math.floor(Math.random() * sides) + 1;
          const roll2 = Math.floor(Math.random() * sides) + 1;
          roll = Math.max(roll1, roll2) + offset;
        } else {
          const roll1 = Math.floor(Math.random() * sides) + 1;
          const roll2 = Math.floor(Math.random() * sides) + 1;
          roll = Math.min(roll1, roll2) + offset;
        }
        return { result: roll, sides, advantage, disadvantage, offset };
      },
    };

    // Tool definitions for Gemini
    const toolDefs = [
      {
        name: "updatePlayer",
        description: "Update player information in the game state",
        parameters: z.object({
          id: z.string().describe("The unique identifier for the player"),
          data: playerSchema,
        }),
        execute: tools.updatePlayer,
      },
      {
        name: "updateMonster",
        description: "Update monster information in the game state",
        parameters: z.object({
          id: z.string().describe("The unique identifier for the monster"),
          data: monsterSchema,
        }),
        execute: tools.updateMonster,
      },
      {
        name: "logCampaign",
        description: "Log campaign narration and any updates made",
        parameters: z.object({
          narration: z.string().describe("The narrative description of what happened"),
          updates: z.any().optional().describe("Any updates that were applied to the game state"),
        }),
        execute: tools.logCampaign,
      },
      {
        name: "rollDie",
        description: "Roll a die with specified sides, advantage/disadvantage, and offset",
        parameters: z.object({
          sides: z.number().describe("Number of sides on the die (e.g., 6 for d6, 20 for d20)"),
          advantage: z.boolean().describe("Whether to roll with advantage (take higher of two rolls)"),
          disadvantage: z.boolean().describe("Whether to roll with disadvantage (take lower of two rolls)"),
          offset: z.number().describe("Number to add to the final roll result"),
        }),
        execute: tools.rollDie,
      }
    ];

    // Initialize Gemini
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY_GEMINI || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing API key for Gemini. Please set GOOGLE_API_KEY, GOOGLE_API_KEY_GEMINI, GOOGLE_GENERATIVE_AI_API_KEY, or GEMINI_API_KEY");
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-1.5-flash which has higher rate limits
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Convert tools to Gemini function declarations
    const geminiFunctions: FunctionDeclaration[] = toolDefs.map(def => 
      zodToGeminiFunction(def.name, def.description, def.parameters)
    );

    const geminiTools = [{ functionDeclarations: geminiFunctions }];

    // Prepare Gemini content
    // Gemini doesn't support 'system' role, so prepend system prompt as first user message
    let geminiMessages: Content[] = [
      { role: "user", parts: [{ text: prompt }] },
      ...messages.map(m => ({ role: m.role, parts: [{ text: m.content }] }))
    ];

    // Simple chat with basic function calling
    let response;
    try {
      response = await model.generateContent({
        contents: geminiMessages,
        tools: geminiTools,
      });
      
      const responseText = response.response.text();
      const functionCallsInResponse = response.response.functionCalls();
      
      console.log(`Gemini functionCalls count: ${functionCallsInResponse?.length || 0}`);
      
      // If there are function calls, execute them and return the result directly
      if (functionCallsInResponse && functionCallsInResponse.length > 0) {
        const functionResults = [];
        
        for (const functionCall of functionCallsInResponse) {
          const toolDef = toolDefs.find(def => def.name === functionCall.name);
          if (toolDef) {
            try {
              const result = await toolDef.execute(functionCall.args);
              functionResults.push({
                functionCall: functionCall,
                response: result
              });
            } catch (error) {
              console.error(`Error executing function ${functionCall.name}:`, error);
              functionResults.push({
                functionCall: functionCall,
                response: { error: error.message }
              });
            }
          }
        }
        
        // Return the function results directly instead of trying to get a final response
        const resultText = functionResults.map(result => {
          if (result.functionCall.name === 'rollDie') {
            const rollResult = result.response;
            return `Rolled a d${rollResult.sides}${rollResult.advantage ? ' with advantage' : ''}${rollResult.disadvantage ? ' with disadvantage' : ''}${rollResult.offset ? ` + ${rollResult.offset}` : ''}: **${rollResult.result}**`;
          }
          return `${result.functionCall.name}: ${JSON.stringify(result.response)}`;
        }).join('\n');
        
        return new Response(JSON.stringify({ text: resultText }), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        });
      }
      
      // No function calls, return the response as is
      return new Response(JSON.stringify({ text: responseText }), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
      
    } catch (error) {
      console.error("Gemini API error:", error);
      
      // Try fallback without function calling
      try {
        console.log("Trying fallback without function calling...");
        const fallbackResponse = await model.generateContent({
          contents: geminiMessages,
        });
        
        const fallbackText = fallbackResponse.response.text();
        return new Response(JSON.stringify({ text: fallbackText }), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        });
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
        
        // Handle rate limiting
        if (error.status === 429) {
          return new Response(JSON.stringify({ 
            text: "I'm currently experiencing high traffic. Please try again in a few moments." 
          }), {
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "no-cache",
            },
          });
        }
        
        return new Response(JSON.stringify({ 
          text: "I'm having trouble connecting to my AI service. Please try again later." 
        }), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        });
      }
    }

  } catch (err) {
    console.error("Fatal error in POST:", err);
    return new Response("Internal Server Error", { status: 500 });
  } finally {
    if (mongoClient) await mongoClient.close();
  }
}
