import weaviate, { WeaviateClient, configure, dataType, vectorizer } from 'weaviate-client'

// Use Docker service name when running in container, localhost for local development
const WEAVIATE_HOST = process.env.WEAVIATE_HOST || 'localhost';
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'localhost';

const client =  await weaviate.connectToLocal({
  host: WEAVIATE_HOST,
  port: 8080
});

async function createSchema () {
  await client.collections.create({
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
    },
  ],
});
}

createSchema().catch(console.error);
