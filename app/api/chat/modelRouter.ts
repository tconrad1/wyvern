// lib/modelRouter.ts
import { openai } from '@ai-sdk/openai';
import { mistral } from '@ai-sdk/mistral';
import { groq } from '@ai-sdk/groq';
import { LanguageModel } from 'ai';

type ModelInfo = {
  namespace: string;
  collection: string;
  endpoint: string;
  token: string;
  model: LanguageModel;
};

export function getModelInfo(name: string): ModelInfo {
  const namespace = process.env.ASTRA_DB_NAMESPACE!;
  const endpoint = process.env.ASTRA_DB_API_ENDPOINT!;
  const token = process.env.ASTRA_DB_APPLICATION_TOKEN!;
  const collection = process.env.ASTRA_DB_COLLECTION || "default_collection";
  switch (name) {
    case 'openai':
      return {
        namespace,
        collection: collection,
        endpoint,
        token,
        model: openai(process.env.OPENAI_API_KEY!)
      };
    case 'mistral':
      return {
        namespace,
        collection: collection,
        endpoint,
        token,
        model: mistral(process.env.MISTRAL_API_KEY!)
      };
    case 'groq':
      return {
        namespace,
        collection: collection,
        endpoint,
        token,
        model: groq(process.env.GROQ_API_KEY!)
      };
    default:
      throw new Error(`Unsupported model provider: ${name}`);
  }
}
