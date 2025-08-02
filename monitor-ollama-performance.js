import fetch from 'node-fetch';
import fs from 'fs';

class OllamaMonitor {
  constructor() {
    this.baseURL = 'http://localhost:11434';
    this.logFile = 'ollama-performance.log';
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      errors: {},
      models: {}
    };
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    console.log(logEntry.trim());
    
    // Append to log file
    fs.appendFileSync(this.logFile, logEntry);
  }

  async testModel(modelName) {
    const startTime = Date.now();
    
    try {
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
        signal: AbortSignal.timeout(60000)
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        const hasToolCalls = data.tool_calls && data.tool_calls.length > 0;
        const responseText = data.message?.content || '';
        
        this.stats.successfulRequests++;
        this.stats.totalRequests++;
        
        // Update model stats
        if (!this.stats.models[modelName]) {
          this.stats.models[modelName] = {
            requests: 0,
            successes: 0,
            failures: 0,
            totalResponseTime: 0,
            averageResponseTime: 0
          };
        }
        
        this.stats.models[modelName].requests++;
        this.stats.models[modelName].successes++;
        this.stats.models[modelName].totalResponseTime += responseTime;
        this.stats.models[modelName].averageResponseTime = 
          this.stats.models[modelName].totalResponseTime / this.stats.models[modelName].successes;
        
        this.log(`✅ ${modelName}: SUCCESS (${responseTime}ms) - Tool calls: ${hasToolCalls}, Response length: ${responseText.length}`);
        
        return { success: true, responseTime, hasToolCalls, responseLength: responseText.length };
      } else {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.stats.failedRequests++;
      this.stats.totalRequests++;
      
      // Track error types
      const errorType = error.name || 'Unknown';
      this.stats.errors[errorType] = (this.stats.errors[errorType] || 0) + 1;
      
      // Update model stats
      if (!this.stats.models[modelName]) {
        this.stats.models[modelName] = {
          requests: 0,
          successes: 0,
          failures: 0,
          totalResponseTime: 0,
          averageResponseTime: 0
        };
      }
      
      this.stats.models[modelName].requests++;
      this.stats.models[modelName].failures++;
      
      this.log(`❌ ${modelName}: FAILED (${responseTime}ms) - ${error.message}`);
      
      return { success: false, responseTime, error: error.message };
    }
  }

  async runContinuousMonitoring(intervalMinutes = 5) {
    this.log('🔍 Starting Ollama Performance Monitor');
    this.log(`📊 Monitoring interval: ${intervalMinutes} minutes`);
    
    // Get available models
    try {
      const response = await fetch(`${this.baseURL}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        this.log(`📋 Found ${data.models.length} models: ${data.models.map(m => m.name).join(', ')}`);
      }
    } catch (error) {
      this.log(`❌ Cannot connect to Ollama: ${error.message}`);
      return;
    }
    
    const models = ['llama3.2:3b', 'mistral:7b', 'qwen2.5:7b']; // Test recommended models
    
    while (true) {
      this.log(`\n🔄 Starting monitoring cycle at ${new Date().toISOString()}`);
      
      for (const model of models) {
        await this.testModel(model);
        
        // Wait between model tests
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Print current stats
      this.printStats();
      
      // Wait for next cycle
      this.log(`⏰ Waiting ${intervalMinutes} minutes until next cycle...`);
      await new Promise(resolve => setTimeout(resolve, intervalMinutes * 60 * 1000));
    }
  }

  printStats() {
    const successRate = this.stats.totalRequests > 0 
      ? (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(1)
      : 0;
    
    this.log('\n📊 CURRENT STATISTICS');
    this.log('=====================');
    this.log(`Total Requests: ${this.stats.totalRequests}`);
    this.log(`Successful: ${this.stats.successfulRequests}`);
    this.log(`Failed: ${this.stats.failedRequests}`);
    this.log(`Success Rate: ${successRate}%`);
    
    if (Object.keys(this.stats.errors).length > 0) {
      this.log('\nError Types:');
      Object.entries(this.stats.errors).forEach(([errorType, count]) => {
        this.log(`  ${errorType}: ${count}`);
      });
    }
    
    this.log('\nModel Performance:');
    Object.entries(this.stats.models).forEach(([modelName, stats]) => {
      const modelSuccessRate = stats.requests > 0 
        ? (stats.successes / stats.requests * 100).toFixed(1)
        : 0;
      this.log(`  ${modelName}: ${stats.successes}/${stats.requests} (${modelSuccessRate}%) - Avg: ${stats.averageResponseTime.toFixed(0)}ms`);
    });
  }

  async runQuickTest() {
    this.log('🧪 Running quick test...');
    
    const models = ['llama3.2:3b', 'mistral:7b', 'qwen2.5:7b'];
    const results = [];
    
    for (const model of models) {
      const result = await this.testModel(model);
      results.push({ model, ...result });
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    this.printStats();
    
    // Generate recommendations
    this.log('\n💡 RECOMMENDATIONS');
    this.log('==================');
    
    const failedModels = results.filter(r => !r.success);
    const slowModels = results.filter(r => r.success && r.responseTime > 30000);
    
    if (failedModels.length > 0) {
      this.log('❌ Models with issues:');
      failedModels.forEach(({ model, error }) => {
        this.log(`  - ${model}: ${error}`);
      });
    }
    
    if (slowModels.length > 0) {
      this.log('🐌 Slow models:');
      slowModels.forEach(({ model, responseTime }) => {
        this.log(`  - ${model}: ${responseTime}ms (consider using a smaller model)`);
      });
    }
    
    const workingModels = results.filter(r => r.success && r.responseTime <= 30000);
    if (workingModels.length > 0) {
      this.log('✅ Recommended models:');
      workingModels.forEach(({ model, responseTime, hasToolCalls }) => {
        this.log(`  - ${model}: ${responseTime}ms${hasToolCalls ? ' (function calling supported)' : ''}`);
      });
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'quick';

const monitor = new OllamaMonitor();

if (command === 'continuous') {
  const interval = parseInt(args[1]) || 5;
  monitor.runContinuousMonitoring(interval).catch(console.error);
} else {
  monitor.runQuickTest().catch(console.error);
} 