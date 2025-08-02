import OpenAI from 'openai';

// Define the interface for model providers
export interface ModelProvider {
  name: string;
  generateResponse(
    messages: any[],
    tools?: any[],
    model?: string
  ): Promise<{
    text: string;
    functionCalls?: any[];
  }>;
}

// OpenRouter Provider (supports multiple models)
export class OpenRouterProvider implements ModelProvider {
  name = 'openrouter';
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseURL = 'https://openrouter.ai/api/v1';
  }

  async generateResponse(
    messages: any[],
    tools?: any[],
    model: string = 'mistralai/mistral-7b-instruct:free'
  ) {
    
    console.log("Model:", model);
    console.log("Message count:", messages.length);
    console.log("Tools count:", tools?.length || 0);
    console.log("API key length:", this.apiKey?.length || 0);
    console.log("Base URL:", this.baseURL);
    
    const openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Wyvern-AI-DM',
      },
    });
    
    console.log("OpenAI client created successfully");

    // Convert tools to the appropriate format for OpenRouter
    const openRouterTools = tools ? tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    })) : undefined;

    console.log("OpenRouter tools prepared:", openRouterTools?.length || 0);
    console.log("Making API call to OpenRouter...");
    
    let response;
    try {
      response = await openai.chat.completions.create({
        model,
        messages,
        tools: openRouterTools,
        tool_choice: tools ? 'auto' : undefined,
      });
      
      console.log("OpenRouter API call successful");
      console.log("Response choices:", response.choices?.length || 0);
    } catch (error) {
      console.error("OpenRouter API call failed:", error);
      console.error("Error details:", {
        message: error.message,
        status: error.status,
        code: error.code,
        type: error.type
      });
      throw error;
    }

    const choice = response.choices[0];
    const message = choice.message;
    const functionCalls = message.tool_calls?.map(call => ({
      name: call.function.name,
      args: JSON.parse(call.function.arguments)
    }));

    return {
      text: message.content || '',
      functionCalls
    };
  }
}

// Ollama Provider (local models)
export class OllamaProvider implements ModelProvider {
  name = 'ollama';
  private baseURL: string;

  constructor(baseURL: string = 'http://ollama:11434') {
    this.baseURL = baseURL;
    console.log("OllamaProvider initialized with baseURL:", this.baseURL);
  }

  async generateResponse(
    messages: any[],
    tools?: any[],
    model: string = 'llama3.2:3b'
  ) {
    
    console.log("=== OLLAMA PROVIDER DEBUG ===");
    console.log("Model:", model);
    console.log("Message count:", messages.length);
    console.log("Tools count:", tools?.length || 0);
    console.log("Base URL:", this.baseURL);
    console.log("Request timestamp:", new Date().toISOString());
    
    // Convert messages to Ollama format and limit context length
    const ollamaMessages = messages.slice(-6).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    console.log("Processed messages:", ollamaMessages.length);

    // Prepare the request body with optimized settings
    const requestBody: any = {
      model,
      messages: ollamaMessages,
      stream: false,
      options: {
        temperature: 0.3, // Lower temperature for more focused responses
        top_p: 0.8,      // Slightly lower for more deterministic output
        num_predict: 512, // Much shorter responses for faster generation
        num_ctx: 2048,    // Limit context window
        repeat_penalty: 1.1, // Reduce repetition
        top_k: 40,        // Limit token selection
        tfs_z: 0.1,       // Tail free sampling
        mirostat: 2,      // Use mirostat for better quality/speed balance
        mirostat_tau: 5.0,
        mirostat_eta: 0.1
      }
    };

    // Add tools if provided (Ollama supports function calling)
    if (tools && tools.length > 0) {
      requestBody.tools = tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));
      console.log("Added tools:", tools.length);
    }

    console.log("Making API call to Ollama...");
    console.log("Request body size:", JSON.stringify(requestBody).length, "bytes");
    
    let response;
    let startTime = Date.now();
    
    try {
      // First, check if the model is available
      console.log("Checking model availability...");
      const modelCheckResponse = await fetch(`${this.baseURL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      if (modelCheckResponse.ok) {
        const modelData = await modelCheckResponse.json();
        const modelExists = modelData.models.some((m: any) => m.name === model);
        console.log("Model available:", modelExists);
        
        if (!modelExists) {
          throw new Error(`Model ${model} is not installed or available`);
        }
      } else {
        console.log("Could not check model availability, proceeding anyway...");
      }
      
      // Make the actual API call
      response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        // Add timeout to prevent hanging - increased for larger models
        signal: AbortSignal.timeout(60000) // 60 second timeout
      });
      
      const responseTime = Date.now() - startTime;
      console.log("Response received in:", responseTime, "ms");
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Ollama API error response:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const responseData = await response.json();
      console.log("Ollama API call successful");
      console.log("Response data keys:", Object.keys(responseData));
      
      // Extract function calls if any
      const functionCalls = responseData.message?.tool_calls?.map((call: any) => ({
        name: call.function.name,
        args: JSON.parse(call.function.arguments)
      })) || [];

      console.log("Function calls found:", functionCalls.length);
      console.log("Response text length:", responseData.message?.content?.length || 0);

      return {
        text: responseData.message?.content || '',
        functionCalls
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error("Ollama API call failed after", responseTime, "ms");
      console.error("Error details:", {
        message: error.message,
        name: error.name,
        code: error.code,
        type: error.type,
        cause: error.cause
      });
      
      // Provide more specific error messages
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${responseTime}ms. The model may be overloaded or too slow.`);
      } else if (error.message.includes('fetch')) {
        throw new Error(`Network error: Cannot connect to Ollama at ${this.baseURL}. Is the service running?`);
      } else if (error.message.includes('not installed')) {
        throw new Error(`Model ${model} is not installed. Please install it first.`);
      } else {
        throw error;
      }
    }
  }
}

// Factory function to create the appropriate provider
export function createModelProvider(apiKey?: string, providerType: 'openrouter' | 'ollama' = 'openrouter'): ModelProvider {
  if (providerType === 'ollama') {
    const ollamaHost = process.env.OLLAMA_HOST || 'ollama';
    const ollamaPort = process.env.OLLAMA_PORT || '11434';
    const baseURL = `http://${ollamaHost}:${ollamaPort}`;
    console.log("Creating Ollama provider with baseURL:", baseURL);
    return new OllamaProvider(baseURL);
  } else {
    if (!apiKey) {
      throw new Error("API key required for OpenRouter provider");
    }
    return new OpenRouterProvider(apiKey);
  }
}

// Available models for OpenRouter (all support function calling)
export const AVAILABLE_MODELS = [
  'mistralai/mistral-7b-instruct:free',
  'mistralai/mistral-small-3.2-24b-instruct:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'google/gemma-3n-e2b-it:free',
  'google/gemma-3n-e4b-it:free',
  'google/gemma-3-4b-it:free',
  'google/gemma-3-12b-it:free',
  'google/gemma-3-27b-it:free',
  'google/gemma-2-9b-it:free'
];

// Available models for Ollama (local models) - ordered by performance
export const AVAILABLE_OLLAMA_MODELS = [
  'llama3.2:3b',    // Best performance - 3B parameters (RECOMMENDED)
  'mistral:7b',     // Good balance - 7B parameters
  'qwen2.5:7b',     // Good alternative - 7B parameters
  'mistral:latest'  // Latest version of Mistral
]; 