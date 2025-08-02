// Test script to verify project setup
import fetch from 'node-fetch';

// Environment variables for Docker compatibility
const SERVER_HOST = process.env.SERVER_HOST || 'localhost';
const SERVER_PORT = process.env.SERVER_PORT || '3000';
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'localhost';
const OLLAMA_PORT = process.env.OLLAMA_PORT || '11434';
const WEAVIATE_HOST = process.env.WEAVIATE_HOST || 'localhost';
const WEAVIATE_PORT = process.env.WEAVIATE_PORT || '8080';

async function testSetup() {
  console.log('🧪 Testing Wyvern Project Setup...\n');

  // Test 1: Check if server is running
  console.log('1. Testing server connectivity...');
  try {
    const response = await fetch(`http://${SERVER_HOST}:${SERVER_PORT}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        campaignId: 'test',
        messages: [{ role: 'user', content: 'Roll a d20' }]
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Server is running and responding');
      console.log(`📊 Response: ${data.text}`);
    } else {
      console.log(`❌ Server error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log(`❌ Server connection failed: ${error.message}`);
  }

  // Test 2: Check Ollama
  console.log('\n2. Testing Ollama...');
  try {
    const ollamaResponse = await fetch(`http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/tags`);
    if (ollamaResponse.ok) {
      const ollamaData = await ollamaResponse.json();
      console.log('✅ Ollama is running');
      console.log(`📊 Available models: ${ollamaData.models.map(m => m.name).join(', ')}`);
    } else {
      console.log('❌ Ollama not responding');
    }
  } catch (error) {
    console.log(`❌ Ollama connection failed: ${error.message}`);
  }

  // Test 3: Check Weaviate
  console.log('\n3. Testing Weaviate...');
  try {
    const weaviateResponse = await fetch(`http://${WEAVIATE_HOST}:${WEAVIATE_PORT}/v1/meta`);
    if (weaviateResponse.ok) {
      console.log('✅ Weaviate is running');
    } else {
      console.log('❌ Weaviate not responding');
    }
  } catch (error) {
    console.log(`❌ Weaviate connection failed: ${error.message}`);
  }

  console.log('\n🎉 Setup test completed!');
}

testSetup().catch(console.error); 