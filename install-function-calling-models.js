import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function installFunctionCallingModels() {
  console.log('🔧 Installing Ollama models with function calling support...\n');

  // Models known to support function calling
  const functionCallingModels = [
    'llama3.2:8b',      // Good function calling support
    'llama3.2:70b',     // Excellent function calling support
    'codellama:7b',     // Good function calling support
    'codellama:13b',    // Better function calling support
    'neural-chat:7b',   // Good function calling support
    'qwen2.5:7b',       // Good function calling support
    'qwen2.5:14b'       // Better function calling support
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

  for (const model of functionCallingModels) {
    try {
      console.log(`📥 Installing ${model} (function calling support)...`);
      await execAsync(`docker exec wyvern-ollama-1 ollama pull ${model}`);
      console.log(`✅ ${model} installed successfully!\n`);
    } catch (error) {
      console.log(`❌ Failed to install ${model}: ${error.message}\n`);
    }
  }

  console.log('🎉 Function calling models installation complete!');
  console.log('\n💡 Function calling is essential for:');
  console.log('- Rolling dice');
  console.log('- Updating player/monster stats');
  console.log('- Logging campaign events');
  console.log('- Managing game state');
  console.log('\n🔄 Restart the app container to pick up new models:');
  console.log('   docker-compose restart app');
}

installFunctionCallingModels().catch(console.error); 