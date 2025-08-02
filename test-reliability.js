import fetch from 'node-fetch';

class ReliabilityTester {
  constructor() {
    this.baseURL = 'http://localhost:3000';
    this.results = {};
  }

  async testModelReliability(modelName, iterations = 5) {
    console.log(`\n🧪 Testing ${modelName} reliability (${iterations} iterations)...`);
    
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      try {
        console.log(`  Iteration ${i + 1}/${iterations}...`);
        
        const startTime = Date.now();
        const response = await fetch(`${this.baseURL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: 'test',
            messages: [{ role: 'user', content: 'Roll a d20 for me' }],
            providerType: 'ollama',
            modelName: modelName
          }),
          signal: AbortSignal.timeout(90000) // 90 second timeout
        });
        
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          const data = await response.json();
          const success = !data.error && data.text && data.text.length > 0;
          
          results.push({
            iteration: i + 1,
            success,
            responseTime,
            hasError: !!data.error,
            errorMessage: data.error?.message || null,
            responseLength: data.text?.length || 0
          });
          
          console.log(`    ✅ Iteration ${i + 1}: ${responseTime}ms${success ? ' - SUCCESS' : ' - FAILED'}`);
          if (data.error) {
            console.log(`      Error: ${data.error.message}`);
          }
        } else {
          results.push({
            iteration: i + 1,
            success: false,
            responseTime,
            hasError: true,
            errorMessage: `HTTP ${response.status}`,
            responseLength: 0
          });
          
          console.log(`    ❌ Iteration ${i + 1}: HTTP ${response.status}`);
        }
      } catch (error) {
        results.push({
          iteration: i + 1,
          success: false,
          responseTime: 0,
          hasError: true,
          errorMessage: error.message,
          responseLength: 0
        });
        
        console.log(`    ❌ Iteration ${i + 1}: ${error.message}`);
      }
      
      // Wait between iterations
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    return results;
  }

  async runReliabilityTest() {
    console.log('🔧 RELIABILITY TEST - ACTUAL APPLICATION CONTEXT');
    console.log('================================================\n');
    
    const models = ['llama3.2:3b', 'mistral:7b', 'qwen2.5:7b'];
    
    for (const model of models) {
      const results = await this.testModelReliability(model, 5);
      this.results[model] = results;
    }
    
    this.generateReport();
  }

  generateReport() {
    console.log('\n📊 RELIABILITY REPORT');
    console.log('=====================\n');
    
    Object.entries(this.results).forEach(([modelName, results]) => {
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;
      const successRate = (successCount / totalCount * 100).toFixed(1);
      
      const avgResponseTime = results
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.responseTime, 0) / Math.max(successCount, 1);
      
      const errorTypes = results
        .filter(r => r.hasError)
        .map(r => r.errorMessage)
        .filter((msg, index, arr) => arr.indexOf(msg) === index);
      
      console.log(`🔍 ${modelName}:`);
      console.log(`  ✅ Success Rate: ${successCount}/${totalCount} (${successRate}%)`);
      console.log(`  ⏱️  Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
      
      if (errorTypes.length > 0) {
        console.log(`  ❌ Error Types: ${errorTypes.join(', ')}`);
      }
      
      console.log('');
    });
    
    // Generate recommendations
    console.log('💡 RECOMMENDATIONS');
    console.log('==================');
    
    const modelRankings = Object.entries(this.results)
      .map(([model, results]) => {
        const successRate = results.filter(r => r.success).length / results.length;
        const avgTime = results
          .filter(r => r.success)
          .reduce((sum, r) => sum + r.responseTime, 0) / Math.max(results.filter(r => r.success).length, 1);
        
        return { model, successRate, avgTime };
      })
      .sort((a, b) => {
        // Sort by success rate first, then by speed
        if (Math.abs(a.successRate - b.successRate) > 0.1) {
          return b.successRate - a.successRate;
        }
        return a.avgTime - b.avgTime;
      });
    
    modelRankings.forEach((ranking, index) => {
      const status = index === 0 ? '🏆' : index === 1 ? '🥈' : '🥉';
      console.log(`${status} ${ranking.model}: ${(ranking.successRate * 100).toFixed(1)}% success, ${ranking.avgTime.toFixed(0)}ms avg`);
    });
    
    const bestModel = modelRankings[0];
    console.log(`\n🎯 RECOMMENDED: ${bestModel.model} (${(bestModel.successRate * 100).toFixed(1)}% reliable)`);
  }
}

// Run reliability test
const tester = new ReliabilityTester();
tester.runReliabilityTest().catch(console.error); 