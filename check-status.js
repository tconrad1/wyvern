import fetch from 'node-fetch';

async function checkStatus() {
  console.log('🔍 Checking Wyvern System Status\n');
  
  // Check 1: Docker services
  console.log('1. Checking Docker services...');
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync('docker ps --format "table {{.Names}}\t{{.Status}}"');
    console.log('✅ Docker is running');
    console.log('📋 Running containers:');
    console.log(stdout);
  } catch (error) {
    console.log('❌ Docker is not running or not accessible');
    console.log('💡 Please start Docker Desktop');
    return;
  }
  
  // Check 2: Ollama API
  console.log('\n2. Checking Ollama API...');
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Ollama API is responding');
      console.log(`📋 Available models: ${data.models.length}`);
      data.models.forEach(model => {
        console.log(`  - ${model.name}`);
      });
    } else {
      console.log('❌ Ollama API is not responding');
    }
  } catch (error) {
    console.log('❌ Cannot connect to Ollama API:', error.message);
  }
  
  // Check 3: App server
  console.log('\n3. Checking app server...');
  try {
    const response = await fetch('http://localhost:3000');
    if (response.ok) {
      console.log('✅ App server is running');
    } else {
      console.log('❌ App server is not responding');
    }
  } catch (error) {
    console.log('❌ Cannot connect to app server:', error.message);
  }
  
  console.log('\n📋 Next Steps:');
  console.log('1. If Docker is not running: Start Docker Desktop');
  console.log('2. If Ollama is not responding: Run "docker-compose up -d"');
  console.log('3. If app server is not running: Run "npm run dev"');
  console.log('4. If no models are installed: Run "node install-function-calling-models.js"');
}

checkStatus().catch(console.error); 