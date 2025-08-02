import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function installFastModels() {
  console.log('🚀 Installing fast Ollama models for Docker setup...\n');

  const fastModels = [
    'phi3:mini',    // Fastest - 3.8B parameters
    'phi3:3b',      // Fast - 3B parameters
    'llama3.2:3b',  // Fast - 3B parameters
    'mistral:7b'    // Good balance - 7B parameters
  ];

  // Check if Docker is running
  try {
    await execAsync('docker ps');
    console.log('✅ Docker is running\n');
  } catch (error) {
    console.log('❌ Docker is not running. Please start Docker first.\n');
    return;
  }

  // Check if Ollama container is running
  try {
    const { stdout } = await execAsync('docker ps --filter "name=wyvern-ollama" --format "{{.Names}}"');
    if (!stdout.trim()) {
      console.log('❌ Ollama container is not running. Please start the Docker services first:');
      console.log('   docker-compose up -d\n');
      return;
    }
    console.log('✅ Ollama container is running\n');
  } catch (error) {
    console.log('❌ Error checking Ollama container status\n');
    return;
  }

  for (const model of fastModels) {
    try {
      console.log(`📥 Installing ${model} in Ollama container...`);
      await execAsync(`docker exec wyvern-ollama-1 ollama pull ${model}`);
      console.log(`✅ ${model} installed successfully!\n`);
    } catch (error) {
      console.log(`❌ Failed to install ${model}: ${error.message}\n`);
    }
  }

  console.log('🎉 Fast model installation complete!');
  console.log('\n💡 Usage tips:');
  console.log('- Use phi3:mini for fastest responses');
  console.log('- Use phi3:3b for good speed/quality balance');
  console.log('- Use llama3.2:3b for better reasoning');
  console.log('- Use mistral:7b for current best balance');
  console.log('\n🔄 Restart the app container to pick up new models:');
  console.log('   docker-compose restart app');
}

installFastModels().catch(console.error); 