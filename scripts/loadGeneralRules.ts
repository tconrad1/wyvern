import weaviate, { WeaviateClient, dataType } from "weaviate-client";
import fs from "fs";
import path from "path";

const WEAVIATE_HOST = process.env.WEAVIATE_HOST || 'weaviate';

async function loadGeneralRules() {
  console.log("🔍 Loading all JSON data into generalRules collection...");
  
  try {
    // Connect to Weaviate
    const client = await weaviate.connectToLocal({
      host: WEAVIATE_HOST,
      port: 8080
    });
    
    console.log("✅ Connected to Weaviate");
    
    // Create or get the generalRules collection
    let collection;
    try {
      collection = await client.collections.get("generalRules");
      console.log("✅ Found existing generalRules collection");
    } catch (error) {
      console.log("🔧 Creating new generalRules collection...");
      collection = await client.collections.create({
        name: 'generalRules',
        properties: [
          {
            name: 'text',
            dataType: dataType.TEXT,
          },
          {
            name: 'source',
            dataType: dataType.TEXT,
          },
          {
            name: 'category',
            dataType: dataType.TEXT,
          }
        ]
      });
      console.log("✅ Created generalRules collection");
    }
    
    // Load all JSON files from data directory
    const dataDir = path.join(process.cwd(), 'data');
    console.log(`📖 Loading data from: ${dataDir}`);
    
    if (!fs.existsSync(dataDir)) {
      throw new Error(`Data directory not found: ${dataDir}`);
    }
    
    const allData = [];
    
    // Recursively find all JSON files
    function processDirectory(dirPath: string, category: string) {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Process subdirectories
          processDirectory(fullPath, item);
        } else if (item.endsWith('.json')) {
          try {
            console.log(`📄 Processing: ${fullPath}`);
            const jsonData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            
            // Convert JSON to text for storage
            const jsonText = JSON.stringify(jsonData, null, 2);
            
            allData.push({
              properties: {
                text: jsonText,
                source: item,
                category: category
              }
            });
            
            console.log(`✅ Added ${item} (${category})`);
          } catch (error) {
            console.error(`❌ Error processing ${fullPath}:`, error.message);
          }
        }
      }
    }
    
    // Process all directories in data folder
    const dataItems = fs.readdirSync(dataDir);
    for (const item of dataItems) {
      const fullPath = path.join(dataDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        processDirectory(fullPath, item);
      } else if (item.endsWith('.json')) {
        try {
          console.log(`📄 Processing: ${fullPath}`);
          const jsonData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          
          const jsonText = JSON.stringify(jsonData, null, 2);
          
          allData.push({
            properties: {
              text: jsonText,
              source: item,
              category: 'root'
            }
          });
          
          console.log(`✅ Added ${item} (root)`);
        } catch (error) {
          console.error(`❌ Error processing ${fullPath}:`, error.message);
        }
      }
    }
    
    console.log(`📊 Total files to insert: ${allData.length}`);
    
    // Insert data in batches
    const batchSize = 10;
    for (let i = 0; i < allData.length; i += batchSize) {
      const batch = allData.slice(i, i + batchSize);
      
      try {
        await collection.data.insertMany(batch);
        console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allData.length/batchSize)}`);
      } catch (error) {
        console.error(`❌ Error inserting batch:`, error.message);
      }
    }
    
    console.log("✅ All data loaded successfully into generalRules collection!");
    
  } catch (error) {
    console.error("❌ Error loading general rules:", error.message);
  }
}

loadGeneralRules().catch(console.error); 