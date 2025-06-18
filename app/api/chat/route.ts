import OpenAI from "openai";
import {openai } from '@ai-sdk/openai'
// import {OpenAIStream, StreamingTextResponse} from "@ai-sdk/openai";
import {streamText} from "ai"
import { DataAPIClient } from "@datastax/astra-db-ts";

const curr_limit_for_find = 10; // This is the limit for the find operation in the database

const  {ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    OPENAI_API_KEY
} = process.env;


// const openai = new OpenAI({
//   apiKey: OPENAI_API_KEY,
// });

const openaiClient = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const client = new DataAPIClient(
 ASTRA_DB_APPLICATION_TOKEN,
  
);

const db = client.db(ASTRA_DB_API_ENDPOINT ? ASTRA_DB_API_ENDPOINT : "default_endpoint", {namespace: ASTRA_DB_NAMESPACE});



export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const latestMessage = messages[messages.length - 1]?.content;

    let docContext = "";


    const embedding = await openaiClient.embeddings.create({
      model: "text-embedding-3-small",
      input : latestMessage,
      encoding_format: "float"
    });

    try {
        const collection = await db.collection(ASTRA_DB_COLLECTION? ASTRA_DB_COLLECTION : "default_collection");

        // needs to be a null filter for the find operation
        const cursor = collection.find( {}, {
            sort: {
                $vector: embedding.data[0].embedding,
            },
            limit: curr_limit_for_find
        });

        const documents = await cursor.toArray();

        const docsMap = documents?.map(doc => doc.text);

        docContext = JSON.stringify(docsMap);
    }
    catch (error) {
        console.error("Error querying the database:", error);
        docContext = "No relevant documents found.";
        return new Response("Internal Server Error", { status: 500 });
    }

    const template = {
        role: "system",
        content: `You are an AI assistent and Dungeon Master for players who are playing a game of D&D 5e.
        If you don't know something or are incapable of answering a question or roleplay request please just say so to the user/player. The material you will be provided as context will mostly be rules for D&D 5e, but may also include lore and other information. 
        It originally came formatted as JSON. Thank You for your help in this matter.
        START CONTEXT ${docContext} END OF CONTEXT


        You will now be provided with a question or request from the user. Please answer it to the best of your ability, using the context provided.
        If you are unable to answer the question or request, please let the user know that you are unable to answer it.
        The user will be asking you questions about D&D 5e rules, lore, and other information. Please answer them to the best of your ability. You may also use previous messages in the conversation to help you answer the question or request.

        QUESTION: ${latestMessage}`

    }
  

    const response = await streamText({
      model: openai('gpt-4o'),
      messages: [template , ...messages],
     
    });



    return (response.toDataStreamResponse());

  } catch (error) {
    console.error("Error processing request:", error);
    return new Response("Internal Server Error", { status: 500 });
  }

  
}