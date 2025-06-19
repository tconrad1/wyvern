import {DataAPIClient } from '@datastax/astra-db-ts';
import { PuppeteerWebBaseLoader } from '@langchain/community/document_loaders/web/puppeteer';
import OpenAI from 'openai';
import { Document } from 'langchain/document';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter'; 

import  "dotenv/config";
import { headersArray } from 'puppeteer/src/puppeteer.js';
const fs = require('fs');
const path = require('path');


const { ASTRA_DB_NAMESPACE, ASTRA_DB_COLLECTION, ASTRA_DB_API_ENDPOINT, ASTRA_DB_APPLICATION_TOKEN, OPENAI_API_KEY } = process.env;


if (!ASTRA_DB_NAMESPACE || !ASTRA_DB_COLLECTION || !ASTRA_DB_API_ENDPOINT || !ASTRA_DB_APPLICATION_TOKEN || !OPENAI_API_KEY) {
  throw new Error("Missing required environment variables");
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
import  bestiary_files  from '../source_books/bestiary_index.json'; // Import the bestiary file name json
/*prepare for local file scraping */


function getAllFiles(dirPath: string, arrayOfFiles: any[] ) {
  let files = fs.readdirSync(dirPath)

  

  files.forEach(function(file: string) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file))
    }
  })

  return arrayOfFiles
}

const directoryPath = 'C:/local_projects/wyvern/data'; // Replace with your directory path
const file_names = getAllFiles(directoryPath, []);

const files = file_names.map((file: string) => {
  if (file.endsWith('.json')) {
    console.log(`Reading file: ${file}`);
    return file;
  } else {
    console.warn(`Skipping non-JSON file: ${file}`);
    return null;
  }
}).filter((file: string | null) => file !== null); // Filter out any null




const openAI_dim = 1536; // Dimension for OpenAI embeddings
type similarity_metric = 'cosine' | 'euclidean' | 'dot_product'; // Similarity metric for vector search
const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);

const db = client.db(ASTRA_DB_API_ENDPOINT, {namespace : ASTRA_DB_NAMESPACE});

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

const createCollection = async (similarity_metric: similarity_metric = "dot_product") => {
  try {
    const res = await db.createCollection(ASTRA_DB_COLLECTION, { 
    vector: {
        dimension: openAI_dim,
        metric: similarity_metric
        }
    }
    );
    console.log(`Collection ${ASTRA_DB_COLLECTION} created successfully.`);
    return res;
  } catch (error) {
    console.error(`Error creating collection: ${error}`);
  }
}
function flattenJson(json: any): string[] {
  const result: string[] = [];

  function recurse(curr: any, path: string[] = []) {
    if (typeof curr === 'object' && curr !== null) {
      for (const key in curr) {
        recurse(curr[key], path.concat(key));
      }
    } else {
      result.push(`${path.join('.')} = ${curr}`);
    }
  }

  recurse(json);
  return result;
}

const BATCH_SIZE = 10; 

const embedChunks = async (chunks: string[]) => {
  const results = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    
    const embeddings = await Promise.all(
      batch.map(async (c) => {
        const res = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: c,
          encoding_format: 'float',
        });
        return { embedding: res.data[0].embedding, text: c };
      })
    );

    results.push(...embeddings);
  }

  return results;
};

const loadSampleData = async () => {
  const collection = await db.collection(ASTRA_DB_COLLECTION);

  for await (const file of files) {
   const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    const flattened = flattenJson(parsed).join('\n');


    const docs = await splitter.splitDocuments([
      new Document({ pageContent: flattened, metadata: { source: file } }),
    ]);
    //possibly switch to all settled with error handling
    const embeddedChunks = await embedChunks(docs.map((doc) => doc.pageContent));

    await collection.insertMany(
      embeddedChunks.map((e, i) => ({
        $vector: e.embedding,
        text: e.text,
        metadata: docs[i].metadata, // Optional: store original file info
      }))
    );

    console.log(`Inserted ${embeddedChunks.length} chunks from ${file}`);
  }
};


createCollection().then(() => {
    console.log(`Collection ${ASTRA_DB_COLLECTION} created successfully.`);
    loadSampleData();
});