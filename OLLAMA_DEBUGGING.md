# Ollama Debugging Guide

This guide helps you diagnose and resolve issues with local Ollama models that are returning "I'm having trouble..." messages inconsistently.

## Quick Diagnosis

### 1. Run the Diagnostic Tool
```bash
node debug-ollama-issues.js
```

This will:
- Check if Ollama is running
- Test all installed models
- Run health checks (basic response, function calling, long context)
- Test consistency with multiple iterations
- Generate a detailed report with recommendations

### 2. Run Performance Monitoring
```bash
# Quick test
node monitor-ollama-performance.js

# Continuous monitoring (every 5 minutes)
node monitor-ollama-performance.js continuous 5
```

This will:
- Test models repeatedly
- Track success/failure rates
- Monitor response times
- Log all results to `ollama-performance.log`

## Common Issues and Solutions

### Issue 1: Timeout Errors
**Symptoms**: Models work sometimes but fail with timeout errors
**Causes**: 
- Model is too large for your hardware
- System is under heavy load
- Insufficient memory

**Solutions**:
1. Use `llama3.2:3b` (recommended) or other smaller models
2. Increase timeout in `modelProviders.ts` (currently 60s)
3. Close other applications to free memory
4. Restart the Ollama container

### Issue 2: Model Not Installed
**Symptoms**: "Model not installed" errors
**Solution**:
```bash
# Install the model
ollama pull llama3.2:3b

# Or install a smaller alternative
ollama pull phi3:mini
```

### Issue 3: Function Calling Not Supported
**Symptoms**: Models respond but don't use tools/functions
**Solution**: Use models that support function calling:
- `llama3.2:3b` (recommended)
- `mistral:7b`
- `qwen2.5:7b`

### Issue 4: Memory Issues
**Symptoms**: Models work initially but fail after several requests
**Solutions**:
1. Restart Ollama container
2. Use smaller models
3. Increase Docker memory limits
4. Add swap space

### Issue 5: Network/Connection Issues
**Symptoms**: "Cannot connect to Ollama" errors
**Solutions**:
1. Check if Docker is running
2. Restart Ollama container: `docker-compose restart ollama`
3. Check container logs: `docker-compose logs ollama`

## Enhanced Debugging

### 1. Check Container Status
```bash
# Check if containers are running
docker-compose ps

# Check Ollama logs
docker-compose logs ollama

# Restart Ollama if needed
docker-compose restart ollama
```

### 2. Monitor System Resources
```bash
# Check memory usage
docker stats

# Check disk space
df -h

# Check CPU usage
top
```

### 3. Test Individual Models
```bash
# Test specific model
node test-models-working.js

# Test function calling
node test-function-calling.js
```

## Configuration Recommendations

### For Better Stability:

1. **Use Recommended Models**:
   - `llama3.2:3b` (3B parameters) - Best performance (RECOMMENDED)
   - `mistral:7b` (7B parameters) - Good balance
   - `qwen2.5:7b` (7B parameters) - Good alternative

2. **Adjust Timeouts**:
   - Increase timeout in `modelProviders.ts` for larger models
   - Use different timeouts for different model sizes

3. **Optimize Settings**:
   - Reduce `num_predict` for faster responses
   - Lower `num_ctx` for memory efficiency
   - Use `mirostat` for better quality/speed balance

### Docker Configuration:
```yaml
# In docker-compose.yml
services:
  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        limits:
          memory: 8G  # Adjust based on your system
        reservations:
          memory: 4G
```

## Troubleshooting Steps

### Step 1: Basic Checks
1. Is Docker running?
2. Is Ollama container started?
3. Are models installed?

### Step 2: Run Diagnostics
```bash
node debug-ollama-issues.js
```

### Step 3: Check Logs
- Application logs: Check browser console and server logs
- Ollama logs: `docker-compose logs ollama`
- Performance logs: `ollama-performance.log`

### Step 4: Test Models
```bash
node test-models-working.js
```

### Step 5: Monitor Performance
```bash
node monitor-ollama-performance.js continuous 10
```

## Expected Behavior

### Good Performance:
- Response times: < 30 seconds
- Success rate: > 90%
- Function calling: Working consistently

### Warning Signs:
- Response times: > 45 seconds
- Success rate: < 80%
- Frequent timeouts
- Memory errors

## Getting Help

If issues persist:

1. **Collect Information**:
   - Run `debug-ollama-issues.js` and save output
   - Check `ollama-performance.log`
   - Note your system specs (RAM, CPU, GPU)

2. **Try Alternatives**:
   - Switch to OpenRouter (cloud models)
   - Use smaller local models
   - Increase system resources

3. **Common Solutions**:
   - Restart Ollama container
   - Use `phi3:mini` for testing
   - Increase Docker memory limits
   - Close other applications

## Model Recommendations

### For Testing:
- `llama3.2:3b` - Best performance, recommended for all use cases

### For Production:
- `llama3.2:3b` - Best balance of speed and quality (RECOMMENDED)
- `mistral:7b` - Good quality, slightly slower
- `qwen2.5:7b` - Good alternative

### Avoid:
- Models > 7B parameters unless you have 16GB+ RAM
- Models without function calling support
- Very old model versions

## Performance Tuning

### For Faster Responses:
```javascript
options: {
  num_predict: 256,    // Shorter responses
  temperature: 0.3,    // More focused
  num_ctx: 1024,       // Smaller context
}
```

### For Better Quality:
```javascript
options: {
  num_predict: 512,    // Longer responses
  temperature: 0.7,    // More creative
  num_ctx: 4096,       // Larger context
}
```

### For Stability:
```javascript
options: {
  mirostat: 2,         // Better quality control
  mirostat_tau: 5.0,
  mirostat_eta: 0.1,
  repeat_penalty: 1.1, // Reduce repetition
}
``` 