import {DataAPIClient } from '@datastax/astra-db-ts';
import { PuppeteerWebBaseLoader } from '@langchain/community/document_loaders/web/puppeteer';
import OpenAI from 'openai';
import { Document } from 'langchain/document';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter'; 
import pLimit from "p-limit";
import  "dotenv/config";
import { headersArray } from 'puppeteer/src/puppeteer.js';
import fs from 'fs';
import path from 'path';
import { encoding_for_model } from "tiktoken";
const enc = encoding_for_model("text-embedding-3-small");


const { ASTRA_DB_NAMESPACE, ASTRA_DB_COLLECTION, ASTRA_DB_API_ENDPOINT, ASTRA_DB_APPLICATION_TOKEN, OPENAI_API_KEY } = process.env;

//p limit for batch embedding ie concurrent api calls to embed
// can be adjusted for efficiency or to avoid throttling 
const limit = pLimit(5);
const MAX_TOKENS = 8192; // Max tokens for OpenAI API, adjust as needed
const directoryPath = 'C:/local_projects/wyvern/data'; // Replace with your directory path
const file_names = getAllFiles(directoryPath, []);


if (!ASTRA_DB_NAMESPACE || !ASTRA_DB_COLLECTION || !ASTRA_DB_API_ENDPOINT || !ASTRA_DB_APPLICATION_TOKEN || !OPENAI_API_KEY) {
  throw new Error("Missing required environment variables");
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
/*prepare for local file scraping */


function getAllFiles(dirPath: string, arrayOfFiles: any[] ) {
  const files = fs.readdirSync(dirPath)

  

  files.forEach(function(file: string) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file))
    }
  })

  return arrayOfFiles
}



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

//deal withh potentialy large files
const filterChunksByTokenLimit = (chunks: string[], maxTokens: number = MAX_TOKENS): string[] => {
  return chunks.filter(chunk => enc.encode(chunk).length <= maxTokens);
};

const filterDocumentsByTokenLimit = (
  docs: Document[],
  maxTokens: number = 8192
): Document[] => {
  return docs.filter((doc) => enc.encode(doc.pageContent).length <= maxTokens);
};





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




const embedChunks = async (chunks: string[]) => {
  const tasks = chunks.map((c) =>
    limit(async () => {
      const res = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: c,
        encoding_format: 'float',
      });
      return { embedding: res.data[0].embedding, text: c };
    })
  );

  const results = await Promise.allSettled(tasks);

  // Filter and handle errors
  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => (r as PromiseFulfilledResult<{ embedding: number[]; text: string }>).value);
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
    // const embeddedChunks = await embedChunks(docs.map((doc) => doc.pageContent));
   const safeDocs = filterDocumentsByTokenLimit(docs);

  if (safeDocs.length < docs.length) {
    console.warn(`Skipped ${docs.length - safeDocs.length} overlong chunks from file ${file}`);
  }

  if (safeDocs.length < docs.length) {
    console.warn(`Skipped ${docs.length - safeDocs.length} overlong chunks from file ${file}`);
  }

  const embeddedChunks = await embedChunks(safeDocs.map((doc) => doc.pageContent));
  if (embeddedChunks.length === 0) {
    console.warn(`No valid embeddings for file ${file}`);
    continue;
  }

  await collection.insertMany(
    embeddedChunks.map((e, i) => ({
      $vector: e.embedding,
      text: e.text,
      metadata: safeDocs[i].metadata, // stored metadata
    }))
  );

    console.log(`Inserted ${embeddedChunks.length} chunks from ${file}`);
  }
};


createCollection().then(() => {
    console.log(`Collection ${ASTRA_DB_COLLECTION} created successfully.`);
    loadSampleData();
});