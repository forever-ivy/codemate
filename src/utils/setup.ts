import readline from 'node:readline';
import { createDefaultConfig } from './firstRun.js';

/**
 * AI 提供商配置
 */
const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    defaultModel: 'gpt-4o',
    baseURL: undefined,
  },
  anthropic: {
    name: 'Anthropic',
    defaultModel: 'claude-3-5-sonnet-20241022',
    baseURL: undefined,
  },
  deepseek: {
    name: 'DeepSeek',
    defaultModel: 'deepseek-reasoner',
    baseURL: 'https://api.deepseek.com',
  },
  glm: {
    name: 'GLM',
    defaultModel: 'glm-4-plus',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  },
  openrouter: {
    name: 'OpenRouter',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    baseURL: 'https://openrouter.ai/api/v1',
  },
  custom: {
    name: '自定义 (OpenAI 兼容)',
    defaultModel: 'gpt-4',
    baseURL: undefined,
  },
};

/**
 * 运行首次配置向导
 */
export async function runFirstTimeSetup(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('请选择 AI 提供商:');
  console.log('  1. OpenAI (GPT-4, GPT-3.5)');
  console.log('  2. Anthropic (Claude)');
  console.log('  3. DeepSeek (国内可用，性价比高)');
  console.log('  4. GLM (智谱，OpenAI 兼容)');
  console.log('  5. OpenRouter (多模型聚合)');
  console.log('  6. 自定义 (OpenAI 兼容 API)');
  console.log('');

  // 选择提供商
  const choice = await question(rl, '请输入选项 (1-6): ');
  const providerKey = getProviderKey(choice.trim());

  console.log('');

  // 输入 API Key
  const apiKey = await question(rl, '请输入 API Key: ');

  console.log('');

  // 如果是自定义提供商，询问 Base URL
  let baseURL: string | undefined;
  if (providerKey === 'custom') {
    baseURL = await question(rl, '请输入 API Base URL (例如: https://api.example.com/v1): ');
    console.log('');
  }

  // 询问模型（可选）
  const defaultModel = PROVIDERS[providerKey].defaultModel;
  const modelInput = await question(rl, `请输入模型名称 (直接回车使用默认: ${defaultModel}): `);
  const model = modelInput.trim() || defaultModel;

  rl.close();

  // 保存配置
  createDefaultConfig(apiKey.trim(), providerKey, model, baseURL || PROVIDERS[providerKey].baseURL);

  console.log('');
  console.log('✅ 配置已保存到: ~/.codemate/config.json');
  console.log('');
  console.log(`提供商: ${PROVIDERS[providerKey].name}`);
  console.log(`模型: ${model}`);
  if (baseURL || PROVIDERS[providerKey].baseURL) {
    console.log(`Base URL: ${baseURL || PROVIDERS[providerKey].baseURL}`);
  }
}

/**
 * 根据用户选择获取提供商 key
 */
function getProviderKey(choice: string): keyof typeof PROVIDERS {
  switch (choice) {
    case '1':
      return 'openai';
    case '2':
      return 'anthropic';
    case '3':
      return 'deepseek';
    case '4':
      return 'glm';
    case '5':
      return 'openrouter';
    case '6':
      return 'custom';
    default:
      return 'openai';
  }
}

/**
 * 封装 readline 的 question 方法为 Promise
 */
function question(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}
