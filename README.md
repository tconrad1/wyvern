# 🐉 Wyvern DM — AI Dungeon Master for D&D 5e

Wyvern DM is a Next.js-based web app that serves as an AI-powered Dungeon Master for 5th Edition Dungeons & Dragons. It supports multiple LLM providers (OpenAI, Mistral, Groq) and integrates retrieval-augmented generation (RAG) using a local self-hosted Weaviate vector database (currently in the process of implementing this, as I move away from datastax hosting).

---

## ✨ Features

- 🧠 **Multi-model support**: Choose between OpenAI, Mistral, and Groq via config.
- 🗺️ **Contextual reasoning**: Uses embedded rules and context for smarter, lore-aware responses.
- 🧩 **Dynamic game state updates**: Extracts and applies JSON-based player/monster updates from AI responses.
- 🧠 **OpenAI Embeddings + Weaviate**: Uses OpenAI’s embedding model with Weaviate for vector search.
- 🎲 **Custom Prompt Suggestions**: Kickstart your journey with built-in prompt ideas.
- 🧪 **Streaming responses**: Enjoy token-by-token AI responses with real-time feedback.

---

## 📦 Stack

| Layer        | Tech                          |
|-------------|-------------------------------|
| UI          | React + Next.js (App Router)  |
| LLM Backend | OpenAI, Mistral, Groq via SDK |
| RAG         | OpenAI embeddings + Weaviate  |
| DB          | Self-hosted Weaviate (Docker) |
| Deployment  | Local or Vercel               |

---

## 🛠 Setup

### 1. Clone

```bash
git clone https://github.com/your-username/wyvern-dm.git
cd wyvern-dm
npm install
```
## Env 
create your .env file withh the following info 
OPENAI_API_KEY=sk-...
MISTRAL_API_KEY=your-mistral-key
GROQ_API_KEY=your-groq-key

WEAVIATE_HOST=localhost:8080
WEAVIATE_SCHEME=http 

## DB 
Start Weaviate (locally via Docker)
bash
Copy
Edit
docker-compose up -d

## Run 
npm run dev
