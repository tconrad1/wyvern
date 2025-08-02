import fetch from 'node-fetch';

async function checkOllamaStatus() {
  try {
    console.log('🔍 Checking Ollama status...');
    const response = await fetch('http://localhost:11434/api/tags');
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Ollama is running');
      console.log('📋 Available models:');
      data.models.forEach(model => {
        console.log(`  - ${model.name} (${model.size} bytes)`);
      });
      return data.models.map(m => m.name);
    } else {
      console.log('❌ Ollama is not responding');
      return [];
    }
  } catch (error) {
    console.log('❌ Cannot connect to Ollama:', error.message);
    return [];
  }
}

async function testModelFunctionCalling(modelName) {
  console.log(`\n🧪 Testing ${modelName} function calling...`);
  
  try {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'system',
            content: 'You are a D&D Dungeon Master. Use the available tools when needed.'
          },
          {
            role: 'user',
            content: 'Roll a d20 for me.'
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
      })
    });

    if (response.ok) {
      const data = await response.json();
      const hasToolCalls = data.tool_calls && data.tool_calls.length > 0;
      const responseText = data.message?.content || '';
      
      console.log(`✅ ${modelName}: ${hasToolCalls ? 'FUNCTION CALLING SUPPORTED' : 'NO FUNCTION CALLING'}`);
      console.log(`📝 Response: ${responseText.substring(0, 100)}...`);
      console.log(`🔧 Tool calls: ${hasToolCalls ? data.tool_calls.length : 0}`);
      
      if (hasToolCalls) {
        console.log(`🎲 Tool call details:`, JSON.stringify(data.tool_calls[0], null, 2));
      }
      
      return { 
        model: modelName, 
        supportsFunctionCalling: hasToolCalls, 
        success: true,
        responseText: responseText
      };
    } else {
      const errorText = await response.text();
      console.log(`❌ ${modelName}: HTTP ${response.status} - ${errorText}`);
      return { model: modelName, supportsFunctionCalling: false, success: false };
    }
  } catch (error) {
    console.log(`❌ ${modelName}: Error - ${error.message}`);
    return { model: modelName, supportsFunctionCalling: false, success: false };
  }
}

async function testAllModels() {
  console.log('🔧 Testing All Installed Models\n');
  
  // First check what models are available
  const availableModels = await checkOllamaStatus();
  
  if (availableModels.length === 0) {
    console.log('\n❌ No models found. Please ensure:');
    console.log('1. Docker is running');
    console.log('2. Ollama container is started: docker-compose up -d');
    console.log('3. Models are installed');
    return;
  }
  
  console.log(`\n🧪 Testing ${availableModels.length} models for function calling support...`);
  
  const results = [];
  
  for (const model of availableModels) {
    const result = await testModelFunctionCalling(model);
    results.push(result);
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n📊 Function Calling Support Results:');
  console.log('=====================================');
  
  const supportedModels = results.filter(r => r.supportsFunctionCalling);
  const unsupportedModels = results.filter(r => !r.supportsFunctionCalling);
  
  if (supportedModels.length > 0) {
    console.log('\n✅ Models with Function Calling Support:');
    supportedModels.forEach(result => {
      console.log(`- ${result.model} (RECOMMENDED for D&D DM)`);
    });
  }
  
  if (unsupportedModels.length > 0) {
    console.log('\n❌ Models WITHOUT Function Calling Support:');
    unsupportedModels.forEach(result => {
      console.log(`- ${result.model} (Limited D&D functionality)`);
    });
  }
  
  if (supportedModels.length === 0) {
    console.log('\n⚠️  WARNING: No models support function calling!');
    console.log('This means the D&D DM cannot:');
    console.log('- Roll dice automatically');
    console.log('- Update player/monster stats');
    console.log('- Log campaign events');
    console.log('- Manage game state');
    console.log('\n💡 Recommendation: Install models with function calling support.');
  } else {
    console.log(`\n🎉 Found ${supportedModels.length} model(s) with function calling support!`);
    console.log('These models will work properly with the D&D DM functionality.');
  }
}

testAllModels().catch(console.error); 