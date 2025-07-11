import weaviate, { WeaviateClient, configure, dataType } from 'weaviate-client'

const client =  await weaviate.connectToCustom({
  httpHost: 'localhost',
});

async function createSchema () {
  await client.collections.create({
  name: 'RuleContext',
  vectorizers: configure.vectorizer.text2VecOllama({
    model: 'nomic-embed-text',
    apiEndpoint: 'http://host.docker.internal:11435'
  }),
  properties: [
    {
      name: 'text',
      dataType: dataType.TEXT,
    },
  ],
});
}

createSchema().catch(console.error);
