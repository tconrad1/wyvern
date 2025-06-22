import OpenAI from "openai";
import {ChatCompletionMessage} from "openai/resources/chat/completions";
import  "dotenv/config";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  OPENAI_API_KEY
} = process.env;

interface PlayerUpdate {
  hp: number;
  [key: string]: any;
}
interface MonsterUpdate {
  hp: number;
  type: string;
  status?: string;
  [key: string]: any;
}

function extractJsonBlock(text: string): string | null {
    
const match = text.match(/```json\s*([\s\S]*?)\s*```/i);
  return match ? match[1] : null;
}

function isValidPlayerUpdate(obj: any): obj is PlayerUpdate {
  return obj && typeof obj.hp === "number";
}

function isValidMonsterUpdate(obj: any): obj is MonsterUpdate {
  return obj && typeof obj.hp === "number" && typeof obj.type === "string";
}

async function runRealAIDMTest() {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const systemPrompt = `
You are a Dungeon Master AI for a Dungeons & Dragons 5e campaign.

Your job is to:
1. Respond creatively to the player's prompt.
2. Always include a structured JSON block representing game state updates at the end of your response.

The JSON must follow this format, even if some sections are empty:

\`\`\`json
{
  "players": {},
  "monsters": {
    "goblin-001": {
      "hp": 15,
      "type": "Goblin",
      "status": "alive"
    }
  },
  "campaignLog": ["The party encountered a new goblin named Grizzle."]
}
\`\`\`

🔴 DO NOT OMIT this JSON block.  
🔴 DO NOT include any extra explanation outside the code block.  
🔴 You must output this block even if values are placeholders.  
🔴 Return only one JSON block per response.

Make sure all keys are present: "players", "monsters", and "campaignLog". If there are no updates for a section, use an empty object or array.
`;

  // Craft prompt instructing ChatGPT DM to output JSON updates
  const messages = [
  { role: "system", content: systemPrompt },
  { role: "user", content: "Create a goblin." },
] as unknown as ChatCompletionMessage[];
    try {
        const completion = await openai.chat.completions.create({
      model: "gpt-4o", 
        messages: messages,
        max_tokens: 1000,
        });

    const responseText = completion.choices[0]?.message?.content || "";
    console.log("Raw AI Response:\n", responseText);

    const jsonBlock = extractJsonBlock(responseText);

    if (!jsonBlock) {
      console.error("❌ No JSON block found in AI response");
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonBlock);
    } catch (err) {
      console.error("❌ Failed to parse JSON block:", err);
      return;
    }

    console.log("Parsed JSON:", parsed);

    // Validate structure roughly
    if (parsed.monsters) {
      for (const [id, monster] of Object.entries(parsed.monsters)) {
        if (!isValidMonsterUpdate(monster)) {
          console.error(`❌ Monster update invalid for ${id}`, monster);
          return;
        }
      }
    }

    if (parsed.players) {
      for (const [id, player] of Object.entries(parsed.players)) {
        if (!isValidPlayerUpdate(player)) {
          console.error(`❌ Player update invalid for ${id}`, player);
          return;
        }
      }
    }

    console.log("✅ AI DM output JSON is valid and plausible.");
  } catch (error) {
    console.error("Error calling OpenAI:", error);
  }
}

runRealAIDMTest();

// This script simulates the process of applying updates to players and monsters