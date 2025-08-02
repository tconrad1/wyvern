import fetch from 'node-fetch';

class ToolFunctionalityTester {
  constructor() {
    this.baseURL = 'http://localhost:3000';
    this.results = {};
  }

  async testToolFunctionality(modelName, testCases) {
    console.log(`\n🧪 Testing ${modelName} tool functionality...`);
    
    const results = [];
    
    for (const testCase of testCases) {
      try {
        console.log(`  Testing: "${testCase.prompt}"`);
        
        const startTime = Date.now();
        const response = await fetch(`${this.baseURL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: 'test',
            messages: [{ role: 'user', content: testCase.prompt }],
            providerType: 'ollama',
            modelName: modelName
          }),
          signal: AbortSignal.timeout(60000)
        });
        
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          const data = await response.json();
          
          // Check if the response contains function calls
          const hasFunctionCalls = data.functionCalls && data.functionCalls.length > 0;
          const functionCallNames = hasFunctionCalls ? data.functionCalls.map(fc => fc.name) : [];
          
          // Check if the expected tool was called
          const expectedToolCalled = testCase.expectedTool ? 
            functionCallNames.includes(testCase.expectedTool) : false;
          
          const success = hasFunctionCalls && expectedToolCalled;
          
          results.push({
            testCase: testCase.prompt,
            success,
            responseTime,
            hasFunctionCalls,
            functionCallNames,
            expectedTool: testCase.expectedTool,
            expectedToolCalled,
            responseText: data.text || '',
            error: data.error
          });
          
          console.log(`    ${success ? '✅' : '❌'} ${responseTime}ms - Function calls: [${functionCallNames.join(', ')}]`);
          if (!success) {
            console.log(`      Expected: ${testCase.expectedTool}, Got: [${functionCallNames.join(', ')}]`);
          }
        } else {
          results.push({
            testCase: testCase.prompt,
            success: false,
            responseTime,
            hasFunctionCalls: false,
            functionCallNames: [],
            expectedTool: testCase.expectedTool,
            expectedToolCalled: false,
            responseText: '',
            error: `HTTP ${response.status}`
          });
          
          console.log(`    ❌ HTTP ${response.status}`);
        }
      } catch (error) {
        results.push({
          testCase: testCase.prompt,
          success: false,
          responseTime: 0,
          hasFunctionCalls: false,
          functionCallNames: [],
          expectedTool: testCase.expectedTool,
          expectedToolCalled: false,
          responseText: '',
          error: error.message
        });
        
        console.log(`    ❌ ${error.message}`);
      }
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return results;
  }

  async runToolTests() {
    console.log('🔧 TOOL FUNCTIONALITY TEST');
    console.log('============================\n');
    
    const testCases = [
      {
        prompt: "Roll a d20 for me",
        expectedTool: "rollDie"
      },
      {
        prompt: "Roll 2d6 with advantage",
        expectedTool: "rollDie"
      },
      {
        prompt: "Update my character's HP to 15",
        expectedTool: "updatePlayer"
      },
      {
        prompt: "Log this campaign event: We defeated the goblin",
        expectedTool: "logCampaign"
      },
      {
        prompt: "Create a monster with 20 HP and 15 AC",
        expectedTool: "updateMonster"
      },
      {
        prompt: "What's the weather like?",
        expectedTool: null // Should not call any tools
      }
    ];
    
    const models = ['llama3.2:3b', 'qwen2.5:7b', 'mistral:7b'];
    
    for (const model of models) {
      const results = await this.testToolFunctionality(model, testCases);
      this.results[model] = results;
    }
    
    this.generateReport();
  }

  generateReport() {
    console.log('\n📊 TOOL FUNCTIONALITY REPORT');
    console.log('=============================\n');
    
    Object.entries(this.results).forEach(([modelName, results]) => {
      const totalTests = results.length;
      const successfulTests = results.filter(r => r.success).length;
      const toolTests = results.filter(r => r.expectedTool !== null).length;
      const successfulToolTests = results.filter(r => r.expectedTool !== null && r.success).length;
      
      const overallSuccessRate = (successfulTests / totalTests * 100).toFixed(1);
      const toolSuccessRate = toolTests > 0 ? (successfulToolTests / toolTests * 100).toFixed(1) : '0.0';
      
      const avgResponseTime = results
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.responseTime, 0) / Math.max(successfulTests, 1);
      
      console.log(`🔍 ${modelName}:`);
      console.log(`  ✅ Overall Success: ${successfulTests}/${totalTests} (${overallSuccessRate}%)`);
      console.log(`  🔧 Tool Success: ${successfulToolTests}/${toolTests} (${toolSuccessRate}%)`);
      console.log(`  ⏱️  Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
      
      // Show detailed results
      console.log(`  📋 Test Results:`);
      results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        const toolInfo = result.expectedTool ? 
          `Expected: ${result.expectedTool}, Got: [${result.functionCallNames.join(', ')}]` :
          `No tool expected, Got: [${result.functionCallNames.join(', ')}]`;
        
        console.log(`    ${status} Test ${index + 1}: ${toolInfo}`);
      });
      
      console.log('');
    });
    
    // Generate recommendations
    console.log('💡 TOOL FUNCTIONALITY RECOMMENDATIONS');
    console.log('=====================================');
    
    const modelRankings = Object.entries(this.results)
      .map(([model, results]) => {
        const toolTests = results.filter(r => r.expectedTool !== null).length;
        const successfulToolTests = results.filter(r => r.expectedTool !== null && r.success).length;
        const toolSuccessRate = toolTests > 0 ? successfulToolTests / toolTests : 0;
        
        const avgTime = results
          .filter(r => r.success)
          .reduce((sum, r) => sum + r.responseTime, 0) / Math.max(results.filter(r => r.success).length, 1);
        
        return { model, toolSuccessRate, avgTime };
      })
      .sort((a, b) => {
        // Sort by tool success rate first, then by speed
        if (Math.abs(a.toolSuccessRate - b.toolSuccessRate) > 0.1) {
          return b.toolSuccessRate - a.toolSuccessRate;
        }
        return a.avgTime - b.avgTime;
      });
    
    modelRankings.forEach((ranking, index) => {
      const status = index === 0 ? '🏆' : index === 1 ? '🥈' : '🥉';
      console.log(`${status} ${ranking.model}: ${(ranking.toolSuccessRate * 100).toFixed(1)}% tool success, ${ranking.avgTime.toFixed(0)}ms avg`);
    });
    
    const bestModel = modelRankings[0];
    console.log(`\n🎯 BEST FOR TOOLS: ${bestModel.model} (${(bestModel.toolSuccessRate * 100).toFixed(1)}% tool success)`);
  }
}

// Run tool functionality test
const tester = new ToolFunctionalityTester();
tester.runToolTests().catch(console.error); 