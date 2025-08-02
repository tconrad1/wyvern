import weaviate, { connectToLocal, vectorizer, WeaviateClient, generative  } from "weaviate-client";
import fs from "fs";
import path from "path";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

// Config and paths
const WEAVIATE_HOST = process.env.WEAVIATE_HOST || "localhost:8080";
const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || `http://${process.env.OLLAMA_HOST || 'localhost'}:11434`;
const DATA_DIR = process.env.DATA_DIR || "/app/data"; // Your data folder

// Initialize client
const client: WeaviateClient = await weaviate.connectToLocal({
  host: WEAVIATE_HOST.split(':')[0],
  port: parseInt(WEAVIATE_HOST.split(':')[1] || '8080')
});

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Utility to get all files recursively
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (fullPath.endsWith(".json")) {
      arrayOfFiles.push(fullPath);
    }
  }
  return arrayOfFiles;
}

// Main loader function
async function loadData() {
  console.log("Starting data loading process...");
  console.log("💡 Note: This is an alternative to 'npm run load:general-rules' which loads complete JSON files");
  
  // Check if generalRules collection exists
  try {
    const collection = await client.collections.get("generalRules");
    console.log("Found generalRules collection");
  } catch (error) {
    console.error("generalRules collection does not exist. Please create it first.");
    return;
  }
  
  const files = getAllFiles(DATA_DIR);
  console.log(`Found ${files.length} JSON files to process`);
  
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100,
  });

  const collection = await client.collections.get("generalRules");
  let totalInserted = 0;

  for (const file of files) {
    console.log(`Reading file: ${file}`);
    try {
      const rawContent = fs.readFileSync(file, "utf8");
      const chunks = await splitter.splitText(rawContent);
      console.log(`  Split into ${chunks.length} chunks`);

      // Prepare objects for batch insert
      const objects = chunks.map(chunk => ({
        properties: {
          text: chunk,
          source: path.basename(file),
          category: path.dirname(file).split(path.sep).pop() || 'root'
        },
      }));

      // Insert in batches
      for (const batch of chunkArray(objects, 100)) {
        await collection.data.insertMany(batch);
        totalInserted += batch.length;
        console.log(`  Inserted batch of ${batch.length} objects (total: ${totalInserted})`);
      }
    } catch (e) {
      console.error(`Error processing file ${file}:`, e);
    }
  }
  
  console.log(`Data loading complete. Total objects inserted: ${totalInserted}`);
}

loadData().catch(console.error);
