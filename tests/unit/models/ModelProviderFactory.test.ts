import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelProviderFactory } from '../../../src/models/ModelProviderFactory';

const { openAIModel, createOpenAI, openAICompatibleModel, createOpenAICompatible } = vi.hoisted(
  () => {
    const openAIModel = vi.fn(() => ({ specificationVersion: 'v3' }));
    const createOpenAI = vi.fn(() => openAIModel);
    const openAICompatibleModel = vi.fn(() => ({ specificationVersion: 'v3' }));
    const createOpenAICompatible = vi.fn(() => openAICompatibleModel);

    return {
      openAIModel,
      createOpenAI,
      openAICompatibleModel,
      createOpenAICompatible,
    };
  }
);

vi.mock('@ai-sdk/openai', () => ({ createOpenAI }));

vi.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible }));

describe('ModelProviderFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates DeepSeek through the OpenAI-compatible provider', () => {
    const descriptor = new ModelProviderFactory().create({
      apiKey: 'secret',
      baseURL: 'https://api.deepseek.com',
      model: 'deepseek-reasoner',
      temperature: 0.7,
    });

    expect(createOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'deepseek',
        baseURL: 'https://api.deepseek.com',
        apiKey: 'secret',
      })
    );
    expect(openAICompatibleModel).toHaveBeenCalledWith('deepseek-reasoner');
    expect(descriptor).toMatchObject({
      providerId: 'deepseek',
      modelId: 'deepseek-reasoner',
      capabilities: { reasoning: true, tools: true },
    });
  });

  it('creates custom OpenAI-compatible providers through the compatible provider factory', () => {
    new ModelProviderFactory().create({
      apiKey: 'secret',
      baseURL: 'https://llm.example.com/v1',
      model: 'acme-chat',
      temperature: 0.2,
    });

    expect(createOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'custom',
        baseURL: 'https://llm.example.com/v1',
        apiKey: 'secret',
      })
    );
    expect(openAICompatibleModel).toHaveBeenCalledWith('acme-chat');
    expect(createOpenAI).not.toHaveBeenCalled();
    expect(openAIModel).not.toHaveBeenCalled();
  });

  it('routes gpt models on custom base URLs through the compatible provider factory', () => {
    new ModelProviderFactory().create({
      apiKey: 'secret',
      baseURL: 'https://llm.example.com/v1',
      model: 'gpt-4o',
      temperature: 0.2,
    });

    expect(createOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'custom',
        baseURL: 'https://llm.example.com/v1',
        apiKey: 'secret',
      })
    );
    expect(openAICompatibleModel).toHaveBeenCalledWith('gpt-4o');
    expect(createOpenAI).not.toHaveBeenCalled();
    expect(openAIModel).not.toHaveBeenCalled();
  });

  it('routes gpt-4o on the native OpenAI base URL through createOpenAI', () => {
    const descriptor = new ModelProviderFactory().create({
      apiKey: 'secret',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      temperature: 0.2,
    });

    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'openai',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'secret',
      })
    );
    expect(openAIModel).toHaveBeenCalledWith('gpt-4o');
    expect(createOpenAICompatible).not.toHaveBeenCalled();
    expect(openAICompatibleModel).not.toHaveBeenCalled();
    expect(descriptor.providerId).toBe('openai');
  });
});
