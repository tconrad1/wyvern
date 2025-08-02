import fetch from 'node-fetch';

async function testFunctionCalling(modelName) {
  console.log(`\n🧪 Testing function calling for ${modelName}...`);
  
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
            content: 'You are a helpful assistant. Use the available tools when needed.'
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
      
      console.log(`✅ ${modelName}: Function calling ${hasToolCalls ? 'SUPPORTED' : 'NOT SUPPORTED'}`);
      console.log(`📝 Response: ${responseText.substring(0, 100)}...`);
      console.log(`🔧 Tool calls: ${hasToolCalls ? data.tool_calls.length : 0}`);
      
      return { 
        model: modelName, 
        supportsFunctionCalling: hasToolCalls, 
        success: true,
        responseText: responseText
      };
    } else {
      console.log(`❌ ${modelName}: HTTP ${response.status}`);
      return { model: modelName, supportsFunctionCalling: false, success: false };
    }
  } catch (error) {
    console.log(`❌ ${modelName}: Error - ${error.message}`);
    return { model: modelName, supportsFunctionCalling: false, success: false };
  }
}

async function testAllModels() {
  console.log('🔧 Testing Function Calling Support for All Models\n');
  
  const models = [
    'llama3.2:3b',
    'phi3:mini',
    'mistral:7b',
    'mistral:latest'
  ];
  
  const results = [];
  
  for (const model of models) {
    const result = await testFunctionCalling(model);
    results.push(result);
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('\n📊 Function Calling Support Results:');
  console.log('=====================================');
  
  const supportedModels = results.filter(r => r.supportsFunctionCalling);
  const unsupportedModels = results.filter(r => !r.supportsFunctionCalling);
  
  if (supportedModels.length > 0) {
    console.log('\n✅ Models with Function Calling Support:');
    supportedModels.forEach(result => {
      console.log(`- ${result.model}`);
    });
  }
  
  if (unsupportedModels.length > 0) {
    console.log('\n❌ Models WITHOUT Function Calling Support:');
    unsupportedModels.forEach(result => {
      console.log(`- ${result.model}`);
    });
  }
  
  console.log(`\n💡 Recommendation: Use models with function calling support for best D&D DM experience.`);
}

testAllModels().catch(console.error); 