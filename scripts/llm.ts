// llm.ts
import OpenAI from "openai";

const { LLM_PROVIDER, OPENAI_API_KEY, GROQ_API_KEY } = process.env;

if (!LLM_PROVIDER || !["openai", "groq"].includes(LLM_PROVIDER)) {
  throw new Error("LLM_PROVIDER must be set to 'openai' or 'groq'");
}

const isGroq = LLM_PROVIDER === "groq";

export const llmClient = new OpenAI({
  apiKey: isGroq ? GROQ_API_KEY : OPENAI_API_KEY,
  baseURL: isGroq ? "https://api.groq.com/openai/v1" : undefined,
});
