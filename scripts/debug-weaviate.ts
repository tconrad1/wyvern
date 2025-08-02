import weaviate, { WeaviateClient } from "weaviate-client";

// Use Docker service name when running in container
const WEAVIATE_HOST = process.env.WEAVIATE_HOST || 'weaviate';
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'ollama';

async function debugWeaviate() {
  console.log("🔍 Debugging Weaviate connection...");
  
  try {
    // Connect to Weaviate
    const client = await weaviate.connectToLocal({
      host: WEAVIATE_HOST,
      port: 8080
    });
    
    console.log("✅ Connected to Weaviate");
    
    // Check if generalRules collection exists
    try {
      const collection = await client.collections.get("generalRules");
      console.log("✅ generalRules collection found");
      
      // Get collection info
      const config = await collection.config.get();
      console.log("📋 Collection config:", {
        name: config.name,
        properties: config.properties?.length || 0
      });
      
      // Test semantic search
      console.log("🔍 Testing semantic search...");
      const searchResult = await collection.query.nearText(
        ["black bear stats"],
        { limit: 5, distance: 0.7 }
      );
      
      console.log("📊 Search results:", {
        count: searchResult.objects?.length || 0,
        firstResult: typeof searchResult.objects?.[0]?.properties?.text === 'string' ? searchResult.objects[0].properties.text.substring(0, 200) : "none"
      });
      
      // Test another search
      console.log("🔍 Testing spell search...");
      const spellSearchResult = await collection.query.nearText(
        ["fireball spell"],
        { limit: 3, distance: 0.7 }
      );
      
      console.log("📊 Spell search results:", {
        count: spellSearchResult.objects?.length || 0,
        firstResult: typeof spellSearchResult.objects?.[0]?.properties?.text === 'string' ? spellSearchResult.objects[0].properties.text.substring(0, 200) : "none"
      });
      
    } catch (collectionErr) {
      console.error("❌ generalRules collection not found:", collectionErr.message);
      console.log("💡 Run 'npm run load:general-rules' to load the data first");
    }
    
  } catch (error) {
    console.error("❌ Weaviate connection failed:", error.message);
  }
}

debugWeaviate().catch(console.error); 