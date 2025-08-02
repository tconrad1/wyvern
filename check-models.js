import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkModels() {
  console.log('🔍 Checking available models in Ollama container...\n');

  try {
    // Check if Docker is running
    await execAsync('docker ps');
    console.log('✅ Docker is running\n');
  } catch (error) {
    console.log('❌ Docker is not running. Please start Docker first.\n');
    return;
  }

  try {
    // Check if Ollama container is running
    const { stdout: containerCheck } = await execAsync('docker ps --filter "name=wyvern-ollama" --format "{{.Names}}"');
    if (!containerCheck.trim()) {
      console.log('❌ Ollama container is not running. Please start the Docker services first:');
      console.log('   docker-compose up -d\n');
      return;
    }
    console.log('✅ Ollama container is running\n');
  } catch (error) {
    console.log('❌ Error checking Ollama container status\n');
    return;
  }

  try {
    // List available models
    console.log('📋 Available models in Ollama container:');
    console.log('=====================================');
    
    const { stdout } = await execAsync('docker exec wyvern-ollama-1 ollama list');
    console.log(stdout);
    
    console.log('\n💡 Performance recommendations:');
    console.log('- ⚡ phi3:mini - Fastest responses');
    console.log('- 🚀 phi3:3b - Good speed/quality balance');
    console.log('- ⚖️ mistral:7b - Balanced performance');
    console.log('- 🎯 mistral:latest - Current default');
    
  } catch (error) {
    console.log(`❌ Error listing models: ${error.message}\n`);
  }
}

checkModels().catch(console.error); 