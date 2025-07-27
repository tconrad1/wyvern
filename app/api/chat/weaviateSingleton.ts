// weaviateClientSingleton.ts
import weaviate, { WeaviateClient, ApiKey } from "weaviate-client"; // Correct import

let cachedWeaviateClient: WeaviateClient;

const WEAVIATE_HOST = process.env.WEAVIATE_HOST || "weaviate";
const WEAVIATE_SCHEME = process.env.WEAVIATE_SCHEME || "http";
const WEAVIATE_API_KEY = process.env.WEAVIATE_API_KEY; // For Weaviate Cloud

export async function getWeaviateSingleton(): Promise<WeaviateClient> {
  if (cachedWeaviateClient) {
    return cachedWeaviateClient;
  }

  try {
    // Configure connection to the Docker container
    cachedWeaviateClient = await weaviate.connectToLocal({
      host: WEAVIATE_HOST
    });
    
    return cachedWeaviateClient;
  } catch (error) {
    console.error("Failed to connect to Weaviate:", error);
    throw new Error("Weaviate connection failed");
  }
}