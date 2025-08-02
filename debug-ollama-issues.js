import fetch from 'node-fetch';

class OllamaDebugger {
  constructor() {
    this.baseURL = 'http://localhost:11434';
    this.results = [];
  }

  async checkOllamaStatus() {
    console.log('🔍 Checking Ollama service status...');
    try {
      const response = await fetch(`${this.baseURL}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Ollama is running');
        console.log(`📋 Found ${data.models.length} models:`);
        data.models.forEach(model => {
          console.log(`  - ${model.name} (${(model.size / 1024 / 1024 / 1024).toFixed(2)} GB)`);
        });
        return data.models;
      } else {
        console.log('❌ Ollama is not responding properly');
        return [];
      }
    } catch (error) {
      console.log('❌ Cannot connect to Ollama:', error.message);
      return [];
    }
  }

  async testModelHealth(modelName) {
    console.log(`\n🏥 Testing health for ${modelName}...`);
    
    const tests = [
      {
        name: 'Basic Response',
        payload: {
          model: modelName,
          messages: [{ role: 'user', content: 'Say "Hello"' }],
          stream: false,
          options: { num_predict: 50 }
        }
      },
      {
        name: 'Function Calling',
        payload: {
          model: modelName,
          messages: [
            { role: 'system', content: 'You are a D&D DM. Use tools when needed.' },
            { role: 'user', content: 'Roll a d20' }
          ],
          tools: [{
            type: 'function',
            function: {
              name: 'rollDie',
              description: 'Roll a die',
              parameters: {
                type: 'object',
                properties: {
                  sides: { type: 'number', description: 'Number of sides' }
                },
                required: ['sides']
              }
            }
          }],
          stream: false,
          options: { num_predict: 100 }
        }
      },
      {
        name: 'Long Context',
        payload: {
          model: modelName,
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'This is a test message. ' + 'A'.repeat(1000) }
          ],
          stream: false,
          options: { num_predict: 50, num_ctx: 2048 }
        }
      }
    ];

    const results = [];
    
    for (const test of tests) {
      try {
        console.log(`  Testing: ${test.name}...`);
        
        const startTime = Date.now();
        const response = await fetch(`${this.baseURL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(test.payload),
          signal: AbortSignal.timeout(45000) // 45 second timeout
        });
        
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          const data = await response.json();
          const hasToolCalls = data.tool_calls && data.tool_calls.length > 0;
          const responseText = data.message?.content || '';
          
          results.push({
            test: test.name,
            success: true,
            responseTime,
            hasToolCalls,
            responseLength: responseText.length,
            error: null
          });
          
          console.log(`    ✅ ${test.name}: ${responseTime}ms, ${responseText.substring(0, 50)}...`);
        } else {
          const errorText = await response.text();
          results.push({
            test: test.name,
            success: false,
            responseTime,
            hasToolCalls: false,
            responseLength: 0,
            error: `HTTP ${response.status}: ${errorText}`
          });
          
          console.log(`    ❌ ${test.name}: HTTP ${response.status} - ${errorText}`);
        }
      } catch (error) {
        const responseTime = Date.now() - startTime;
        results.push({
          test: test.name,
          success: false,
          responseTime,
          hasToolCalls: false,
          responseLength: 0,
          error: error.message
        });
        
        console.log(`    ❌ ${test.name}: ${error.message}`);
      }
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return results;
  }

  async testModelConsistency(modelName, iterations = 5) {
    console.log(`\n🔄 Testing consistency for ${modelName} (${iterations} iterations)...`);
    
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      try {
        console.log(`  Iteration ${i + 1}/${iterations}...`);
        
        const startTime = Date.now();
        const response = await fetch(`${this.baseURL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: 'system', content: 'You are a D&D DM. Roll a d20.' },
              { role: 'user', content: 'Roll a d20 for me.' }
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'rollDie',
                description: 'Roll a die',
                parameters: {
                  type: 'object',
                  properties: {
                    sides: { type: 'number', description: 'Number of sides' }
                  },
                  required: ['sides']
                }
              }
            }],
            stream: false,
            options: { num_predict: 100, temperature: 0.3 }
          }),
          signal: AbortSignal.timeout(30000)
        });
        
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          const data = await response.json();
          const hasToolCalls = data.tool_calls && data.tool_calls.length > 0;
          const responseText = data.message?.content || '';
          
          results.push({
            iteration: i + 1,
            success: true,
            responseTime,
            hasToolCalls,
            responseLength: responseText.length,
            error: null
          });
          
          console.log(`    ✅ Iteration ${i + 1}: ${responseTime}ms, tool calls: ${hasToolCalls}`);
        } else {
          const errorText = await response.text();
          results.push({
            iteration: i + 1,
            success: false,
            responseTime,
            hasToolCalls: false,
            responseLength: 0,
            error: `HTTP ${response.status}: ${errorText}`
          });
          
          console.log(`    ❌ Iteration ${i + 1}: HTTP ${response.status}`);
        }
      } catch (error) {
        results.push({
          iteration: i + 1,
          success: false,
          responseTime: 0,
          hasToolCalls: false,
          responseLength: 0,
          error: error.message
        });
        
        console.log(`    ❌ Iteration ${i + 1}: ${error.message}`);
      }
      
      // Wait between iterations
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    return results;
  }

  async checkSystemResources() {
    console.log('\n💻 Checking system resources...');
    
    try {
      // Check if we can get system info from Ollama
      const response = await fetch(`${this.baseURL}/api/ps`);
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Ollama process info:', data);
      }
    } catch (error) {
      console.log('⚠️  Could not get system info from Ollama');
    }
  }

  generateReport() {
    console.log('\n📊 DIAGNOSTIC REPORT');
    console.log('=====================');
    
    this.results.forEach((modelResult, index) => {
      console.log(`\n🔍 Model: ${modelResult.modelName}`);
      console.log('Health Tests:');
      
      const healthTests = modelResult.healthTests;
      const successCount = healthTests.filter(t => t.success).length;
      const totalTests = healthTests.length;
      
      console.log(`  ✅ Success Rate: ${successCount}/${totalTests} (${(successCount/totalTests*100).toFixed(1)}%)`);
      
      healthTests.forEach(test => {
        const status = test.success ? '✅' : '❌';
        console.log(`    ${status} ${test.test}: ${test.responseTime}ms${test.error ? ` - ${test.error}` : ''}`);
      });
      
      if (modelResult.consistencyTests) {
        console.log('\n  Consistency Tests:');
        const consistencyTests = modelResult.consistencyTests;
        const successCount = consistencyTests.filter(t => t.success).length;
        const totalTests = consistencyTests.length;
        
        console.log(`    ✅ Success Rate: ${successCount}/${totalTests} (${(successCount/totalTests*100).toFixed(1)}%)`);
        
        const avgResponseTime = consistencyTests
          .filter(t => t.success)
          .reduce((sum, t) => sum + t.responseTime, 0) / Math.max(successCount, 1);
        
        console.log(`    ⏱️  Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
        
        const toolCallSuccess = consistencyTests.filter(t => t.success && t.hasToolCalls).length;
        console.log(`    🔧 Function Calling Success: ${toolCallSuccess}/${successCount}`);
      }
    });
    
    // Generate recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log('==================');
    
    this.results.forEach(modelResult => {
      const healthSuccess = modelResult.healthTests.filter(t => t.success).length;
      const totalHealth = modelResult.healthTests.length;
      
      if (healthSuccess < totalHealth) {
        console.log(`\n⚠️  ${modelResult.modelName} has issues:`);
        
        modelResult.healthTests.forEach(test => {
          if (!test.success) {
            if (test.error?.includes('timeout')) {
              console.log(`  - Increase timeout for ${test.test}`);
            } else if (test.error?.includes('memory')) {
              console.log(`  - Model may need more memory`);
            } else if (test.test === 'Function Calling' && !test.success) {
              console.log(`  - Model may not support function calling properly`);
            } else {
              console.log(`  - ${test.test}: ${test.error}`);
            }
          }
        });
      }
      
      if (modelResult.consistencyTests) {
        const consistencySuccess = modelResult.consistencyTests.filter(t => t.success).length;
        const totalConsistency = modelResult.consistencyTests.length;
        
        if (consistencySuccess < totalConsistency * 0.8) {
          console.log(`\n⚠️  ${modelResult.modelName} is inconsistent:`);
          console.log(`  - Success rate: ${(consistencySuccess/totalConsistency*100).toFixed(1)}%`);
          console.log(`  - Consider using a more stable model`);
        }
      }
    });
  }

  async runDiagnostics() {
    console.log('🔧 OLLAMA DIAGNOSTIC TOOL');
    console.log('==========================\n');
    
    // Check Ollama status
    const models = await this.checkOllamaStatus();
    if (models.length === 0) {
      console.log('\n❌ No models found. Please ensure:');
      console.log('1. Docker is running');
      console.log('2. Ollama container is started');
      console.log('3. Models are installed');
      return;
    }
    
    // Check system resources
    await this.checkSystemResources();
    
    // Test each model
    for (const model of models) {
      console.log(`\n🧪 Testing model: ${model.name}`);
      
      const healthTests = await this.testModelHealth(model.name);
      const consistencyTests = await this.testModelConsistency(model.name, 3);
      
      this.results.push({
        modelName: model.name,
        healthTests,
        consistencyTests
      });
    }
    
    // Generate report
    this.generateReport();
  }
}

// Run diagnostics
const debuggerInstance = new OllamaDebugger();
debuggerInstance.runDiagnostics().catch(console.error); 