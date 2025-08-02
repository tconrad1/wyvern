import fetch from 'node-fetch';

async function testFunctionCalling() {
  console.log('🔧 DEBUGGING FUNCTION CALLING');
  console.log('==============================\n');
  
  const baseURL = 'http://localhost:11434';
  
  // Test 1: Check if Ollama is running
  console.log('1. Checking Ollama status...');
  try {
    const statusResponse = await fetch(`${baseURL}/api/tags`);
    if (statusResponse.ok) {
      const data = await statusResponse.json();
      console.log('✅ Ollama is running');
      console.log('Available models:', data.models.map((m) => m.name));
    } else {
      console.log('❌ Ollama is not responding');
      return;
    }
  } catch (error) {
    console.log('❌ Cannot connect to Ollama:', error.message);
    return;
  }
  
  // Test 2: Test function calling with a simple prompt
  console.log('\n2. Testing function calling...');
  
  const testRequest = {
    model: 'llama3.2:3b',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant. When asked to roll dice, use the rollDie function.'
      },
      {
        role: 'user',
        content: 'Roll a d20 for me'
      }
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'rollDie',
          description: 'Roll a die with specified sides, advantage/disadvantage, and offset',
          parameters: {
            type: 'object',
            properties: {
              sides: {
                type: 'number',
                description: 'Number of sides on the die (e.g., 6 for d6, 20 for d20)'
              },
              advantage: {
                type: 'boolean',
                description: 'Whether to roll with advantage (take higher of two rolls)'
              },
              disadvantage: {
                type: 'boolean',
                description: 'Whether to roll with disadvantage (take lower of two rolls)'
              },
              offset: {
                type: 'number',
                description: 'Number to add to the final roll result'
              }
            },
            required: ['sides']
          }
        }
      }
    ],
    stream: false,
    options: {
      temperature: 0.3,
      num_predict: 256
    }
  };
  
  try {
    console.log('Sending request to Ollama...');
    const response = await fetch(`${baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testRequest),
      signal: AbortSignal.timeout(30000)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Response received');
      console.log('Response keys:', Object.keys(data));
      console.log('Message content:', data.message?.content);
      console.log('Tool calls:', data.tool_calls);
      
      if (data.tool_calls && data.tool_calls.length > 0) {
        console.log('🎉 FUNCTION CALLING WORKS!');
        data.tool_calls.forEach((call, index) => {
          console.log(`Tool call ${index + 1}:`);
          console.log(`  Name: ${call.function.name}`);
          console.log(`  Arguments: ${call.function.arguments}`);
        });
      } else {
        console.log('❌ No function calls in response');
        console.log('Full response:', JSON.stringify(data, null, 2));
      }
    } else {
      console.log('❌ Ollama API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.log('Error details:', errorText);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
  
  // Test 3: Check if the model supports function calling
  console.log('\n3. Checking model capabilities...');
  try {
    const modelResponse = await fetch(`${baseURL}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'llama3.2:3b' })
    });
    
    if (modelResponse.ok) {
      const modelData = await modelResponse.json();
      console.log('Model details:');
      console.log('  Format:', modelData.details?.format);
      console.log('  Family:', modelData.details?.family);
      console.log('  Parameter size:', modelData.details?.parameter_size);
      console.log('  Quantization:', modelData.details?.quantization_level);
    }
  } catch (error) {
    console.log('Could not get model details:', error.message);
  }
}

testFunctionCalling().catch(console.error); 