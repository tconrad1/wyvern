# Docker Scripts Guide

This document explains how to use the scripts with Docker setup.

## Environment Setup

### For Local Development
Use the default scripts with localhost:
```bash
npm run init:weaviate
npm run load
npm run test-alpha
npm run test:setup
```

### For Docker Development
Use the Docker-specific scripts with service names:
```bash
npm run docker:init:weaviate
npm run docker:load
npm run docker:test-alpha
npm run docker:test:setup
```

## Environment Variables

### Local Development (.env)
```bash
WEAVIATE_HOST=localhost
WEAVIATE_PORT=8080
OLLAMA_HOST=localhost
OLLAMA_PORT=11434
SERVER_HOST=localhost
SERVER_PORT=3000
DATA_DIR=C:/local_projects/wyvern/data
```

### Docker Development (.env)
```bash
WEAVIATE_HOST=weaviate
WEAVIATE_PORT=8080
OLLAMA_HOST=ollama
OLLAMA_PORT=11434
SERVER_HOST=app
SERVER_PORT=3000
DATA_DIR=/app/data
```

## Running Scripts in Docker

### 1. Start Docker Services
```bash
docker-compose up -d
```

### 2. Run Scripts Inside Container
```bash
# Initialize Weaviate schema
docker-compose exec app npm run docker:init:weaviate

# Load data into Weaviate
docker-compose exec app npm run docker:load

# Test the setup
docker-compose exec app npm run docker:test:setup

# Run AI tests
docker-compose exec app npm run docker:test-alpha
```

### 3. Run Scripts Locally (with Docker services)
```bash
# Copy docker.env.template to .env and update values
cp docker.env.template .env

# Run scripts
npm run docker:init:weaviate
npm run docker:load
npm run docker:test:setup
npm run docker:test-alpha
```

## Script Differences

| Script | Local | Docker | Purpose |
|--------|-------|--------|---------|
| `init:weaviate` | localhost | weaviate | Initialize Weaviate schema |
| `load` | localhost:8080 | weaviate:8080 | Load data into Weaviate |
| `test-alpha` | ts-node | node --loader | Run AI tests |
| `test:setup` | localhost | service names | Test all services |

## Troubleshooting

### Weaviate Connection Issues
- Ensure Weaviate container is running: `docker-compose ps`
- Check logs: `docker-compose logs weaviate`
- Verify port mapping: `docker port weaviate`

### Ollama Connection Issues
- Ensure Ollama container is running: `docker-compose ps`
- Check logs: `docker-compose logs ollama`
- Pull required models: `docker-compose exec ollama ollama pull nomic-embed-text`

### Script Execution Issues
- Ensure TypeScript dependencies are installed
- Check environment variables are set correctly
- Verify service names match docker-compose.yml

## Service Dependencies

The scripts require these services to be running:
- **Weaviate**: Vector database (port 8080)
- **Ollama**: Local LLM service (port 11434)
- **MongoDB**: Document database (port 27017)
- **App**: Next.js application (port 3000) 