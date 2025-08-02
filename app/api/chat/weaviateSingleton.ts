// weaviateClientSingleton.ts
import weaviate, { WeaviateClient, ApiKey } from "weaviate-client"; // Correct import

let cachedWeaviateClient: WeaviateClient;

const WEAVIATE_HOST = process.env.WEAVIATE_HOST || "weaviate";
const WEAVIATE_PORT = process.env.WEAVIATE_PORT || "8080";
const WEAVIATE_SCHEME = process.env.WEAVIATE_SCHEME || "http";
const WEAVIATE_API_KEY = process.env.WEAVIATE_API_KEY; // For Weaviate Cloud

export async function getWeaviateSingleton(): Promise<WeaviateClient> {
  if (cachedWeaviateClient) {
    console.log("Using cached Weaviate client");
    return cachedWeaviateClient;
  }

  console.log("Creating new Weaviate client connection...");
  console.log("Weaviate host:", WEAVIATE_HOST);
  console.log("Weaviate port:", WEAVIATE_PORT);

  try {
    // Configure connection to the Docker container using REST API instead of gRPC
    cachedWeaviateClient = await weaviate.connectToLocal({
      host: WEAVIATE_HOST,
      port: parseInt(WEAVIATE_PORT)
    });
    
    console.log("✅ Weaviate client created successfully");
    return cachedWeaviateClient;
  } catch (error) {
    console.error("❌ Failed to connect to Weaviate:", error);
    console.error("Error details:", error.message, error.stack);
    throw new Error("Weaviate connection failed");
  }
}