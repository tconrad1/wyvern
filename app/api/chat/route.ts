import { MongoClient, ObjectId, Db, Filter } from "mongodb";
import { NextRequest } from "next/server";
import z from "zod";


import { getDB } from "./mongo";
import { getWeaviateSingleton } from "./weaviateSingleton";
import { prompts } from "../../../scripts/prompt";
import { PlayerObject, MonsterObject, classSchema, spellSchema , playerSchema, monsterSchema, fightSchema, FightObject } from "../../../scripts/dataTypes";
import { createModelProvider, AVAILABLE_MODELS } from "./modelProviders";

// Simple function to convert Zod schema to JSON schema
function zodToJsonSchema(schema: z.ZodTypeAny) {
  return schema._def;
}

// Utility to build MongoDB _id filter correctly
function getIdFilter(id: string | ObjectId): Filter<Document> {
  if (typeof id === "string" && ObjectId.isValid(id)) return { _id: new ObjectId(id) };
  if (id instanceof ObjectId) return { _id: id };
  return { _id: id as any }; // for custom string IDs
}

function isValidPlayer(player: PlayerObject): boolean {
  try {
    // Use Zod schema to validate the player data
    playerSchema.parse(player);
    return true;
  } catch (error) {
    console.error("Player validation failed:", error);
    return false;
  }
}

function isValidMonster(monster: MonsterObject): boolean {
  try {
    // Use Zod schema to validate the monster data
    monsterSchema.parse(monster);
    return true;
  } catch (error) {
    console.error("Monster validation failed:", error);
    return false;
  }
}

function isValidFight(fight: FightObject): boolean {
  try {
    // Use Zod schema to validate the fight data
    fightSchema.parse(fight);
    return true;
  } catch (error) {
    console.error("Fight validation failed:", error);
    return false;
  }
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
    console.log("=== POST /api/chat START ===");
    console.log("Request received at:", new Date().toISOString());
    
    const { mongoClient: client, db } = await getDB();
    mongoClient = client;

    const weaviate = await getWeaviateSingleton();
    console.log("=== WEAVIATE SINGLETON ===");
    console.log("Weaviate singleton obtained:", !!weaviate);

    const { campaignId, messages, modelName, providerType = 'openrouter' } = await req.json();
    console.log("Request parameters:", { campaignId, modelName, providerType, messageCount: messages?.length });
    
    if (!campaignId) {
      console.error("Missing campaignId in request");
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

    console.log("=== ABOUT TO QUERY WEAVIATE ===");
    try {
      console.log("=== WEAVIATE QUERY ===");
      console.log("Querying Weaviate for:", latestMessage);
      console.log("Weaviate client:", !!weaviate);
      
      // Debug: Check if weaviate is responsive
      console.log("Weaviate client type:", typeof weaviate);
      
      const collection = await weaviate.collections.get("GeneralRules");
      console.log("Collection retrieved:", !!collection);
      
      if (!collection) {
        console.error("generalRules collection not found!");
        docContext = "";
        return;
      }
      
      // Debug: Collection exists
      console.log("Collection exists:", !!collection);
      
      // Use BM25 text search since collection has no vectorizer
      console.log("Performing BM25 text search for:", latestMessage);
      try {
        const searchResult = await collection.query.bm25(
          latestMessage,
          { limit: 5 }
        );
        
        console.log("Semantic search results:", {
          count: searchResult.objects?.length || 0,
          hasObjects: !!searchResult.objects,
          firstObject: typeof searchResult.objects?.[0]?.properties?.text === 'string' ? searchResult.objects[0].properties.text.substring(0, 100) : "none"
        });

        // Extract text from semantic search results
        const texts = searchResult.objects?.map(obj => obj.properties?.text).filter(Boolean) || [];
        docContext = JSON.stringify(texts);
        console.log("DocContext length:", docContext.length);
      } catch (searchError) {
        console.error("Semantic search failed:", searchError);
        // Fallback to empty context
        docContext = "";
      }
    } catch (err) {
      console.error("Weaviate query failed:", err);
      console.error("Error details:", err.message, err.stack);
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

    // Determine if this is a rules query or DM session request
    const rulesKeywords = [
      'what are the stats', 'what are the rules', 'how does', 'what is the',
      'stats for', 'rules for', 'monster manual', 'player handbook',
      'd&d rules', '5e rules', 'dungeons and dragons rules',
      'subclass', 'subclasses', 'class', 'classes', 'spell', 'spells',
      'monster', 'monsters', 'creature', 'creatures', 'race', 'races',
      'feat', 'feats', 'background', 'backgrounds', 'item', 'items',
      'equipment', 'weapon', 'weapons', 'armor', 'magic item', 'magic items',
      'ability', 'abilities', 'trait', 'traits', 'feature', 'features',
      'school of magic', 'schools of magic', 'damage type', 'damage types',
      'condition', 'conditions', 'skill', 'skills', 'proficiency', 'proficiencies',
      'saving throw', 'saving throws', 'hit points', 'armor class', 'challenge rating',
      'experience points', 'xp', 'level', 'levels', 'spell level', 'spell levels',
      'casting time', 'range', 'components', 'duration', 'concentration',
      'advantage', 'disadvantage', 'critical hit', 'critical hits', 'critical miss',
      'initiative', 'movement', 'speed', 'action', 'actions', 'bonus action',
      'reaction', 'reactions', 'free action', 'interaction', 'interactions'
    ];
    
    const isRulesQuery = rulesKeywords.some(keyword => 
      latestMessage.toLowerCase().includes(keyword.toLowerCase())
    );
    
    const prompt = isRulesQuery ? 
      prompts(gameState, docContext).rules : 
      prompts(gameState, docContext).dm;
    
    console.log("=== PROMPT SELECTION ===");
    console.log("Latest message:", latestMessage);
    console.log("Is rules query:", isRulesQuery);
    console.log("Selected prompt type:", isRulesQuery ? "rules" : "dm");

    // Define tool functions
    const tools = {
      async updatePlayer({ id, data }: { id: string; data: PlayerObject }) {
        const col = db.collection("players");
        if (isValidPlayer(data)) {
          await col.updateOne(getIdFilter(id), { $set: { ...data, campaignId } }, { upsert: true });
          return { success: true, message: `Updated player ${id}` };
        }
        return { success: false, message: "Invalid player data" };
      },
      
      async updateMonster({ id, data }: { id: string; data: MonsterObject }) {
        const col = db.collection("monsters");
        if (isValidMonster(data)) {
          await col.updateOne(getIdFilter(id), { $set: { ...data, campaignId } }, { upsert: true });
          return { success: true, message: `Updated monster ${id}` };
        }
        return { success: false, message: "Invalid monster data" };
      },
      async updateFight({ id, data }: { id: string; data: FightObject }) {
        const col = db.collection("fights");
        if (isValidFight(data)) {
          await col.updateOne(getIdFilter(id), { $set: { ...data, campaignId } }, { upsert: true });
          return { success: true, message: `Updated fight ${id}` };
        }
        return { success: false, message: "Invalid fight data" };
      },

      async updatePlayerField({ id, field, value }: { id: string; field: string; value: any }) {
        const col = db.collection("players");
        const updateData = { [field]: value, campaignId };
        await col.updateOne(getIdFilter(id), { $set: updateData }, { upsert: true });
        return { success: true, message: `Updated player ${id} field ${field}` };
      },

      async updateMonsterField({ id, field, value }: { id: string; field: string; value: any }) {
        const col = db.collection("monsters");
        const updateData = { [field]: value, campaignId };
        await col.updateOne(getIdFilter(id), { $set: updateData }, { upsert: true });
        return { success: true, message: `Updated monster ${id} field ${field}` };
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

    // Tool definitions for OpenRouter
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
        name: "updateFight",
        description: "Update fight information in the game state",
        parameters: z.object({
          id: z.string().describe("The unique identifier for the fight"),
          data: fightSchema,
        }),
        execute: tools.updateFight,
      },
      {
        name: "updatePlayerField",
        description: "Update a specific field for a player",
        parameters: z.object({
          id: z.string().describe("The unique identifier for the player"),
          field: z.string().describe("The field name to update (e.g., 'currentHP', 'UsedMovement', 'canAct')"),
          value: z.any().describe("The new value for the field"),
        }),
        execute: tools.updatePlayerField,
      },
      {
        name: "updateMonsterField",
        description: "Update a specific field for a monster",
        parameters: z.object({
          id: z.string().describe("The unique identifier for the monster"),
          field: z.string().describe("The field name to update (e.g., 'currentHP', 'UsedMovement', 'canAct')"),
          value: z.any().describe("The new value for the field"),
        }),
        execute: tools.updateMonsterField,
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

    // Initialize Model Provider
    console.log("=== MODEL PROVIDER INITIALIZATION ===");
    console.log("Provider type:", providerType);
    console.log("Model name:", modelName);
    
    let modelProvider;
    let selectedModel;
    
    if (providerType === 'ollama') {
      // Use Ollama provider
      const apiKey = undefined; // Not needed for Ollama
      selectedModel = modelName || 'llama3.2:3b';
      console.log("Using Ollama provider with model:", selectedModel);
      modelProvider = createModelProvider(apiKey, 'ollama');
    } else {
      // Use OpenRouter provider
      const apiKey = process.env.OPENROUTER_API_KEY;
      console.log("OpenRouter API key found:", apiKey ? "YES" : "NO");
      console.log("OpenRouter API key length:", apiKey?.length || 0);
      if (!apiKey) {
        console.error("Missing OpenRouter API key");
        throw new Error("Missing API key for OpenRouter. Please set OPENROUTER_API_KEY");
      }
      
      selectedModel = modelName || 'mistralai/mistral-7b-instruct:free';
      console.log("Using OpenRouter provider with model:", selectedModel);
      modelProvider = createModelProvider(apiKey, 'openrouter');
    }
    
    console.log("Model provider created successfully");
    
    // Convert tools to the appropriate format (all models support function calling)
    const toolDefinitions = toolDefs.map(def => ({
      name: def.name,
      description: def.description,
      parameters: zodToJsonSchema(def.parameters)
    }));

    // Prepare messages
    const allMessages = [
      { role: "system", content: prompt },
      ...messages
    ];

    // Generate response using selected provider
    console.log("=== GENERATING RESPONSE ===");
    console.log("Model:", selectedModel);
    console.log("Message count:", allMessages.length);
    console.log("Tool definitions count:", toolDefinitions.length);
    
    let response;
    try {
      console.log("Calling modelProvider.generateResponse...");
      
      // Add timeout for Ollama to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 60000); // 60 second timeout
      });
      
      const responsePromise = modelProvider.generateResponse(
        allMessages,
        toolDefinitions,
        selectedModel
      );
      
      response = await Promise.race([responsePromise, timeoutPromise]);
      
      console.log("Response received successfully");
      const responseText = response.text;
      const functionCallsInResponse = response.functionCalls || [];
      
          console.log(`OpenRouter functionCalls count: ${functionCallsInResponse?.length || 0}`);
    console.log(`OpenRouter response text:`, responseText); // Debug log
      
      // If there are function calls, execute them and include results with the narrative
      if (functionCallsInResponse && functionCallsInResponse.length > 0) {
        const functionResults = [];
        let narrativeResponse = responseText;
        
        for (const functionCall of functionCallsInResponse) {
          const toolDef = toolDefs.find(def => def.name === functionCall.name);
          if (toolDef) {
            try {
              const result = await toolDef.execute(functionCall.args);
              // For logCampaign calls, ensure we capture the narration if responseText is empty
              if (functionCall.name === 'logCampaign' && !responseText.trim() && functionCall.args.narration) {
                narrativeResponse = functionCall.args.narration;
              }
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
        
        // Format the response with both narrative and any roll results
        let resultText = narrativeResponse + "\n\n";
        
        // Only append roll results since other function calls are administrative
        functionResults.forEach(result => {
          if (result.functionCall.name === 'rollDie') {
            const rollResult = result.response;
            resultText += `🎲 Rolled a d${rollResult.sides}${rollResult.advantage ? ' with advantage' : ''}${rollResult.disadvantage ? ' with disadvantage' : ''}${rollResult.offset ? ` + ${rollResult.offset}` : ''}: **${rollResult.result}**\n`;
          }
        });

        console.log('Final response text:', resultText); // Debug log
        
        return new Response(JSON.stringify({ text: resultText.trim() }), {
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
      console.error("=== MODEL PROVIDER ERROR ===");
      console.error("Provider type:", providerType);
      console.error("Model:", selectedModel);
      console.error("Error:", error.message);
      console.error("Error type:", error.name);
      console.error("Error stack:", error.stack);
      
      // Try fallback without function calling
      try {
        console.log("Trying fallback without function calling...");
        const fallbackResponse = await modelProvider.generateResponse(
          allMessages,
          undefined, // no tools
          selectedModel
        );
        
        const fallbackText = fallbackResponse.text;
        console.log("Fallback successful, response length:", fallbackText.length);
        return new Response(JSON.stringify({ text: fallbackText }), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        });
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError.message);
        
        // Provide more specific error messages based on the error type
        let errorMessage = "I'm having trouble connecting to my AI service. Please try again later.";
        
        if (providerType === 'ollama') {
          if (error.message.includes('timeout')) {
            errorMessage = "The local AI model is taking too long to respond. This might be due to high system load or the model being too large for your hardware.";
          } else if (error.message.includes('not installed')) {
            errorMessage = "The requested AI model is not installed. Please install it first using: ollama pull " + selectedModel;
          } else if (error.message.includes('Cannot connect')) {
            errorMessage = "Cannot connect to the local AI service. Please ensure Ollama is running.";
          } else if (error.message.includes('overloaded')) {
            errorMessage = "The local AI model is currently overloaded. Please try again in a moment or use a smaller model.";
          }
        } else {
          // OpenRouter specific errors
          if (error.status === 429) {
            errorMessage = "I'm currently experiencing high traffic. Please try again in a few moments.";
          } else if (error.status === 401) {
            errorMessage = "Authentication failed. Please check your API key.";
          } else if (error.status === 503) {
            errorMessage = "The AI service is temporarily unavailable. Please try again later.";
          }
        }
        
        return new Response(JSON.stringify({ 
          text: errorMessage,
          error: {
            type: error.name,
            message: error.message,
            provider: providerType,
            model: selectedModel
          }
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
