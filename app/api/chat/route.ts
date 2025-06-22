import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import OpenAI from "openai";
import { DataAPIClient } from "@datastax/astra-db-ts";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  OPENAI_API_KEY
} = process.env;

const openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(
  ASTRA_DB_API_ENDPOINT || "default_endpoint",
  { namespace: ASTRA_DB_NAMESPACE }
);

const curr_limit_for_find = 10;

// 🔍 Basic schema validators
function isValidPlayer(player: any): boolean {
  return player &&
    typeof player === 'object' &&
    typeof player.hp === 'number';
}

function isValidMonster(monster: any): boolean {
  return monster &&
    typeof monster === 'object' &&
    typeof monster.hp === 'number' &&
    typeof monster.type === 'string';
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const latestMessage = messages[messages.length - 1]?.content;

    let docContext = "";

    // === 1. Embed message for RAG ===
    const embedding = await openaiClient.embeddings.create({
      model: "text-embedding-3-small",
      input: latestMessage,
      encoding_format: "float"
    });

    // === 2. Retrieve context from vector database ===
    try {
      const collection = await db.collection(ASTRA_DB_COLLECTION || "default_collection");
      const cursor = collection.find({}, {
        sort: { $vector: embedding.data[0].embedding },
        limit: curr_limit_for_find
      });
      const documents = await cursor.toArray();
      const docsMap = documents?.map(doc => doc.text);
      docContext = JSON.stringify(docsMap);
    } catch (err) {
      console.error("Error loading rules context:", err);
    }

    // === 3. Load game state ===
    let gameState = {};
    try {
      const [playersCol, monstersCol] = await Promise.all([
        db.collection("players"),
        db.collection("monsters")
      ]);

      const [players, monsters] = await Promise.all([
        playersCol.find({}).toArray(),
        monstersCol.find({}).toArray()
      ]);

      gameState = {
        players: Object.fromEntries(players.map(p => [p._id, p])),
        monsters: Object.fromEntries(monsters.map(m => [m._id, m]))
      };
    } catch (err) {
      console.error("Error loading game state:", err);
    }

    // === 4. Build system prompt ===
    const systemPrompt = `
You are a Dungeon Master AI assistant for a Dungeons & Dragons 5e game. 

You must respond to user requests with two parts:
1. A natural language explanation of what happened in the game.
2. A JSON block that reflects any updates to the game state (such as monsters, players, or the campaign log).

Only include game state changes inside the JSON block. 
Wrap the JSON in triple backticks with a \`json\` hint, like so:

\`\`\`json
{
  "monsters": {
    "goblin-001": {
      "hp": 5,
      "status": "wounded"
    }
  },
  "players": {},
  "campaignLog": ["Player attacked goblin-001 for 7 damage."]
}
\`\`\`

If there are no changes, return an empty JSON object in the same format. Do not omit the block.
Always include all relevant keys: \`players\`, \`monsters\`, and \`campaignLog\`.

Do not create characters unless explicitly asked to do so. Be brief unless otherwise instructed.
`;


    // === 5. Stream and buffer the AI response ===
    const streamResponse = await streamText({
      model: openai('gpt-4o'),
      messages: [systemPrompt, ...messages],
    });

    let fullText = "";
    for await (const delta of streamResponse.textStream) {
      fullText += delta;
    }

    // === 6. Extract JSON update block from response ===
    const match = fullText.match(/```json([\s\S]*?)```/);
    let updates = null;

    if (match) {
      try {
        updates = JSON.parse(match[1]);
      } catch (err) {
        console.warn("Failed to parse JSON update:", err);
      }
    }

    // === 7. Apply updates to players and monsters (with validation + upsert) ===
    try {
      const playersCol = await db.collection("players");
      const monstersCol = await db.collection("monsters");
      const logCol = await db.collection("campaign_log");

      if (updates?.players) {
        for (const id in updates.players) {
          const playerData = updates.players[id];
          if (isValidPlayer(playerData)) {
            await playersCol.updateOne(
              { _id: id },
              { $set: playerData },
              { upsert: true }
            );
          } else {
            console.warn(`Invalid player data for ${id}:`, playerData);
          }
        }
      }

      if (updates?.monsters) {
        for (const id in updates.monsters) {
          const monsterData = updates.monsters[id];
          if (isValidMonster(monsterData)) {
            await monstersCol.updateOne(
              { _id: id },
              { $set: monsterData },
              { upsert: true }
            );
          } else {
            console.warn(`Invalid monster data for ${id}:`, monsterData);
          }
        }
      }

      // === 8. Save narration to campaign log ===
      await logCol.insertOne({
        timestamp: new Date(),
        user_message: latestMessage,
        narration: fullText,
        updates_applied: updates || null
      });

    } catch (err) {
      console.error("Error applying updates or logging:", err);
    }

    // === 9. Return the stream to client ===
    return streamResponse.toDataStreamResponse();

  } catch (error) {
    console.error("Fatal error in POST route:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
