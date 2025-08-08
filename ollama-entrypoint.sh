#!/bin/sh
set -e

MODEL_NAME="qwen2-7b-q5"
MODEL_FILE="/models/Qwen2-7B-q5-1.gguf"

# Start Ollama server in background
ollama serve &

# Wait for Ollama server to be ready (max 60 seconds)
echo "Waiting for Ollama server to start..."
for i in $(seq 1 60); do
  if ollama list > /dev/null 2>&1; then
    echo "Ollama server is up!"
    break
  fi
  sleep 1
done

if ! ollama list > /dev/null 2>&1; then
  echo "Error: Ollama server failed to start."
  exit 1
fi

# Check model file presence
if [ -f "$MODEL_FILE" ]; then
  echo "Found local model file: $MODEL_FILE"
  echo "FROM $MODEL_FILE" > /tmp/Modelfile

  echo "Registering $MODEL_NAME from local file..."
  if ! ollama create "$MODEL_NAME" -f /tmp/Modelfile; then
    echo "Error: could not create model from local file"
    exit 1
  fi
else
  echo "Error: model file not found at $MODEL_FILE"
  exit 1
fi

# Keep container running
tail -f /dev/null
