'use client';
import React, { useEffect, useState } from 'react';

export function Settings() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [model, setModel] = useState<string>('');
  const [providerType, setProviderType] = useState<'ollama' | 'openrouter'>('ollama');

  // Initialize from localStorage after component mounts
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme');
    const savedModel = localStorage.getItem('model');
    const savedProvider = localStorage.getItem('providerType');
    
    if (savedTheme) setTheme(savedTheme as 'light' | 'dark');
    if (savedModel) setModel(savedModel);
    if (savedProvider) setProviderType(savedProvider as 'ollama' | 'openrouter');
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('model', model);
  }, [model]);

  useEffect(() => {
    localStorage.setItem('providerType', providerType);
  }, [providerType]);

  const openRouterModels = [
    'mistralai/mistral-7b-instruct:free',
    'mistralai/mistral-small-3.2-24b-instruct:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'google/gemini-2.0-flash-exp:free',
    'google/gemini-2.0-flash:free',
    'google/gemma-3n-e2b-it:free',
    'google/gemma-3n-e4b-it:free',
    'google/gemma-3-4b-it:free',
    'google/gemma-3-12b-it:free',
    'google/gemma-3-27b-it:free',
    'google/gemma-2-9b-it:free'
  ];

  const ollamaModels = [
    'llama3.2:3b',    // Best performance - 3B parameters (RECOMMENDED)
    'mistral:7b',     // Good balance - 7B parameters
    'qwen2.5:7b',     // Good alternative - 7B parameters
    'mistral:latest'  // Latest version of Mistral
  ];

  // Performance indicators for Ollama models
  const getPerformanceIndicator = (modelName: string) => {
    if (modelName.includes('llama3.2:3b')) return '🏆 Best Performance (Recommended)';
    if (modelName.includes('mistral:7b') || modelName.includes('mistral:latest')) return '⚖️ Good Balance';
    if (modelName.includes('qwen2.5:7b')) return '🎯 Good Alternative';
    return '🏠 Local';
  };

  const availableModels = providerType === 'ollama' ? ollamaModels : openRouterModels;

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="settings-container" style={{ position: 'absolute', top: 20, right: 20, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div>
          <label>
            <span style={{ marginRight: 8 }}>Theme:</span>
            <select defaultValue="light">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
        <div>
          <label>
            <span style={{ marginRight: 8 }}>Provider:</span>
            <select defaultValue="ollama">
              <option value="ollama">Local (Ollama)</option>
              <option value="openrouter">Cloud (OpenRouter)</option>
            </select>
          </label>
        </div>
        <div>
          <label>
            <span style={{ marginRight: 8 }}>Model:</span>
            <select defaultValue="">
              <option value="">Default</option>
            </select>
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-container" style={{ position: 'absolute', top: 20, right: 20, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div>
        <label>
          <span style={{ marginRight: 8 }}>Theme:</span>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          <span style={{ marginRight: 8 }}>Provider:</span>
          <select
            value={providerType}
            onChange={(e) => {
              setProviderType(e.target.value as 'ollama' | 'openrouter');
              // Reset model when switching providers
              setModel('');
            }}
          >
            <option value="ollama">🏠 Local (Ollama)</option>
            <option value="openrouter">☁️ Cloud (OpenRouter)</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          <span style={{ marginRight: 8 }}>Model:</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="">Default</option>
            {availableModels.map(modelName => (
              <option key={modelName} value={modelName}>
                {providerType === 'ollama' 
                  ? `${modelName} ${getPerformanceIndicator(modelName)}` 
                  : `${modelName} ${modelName.includes('free') ? '🔧 (Free)' : '🔧'}`
                }
              </option>
            ))}
          </select>
        </label>
      </div>
      {providerType === 'ollama' && (
        <div style={{ fontSize: '12px', color: '#666', maxWidth: '200px' }}>
          💡 Local Ollama runs on your machine - no rate limits, no API costs!
        </div>
      )}
      {providerType === 'openrouter' && (
        <div style={{ fontSize: '12px', color: '#666', maxWidth: '200px' }}>
          ⚠️ Cloud provider may have rate limits and usage costs
        </div>
      )}
    </div>
  );
}

export default Settings;
