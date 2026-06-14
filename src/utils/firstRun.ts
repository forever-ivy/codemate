import fs from 'node:fs';
import * as path from 'pathe';
import os from 'node:os';
import type { EnhancedConfig } from '../types/index.js';
import { ModelConfigDiscoveryService } from '../services/ModelConfigDiscoveryService.js';

/**
 * 检查是否是首次运行
 */
export function isFirstRun(): boolean {
  const configPath = getConfigPath();
  const legacyConfigPath = getLegacyConfigPath();

  const hasConfigFile = fs.existsSync(configPath) || fs.existsSync(legacyConfigPath);
  if (!hasConfigFile) {
    return new ModelConfigDiscoveryService().discoverFromEnvironment().length === 0;
  }

  return !hasUsableConfig(configPath, legacyConfigPath);
}

export function hasUsableConfig(
  configPath: string = getConfigPath(),
  legacyConfigPath: string = getLegacyConfigPath()
): boolean {
  const config = loadConfig(configPath, legacyConfigPath);
  if (!config) {
    return false;
  }

  const model = resolveConfiguredModel(config);
  if (!model) {
    return false;
  }

  return hasAvailableApiKey(config);
}

/**
 * 获取配置文件路径
 */
export function getConfigPath(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, '.codemate', 'config.json');
}

export function getLegacyConfigPath(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, '.aiclirc.json');
}

function loadConfig(
  configPath: string,
  legacyConfigPath: string
): Partial<EnhancedConfig & { _metadata?: { provider?: string } }> | null {
  const primaryConfig = readJsonFile(configPath);
  if (primaryConfig) {
    return primaryConfig;
  }

  return readJsonFile(legacyConfigPath);
}

function readJsonFile(filePath: string): Record<string, any> | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function resolveConfiguredModel(
  config: Partial<EnhancedConfig & { _metadata?: { provider?: string } }>
): string | undefined {
  if (typeof config.model === 'string' && config.model.trim()) {
    return config.model.trim();
  }

  const legacyModel = (config as any).model;
  if (legacyModel && typeof legacyModel === 'object' && typeof legacyModel.model === 'string') {
    return legacyModel.model.trim();
  }

  return undefined;
}

function hasAvailableApiKey(
  config: Partial<EnhancedConfig & { _metadata?: { provider?: string } }>
): boolean {
  const providerKey = resolveProviderKey(config);

  if (providerKey) {
    const providerApiKey = config.provider?.[providerKey]?.apiKey;
    if (typeof providerApiKey === 'string' && providerApiKey.trim()) {
      return true;
    }

    const envApiKey = getProviderEnvApiKey(providerKey);
    if (envApiKey) {
      return true;
    }
  }

  const anyProviderHasApiKey = Object.values(config.provider || {}).some(
    (providerConfig) => typeof providerConfig?.apiKey === 'string' && providerConfig.apiKey.trim()
  );
  if (anyProviderHasApiKey) {
    return true;
  }

  const legacyApiKey = (config as any).model?.apiKey;
  return typeof legacyApiKey === 'string' && legacyApiKey.trim().length > 0;
}

function resolveProviderKey(
  config: Partial<EnhancedConfig & { _metadata?: { provider?: string } }>
): string | undefined {
  const metadataProvider = config._metadata?.provider;
  if (typeof metadataProvider === 'string' && metadataProvider.trim()) {
    return metadataProvider.trim();
  }

  const providerKeys = Object.keys(config.provider || {});
  if (providerKeys.length === 1) {
    return providerKeys[0];
  }

  return undefined;
}

function getProviderEnvApiKey(providerKey: string): string | undefined {
  const value = new ModelConfigDiscoveryService().getProviderEnvConfig(providerKey).apiKey;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * 创建默认配置
 */
export function createDefaultConfig(
  apiKey: string,
  provider: string,
  model?: string,
  baseURL?: string
): void {
  const defaultModels: Record<string, string> = {
    openai: 'gpt-4o',
    anthropic: 'claude-3-5-sonnet-20241022',
    deepseek: 'deepseek-reasoner',
    openrouter: 'anthropic/claude-3.5-sonnet',
    glm: 'glm-4-plus',
    custom: 'gpt-4',
  };

  const defaultBaseURLs: Record<string, string | undefined> = {
    openai: undefined,
    anthropic: undefined,
    deepseek: 'https://api.deepseek.com',
    openrouter: 'https://openrouter.ai/api/v1',
    glm: 'https://open.bigmodel.cn/api/paas/v4',
    custom: undefined,
  };

  // 创建符合 ConfigService 期望的配置格式
  const config = {
    app: {
      name: 'codemate',
      version: '1.0.4',
      logLevel: 'info',
      workDir: process.cwd(),
    },
    model: model || defaultModels[provider] || 'gpt-4',
    provider: {
      [provider]: {
        apiKey,
        baseURL: baseURL || defaultBaseURLs[provider] || 'https://api.openai.com/v1',
      },
    },
    temperature: 0.7,
    approvalMode: 'autoEdit',
    sandbox: {
      mode: 'permissive',
      network: 'deny',
      allowUnsandboxedFallback: true,
    },
    tools: {
      enabled: [
        'read_file',
        'write_file',
        'list_files',
        'edit_file',
        'delete_file',
        'grep',
        'glob',
        'bash',
      ],
    },
    ui: {
      theme: 'dark',
      showTimestamp: false,
    },
    performance: {
      compression: {
        enabled: true,
        triggerRatio: 0.7,
        protectThreshold: 10000,
        minimumPrune: 1000,
        protectedTools: ['read_file', 'list_files'],
        protectTurns: 2,
      },
    },
    // 保存元数据用于参考
    _metadata: {
      provider,
      createdAt: new Date().toISOString(),
    },
  };

  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
