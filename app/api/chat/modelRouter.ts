import { openai } from '@ai-sdk/openai';
import { mistral } from '@ai-sdk/mistral';
import { groq } from '@ai-sdk/groq';
import { google } from '@ai-sdk/google';
import { LanguageModel } from 'ai';

export type ModelInfo = {
  model: LanguageModel;
  mongoUri: string;
  mongoDb: string;
  weaviateUrl: string;
  weaviateApiKey: string;
  provider: 'openai' | 'mistral' | 'groq' | 'gemini';
  isGemini: boolean;
};

export function getModelInfo(name: string): ModelInfo {
  const mongoUri = process.env.MONGODB_URI!;
  const mongoDb = process.env.MONGODB_DB || "default_db";
  const weaviateUrl = process.env.WEAVIATE_URL!;
  const weaviateApiKey = process.env.WEAVIATE_API_KEY!;

  switch (name) {
    case 'gemini':
      return {
        model: google('models/gemini-2.5-flash'), // ✅ No tools here
        mongoUri,
        mongoDb,
        weaviateUrl,
        weaviateApiKey,
        provider: 'gemini',
        isGemini: true,
      };

    case 'openai':
      return {
        model: openai('gpt-3.5-turbo'),
        mongoUri,
        mongoDb,
        weaviateUrl,
        weaviateApiKey,
        provider: 'openai',
        isGemini: false,
      };

    case 'mistral':
      return {
        model: mistral('mistral-small'),
        mongoUri,
        mongoDb,
        weaviateUrl,
        weaviateApiKey,
        provider: 'mistral',
        isGemini: false,
      };

    case 'groq':
      return {
        model: groq('llama3-70b-8192'),
        mongoUri,
        mongoDb,
        weaviateUrl,
        weaviateApiKey,
        provider: 'groq',
        isGemini: false,
      };

    default:
      throw new Error(`Unsupported model provider: ${name}`);
  }
}
