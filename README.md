# 🐉 Wyvern DM — AI Dungeon Master for D&D 5e

Wyvern DM is a Next.js-based web app that serves as an AI-powered Storyteller based on your favorite TTRPGS. It supports multiple LLM providers (OpenAI, Mistral, Groq) and integrates retrieval-augmented generation (RAG) using a local self-hosted Weaviate vector database with Ollama for local embeddings.

---

## ✨ Features

- 🧠 **Multi-model support**: Choose between OpenAI, Mistral, and Groq via config.
- 🗺️ **Contextual reasoning**: Uses embedded rules and context for smarter, lore-aware responses.
- 🧩 **Dynamic game state updates**: Extracts and applies JSON-based player/monster updates from AI responses.
- 🧠 **Local Embeddings + Weaviate**: Uses Ollama with Weaviate for vector search.
- 🎲 **Custom Prompt Suggestions**: Kickstart your journey with built-in prompt ideas.
- 🧪 **Streaming responses**: Enjoy token-by-token AI responses with real-time feedback.
- 🐳 **Docker Support**: Full containerized development environment.

---

## 📦 Stack

| Layer        | Tech                          |
|-------------|-------------------------------|
| UI          | React + Next.js (App Router)  |
| LLM Backend | OpenAI, Mistral, Groq via SDK |
| RAG         | Ollama embeddings + Weaviate  |
| DB          | MongoDB + Weaviate (Docker)  |
| Local AI    | Ollama (Docker)               |
| Deployment  | Local or Vercel               |

---

## 🛠 Setup Options

You can run Wyvern DM in two ways:

### 🐳 **Option 1: Docker (Recommended)**
Everything runs in containers - easiest setup.

### 💻 **Option 2: Local Development**
Run services locally with Docker backend.

---

## 🐳 Docker Setup (Recommended)

### 1. Prerequisites
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### 2. Clone & Setup
```bash
git clone https://github.com/your-username/wyvern-dm.git
cd wyvern-dm
npm install
```

### 3. Environment Configuration
Copy the Docker environment template:
```bash
cp docker.env.template .env
```

Edit `.env` and add your API keys:
```env
# Required API Keys (at least one)
OPENAI_API_KEY=sk-...
MISTRAL_API_KEY=your-mistral-key
GROQ_API_KEY=your-groq-key

# Optional: Google AI
GOOGLE_API_KEY=your-google-key
```

### 4. Start Docker Services
```bash
docker-compose up -d
```

This starts:
- **App**: Next.js development server (port 3000)
- **MongoDB**: Database (port 27018)
- **Weaviate**: Vector database (port 8080)
- **Ollama**: Local AI models (port 11434)

### 5. Initialize Weaviate Schema
```bash
docker-compose exec app npm run docker:init:weaviate
```

### 6. Load Data (Optional)
```bash
docker-compose exec app npm run docker:load
```

### 7. Test Setup
```bash
docker-compose exec app npm run docker:test:setup
```

### 8. Access the App
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 💻 Local Development Setup

### 1. Prerequisites
- Node.js 18+
- [Docker](https://docs.docker.com/get-docker/) (for backend services)
- [Ollama](https://ollama.ai/) (optional, for local AI)

### 2. Clone & Setup
```bash
git clone https://github.com/your-username/wyvern-dm.git
cd wyvern-dm
npm install
```

### 3. Environment Configuration
Create `.env` file:
```env
# API Keys (at least one required)
OPENAI_API_KEY=sk-...
MISTRAL_API_KEY=your-mistral-key
GROQ_API_KEY=your-groq-key

# Weaviate Configuration
WEAVIATE_HOST=localhost
WEAVIATE_PORT=8080
WEAVIATE_SCHEME=http

# Ollama Configuration (if running locally)
OLLAMA_HOST=localhost
OLLAMA_PORT=11434

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/wyvern_ai
```

### 4. Start Backend Services (Docker)
```bash
# Start only backend services
docker-compose up -d mongo weaviate ollama
```

### 5. Initialize Weaviate Schema
```bash
npm run init:weaviate
```

### 6. Load Data (Optional)
```bash
npm run load
```

### 7. Test Setup
```bash
npm run test:setup
```

### 8. Start Development Server
```bash
npm run dev
```

### 9. Access the App
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Available Scripts

### Docker Scripts (run inside containers)
```bash
# Test all services
docker-compose exec app npm run docker:test:setup

# Initialize Weaviate schema
docker-compose exec app npm run docker:init:weaviate

# Load data into Weaviate
docker-compose exec app npm run docker:load

# Run AI tests
docker-compose exec app npm run docker:test-alpha
```

### Local Scripts (run on host machine)
```bash
# Development
npm run dev                    # Start dev server
npm run dev:full              # Setup + dev server
npm run dev:setup             # Check Ollama + setup + dev

# Build & Lint
npm run build                 # Build for production
npm run lint                  # Run ESLint

# Data Management
npm run init:weaviate         # Initialize Weaviate schema
npm run load                  # Load data into Weaviate
npm run test-alpha            # Run AI tests
npm run test:setup            # Test all services

# Ollama Management
npm run start:ollama          # Start Ollama locally
npm run check:ollama          # List available models
```

---

## 🔧 Docker Management

### Start Services
```bash
docker-compose up -d
```

### Stop Services
```bash
docker-compose down
```

### View Logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs app
docker-compose logs weaviate
docker-compose logs ollama
```

### Restart Services
```bash
docker-compose restart
```

### Clean Up
```bash
# Stop and remove containers
docker-compose down

# Stop and remove containers + volumes
docker-compose down -v

# Remove all data
docker-compose down -v
docker volume rm wyvern_mongo_data wyvern_weaviate_data wyvern_ollama_data
```

---

## 🚀 Production Deployment

### Docker Production
```bash
# Build production image
docker build -t wyvern-dm .

# Run with production environment
docker run -p 3000:3000 --env-file .env wyvern-dm
```

### Vercel Deployment
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

---

## 🐛 Troubleshooting

### Common Issues

**1. Weaviate "leader not found" error**
```bash
# Restart Weaviate container
docker-compose restart weaviate
```

**2. Permission denied on build**
```bash
# Clean .next directory
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

**3. Ollama not responding**
```bash
# Check Ollama status
docker-compose exec ollama ollama list

# Pull required models
docker-compose exec ollama ollama pull nomic-embed-text
```

**4. Port conflicts**
```bash
# Check what's using the ports
netstat -ano | findstr :3000
netstat -ano | findstr :8080
netstat -ano | findstr :11434
```

### Environment Variables

Make sure your `.env` file has the correct values:

**For Docker:**
```env
WEAVIATE_HOST=weaviate
OLLAMA_HOST=ollama
```

**For Local:**
```env
WEAVIATE_HOST=localhost
OLLAMA_HOST=localhost
```

---

## 📚 API Documentation

### Chat Endpoint
```bash
POST /api/chat
Content-Type: application/json

{
  "campaignId": "your-campaign-id",
  "messages": [
    {
      "role": "user",
      "content": "Roll a d20"
    }
  ]
}
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with Docker setup
5. Submit a pull request

---

## 📄 License

This project is licensed under the MIT License.
