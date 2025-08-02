import fetch from 'node-fetch';

async function testModelPerformance(modelName) {
  const startTime = Date.now();
  
  try {
    console.log(`\n🧪 Testing ${modelName}...`);
    
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        campaignId: 'perf-test',
        messages: [
          {
            role: 'user',
            content: 'Roll a d20 and tell me the result.',
            timestamp: new Date().toISOString()
          }
        ],
        providerType: 'ollama',
        modelName: modelName
      })
    });

    if (response.ok) {
      const data = await response.json();
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      console.log(`✅ ${modelName}: ${duration.toFixed(2)}s`);
      console.log(`📝 Response: ${data.text.substring(0, 100)}...`);
      return { model: modelName, duration, success: true };
    } else {
      console.log(`❌ ${modelName}: Failed (${response.status})`);
      return { model: modelName, duration: null, success: false };
    }
  } catch (error) {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    console.log(`❌ ${modelName}: Error after ${duration.toFixed(2)}s - ${error.message}`);
    return { model: modelName, duration, success: false };
  }
}

async function runPerformanceTest() {
  console.log('🚀 Ollama Model Performance Test (Docker Setup)\n');
  
  // Check if Docker services are running
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync('docker ps --filter "name=wyvern" --format "{{.Names}}"');
    if (!stdout.trim()) {
      console.log('❌ Docker services are not running. Please start them first:');
      console.log('   docker-compose up -d\n');
      return;
    }
    console.log('✅ Docker services are running\n');
  } catch (error) {
    console.log('❌ Error checking Docker services\n');
    return;
  }
  
  const models = [
    'phi3:mini',
    'phi3:3b', 
    'llama3.2:3b',
    'mistral:7b',
    'mistral:latest'
  ];
  
  const results = [];
  
  for (const model of models) {
    const result = await testModelPerformance(model);
    results.push(result);
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n📊 Performance Results:');
  console.log('========================');
  
  const successfulResults = results.filter(r => r.success).sort((a, b) => a.duration - b.duration);
  
  successfulResults.forEach((result, index) => {
    console.log(`${index + 1}. ${result.model}: ${result.duration.toFixed(2)}s`);
  });
  
  if (successfulResults.length === 0) {
    console.log('❌ No models completed successfully. Check if Ollama is running.');
  } else {
    console.log(`\n🏆 Fastest: ${successfulResults[0].model} (${successfulResults[0].duration.toFixed(2)}s)`);
  }
}

runPerformanceTest().catch(console.error); 