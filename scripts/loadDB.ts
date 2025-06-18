import {DataAPIClient } from '@datastax/astra-db-ts';
import { PuppeteerWebBaseLoader } from '@langchain/community/document_loaders/web/puppeteer';
import OpenAI from 'openai';

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

const directoryPath = 'C:/local_projects/wyvern'; // Replace with your directory path
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









const Five_E_Data = [
  'https://roll20.net/compendium/dnd5e/Free%20Basic%20Rules%20%282024%29',
  // 'https://5e.tools/book.html#xdmg',
  // 'https://5e.tools/book.html#xphb',
  // 'https://5e.tools/book.html#vgm',
  // 'https://5e.tools/data/bestiary/bestiary-mm.json'
  
];

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

const loadSampleData = async () => {
    const collection = await db.collection(ASTRA_DB_COLLECTION);
    for await (const url of Five_E_Data) {
        const content = await scrapePage(url);
        const chunk = await splitter.splitText(content);
        for await (const c of chunk) {
        const embeddings = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: chunk,
            encoding_format: 'float'
        });
      
    const vectors = embeddings.data[0].embedding;

    const res = await collection.insertOne ({
        $vector: vectors,
        text: c
    });
        console.log(`Inserted document with result of ${res}`);
    }
  }
  for await (const file of files) {
    // Read the file content, dealing with Windows path issues
    const content = JSON.stringify(fs.readFileSync(file, 'utf8'));
    
    const chunk = await splitter.splitText(content);
    for await (const c of chunk) {
      const embeddings = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: c,
        encoding_format: 'float'
      });
      
      const vectors = embeddings.data[0].embedding;

      const res = await collection.insertOne ({
        $vector: vectors,
        text: c
      });
      console.log(`Inserted document with result of ${res}`);
    }
  }

  
}
/*use pupetteer to scrape the page content*/
const scrapePage = async (url: string): Promise<string> => {
   const loader = new PuppeteerWebBaseLoader(url, {
    launchOptions: {
        headless: true,
        args :['--disable-features=HttpsFirstBalancedModeAutoEnable'],
        
        
    },
    gotoOptions: {
        waitUntil: 'domcontentloaded',
    },
    evaluate : async (page,browser) => {
        const result = await page.evaluate(() => document.body.innerText);
        await browser.close();
        return result;
    }
    });
    /* Scrape the page content and return it, stripping html tags*/
    return (await loader.scrape())?.replace(/<[^>]*>/gm, '');
}

createCollection().then(() => {
    console.log(`Collection ${ASTRA_DB_COLLECTION} created successfully.`);
    loadSampleData();
});
