import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { ModelConfig } from '../types/index';

export interface ModelCapabilities {
  reasoning: boolean;
  tools: boolean;
}

export interface ProviderModelDescriptor {
  providerId: string;
  modelId: string;
  model: LanguageModel;
  capabilities: ModelCapabilities;
}

export class ModelProviderFactory {
  create(config: ModelConfig): ProviderModelDescriptor {
    const providerId = detectProvider(config.baseURL, config.model);
    const provider = createProvider(providerId, config);

    return {
      providerId,
      modelId: config.model,
      model: provider(config.model),
      capabilities: {
        reasoning: providerId === 'deepseek' && isThinkingModel(config.model),
        tools: true,
      },
    };
  }
}

function createProvider(providerId: string, config: ModelConfig) {
  if (providerId === 'openai') {
    return createOpenAI({
      name: providerId,
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });
  }

  return createOpenAICompatible({
    name: providerId,
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });
}

function detectProvider(baseURL: string, modelId: string): string {
  if (baseURL.includes('deepseek') || modelId.startsWith('deepseek-')) {
    return 'deepseek';
  }

  if (baseURL.includes('bigmodel') || modelId.startsWith('glm-')) {
    return 'glm';
  }

  if (baseURL.includes('openai.com')) {
    return 'openai';
  }

  return 'custom';
}

function isThinkingModel(modelId: string): boolean {
  return modelId.includes('reasoner') || modelId.includes('v4-pro');
}
