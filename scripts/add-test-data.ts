import weaviate, { WeaviateClient } from "weaviate-client";
import fs from "fs";
import path from "path";

const WEAVIATE_HOST = process.env.WEAVIATE_HOST || 'weaviate';

async function addTestData() {
  console.log("🔍 Adding test data to generalRules collection...");
  console.log("💡 Note: This is for testing. The full data is already loaded via 'npm run load:general-rules'");
  
  try {
    // Connect to Weaviate
    const client = await weaviate.connectToLocal({
      host: WEAVIATE_HOST,
      port: 8080
    });
    
    console.log("✅ Connected to Weaviate");
    
    // Get the collection
    const collection = await client.collections.get("generalRules");
    console.log("✅ Got generalRules collection");
    
    // Add some test data for quick testing
    const testData = [
      {
        properties: {
          text: "Test Monster - Black Bear (Test Entry) - Medium beast, CR 1/2, HP 19 (3d8+6), AC 11, Speed 40 ft., climb 30 ft. Actions: Multiattack, Bite (+4 to hit, 1d6+2 piercing damage), Claws (+4 to hit, 2d4+2 slashing damage).",
          source: "test-data.json",
          category: "test"
        }
      },
      {
        properties: {
          text: "Test Spell - Fireball (Test Entry) - 3rd-level evocation spell, 8d6 fire damage, 20-foot radius, range 150 feet. Save DC 15 Dexterity for half damage.",
          source: "test-data.json",
          category: "test"
        }
      }
    ];
    
    // Insert test data
    for (const data of testData) {
      await collection.data.insert(data);
      console.log("✅ Inserted test data");
    }
    
    console.log("✅ Test data inserted successfully");
    console.log("💡 The full D&D data is available via semantic search in the generalRules collection");
    
  } catch (error) {
    console.error("❌ Error adding test data:", error.message);
  }
}

addTestData().catch(console.error); 