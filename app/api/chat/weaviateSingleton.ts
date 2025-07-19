// weaviateClientSingleton.ts
import weaviate, { WeaviateClient, ApiKey } from "weaviate-client"; // Correct import

let cachedWeaviateClient: WeaviateClient ;

const WEAVIATE_HOST = process.env.WEAVIATE_HOST || "localhost:8080";
const WEAVIATE_SCHEME = process.env.WEAVIATE_SCHEME || "http";
const WEAVIATE_API_KEY = process.env.WEAVIATE_API_KEY; // For Weaviate Cloud

export async function getWeaviateSingleton(): Promise<WeaviateClient> {
  if (cachedWeaviateClient) {
    return cachedWeaviateClient;
  }

  // Configure connection based on your setup (local vs. cloud)
  if (WEAVIATE_HOST && WEAVIATE_SCHEME) {
    cachedWeaviateClient = await weaviate.connectToLocal();

    
  } else {
    // Fallback or throw an error if configuration is missing
    throw new Error("Weaviate host and scheme must be configured.");
  }

  // Example for Weaviate Cloud connection with new client (if you switch to cloud)
  /*
  if (process.env.WEAVIATE_URL && WEAVIATE_API_KEY) {
    cachedWeaviateClient = weaviate.connectToWeaviateCloud(
      process.env.WEAVIATE_URL,
      {
        authCredentials: new ApiKey(WEAVIATE_API_KEY),
        // Add any other headers or configurations needed
      }
    );
  } else if (WEAVIATE_HOST && WEAVIATE_SCHEME) {
    cachedWeaviateClient = weaviate.connectToLocal({
      host: WEAVIATE_HOST,
      port: parseInt(WEAVIATE_HOST.split(":")[1] || "8080"), // Extract port if needed
      scheme: WEAVIATE_SCHEME as "http" | "https" // Cast to valid scheme types
    });
  } else {
    throw new Error("Weaviate configuration is incomplete.");
  }
  */


  return cachedWeaviateClient;
}