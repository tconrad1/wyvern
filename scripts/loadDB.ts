import weaviate, { connectToLocal, vectorizer, WeaviateClient, generative  } from "weaviate-client";
import fs from "fs";
import path from "path";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

// Config and paths
const WEAVIATE_HOST = process.env.WEAVIATE_HOST || "localhost:8080";
const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT;;
const CLASS_NAME = "Document";  // Must match your schema class
const DATA_DIR = "C:/local_projects/wyvern/data"; // Your data folder

// Initialize client
const client: WeaviateClient = await weaviate.connectToLocal();


function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// await client.collections.create({
//   name: 'Document',
//   vectorizers: vectorizer.text2VecOllama({
//     apiEndpoint: OLLAMA_ENDPOINT, // This must match your running Ollama instance
//     model: 'nomic-embed-text'             // Use a model you’ve pulled with `ollama run`
//   }),
//   generative: generative.ollama({
//     apiEndpoint: OLLAMA_ENDPOINT,
//     model: 'mistral' // default model
//   })
// });


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
  const schema = await client.collections.get(CLASS_NAME);
  console.log(JSON.stringify(schema, null, 2));
  
  if (!schema) {
    console.error(`Collection ${CLASS_NAME} does not exist. Please create it first.`);
    return;
  }
  
  const files = getAllFiles(DATA_DIR);
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100,
  });

 const collection = await client.collections.get("RuleContext");

for (const file of files) {
  console.log(`Reading file: ${file}`);
  const rawContent = fs.readFileSync(file, "utf8");
  const chunks = await splitter.splitText(rawContent);

  // Prepare objects for batch insert
  const objects = chunks.map(chunk => ({
    properties: {
      text: chunk,
    },
  }));

  try {
    for (const batch of chunkArray(objects, 100)) {
  await collection.data.insertMany(batch);
}

  } catch (e) {
    console.error(`Error inserting chunks from ${file}:`, e);
  }
}
}

loadData().catch(console.error);
