// Test script to verify project setup
import fetch from 'node-fetch';

async function testSetup() {
  console.log('🧪 Testing Wyvern Project Setup...\n');

  // Test 1: Check if server is running
  console.log('1. Testing server connectivity...');
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
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
    const ollamaResponse = await fetch('http://localhost:11434/api/tags');
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
    const weaviateResponse = await fetch('http://localhost:8080/v1/meta');
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