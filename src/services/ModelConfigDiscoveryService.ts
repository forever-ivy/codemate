import type { EnhancedConfig, ProviderConfig } from '../types/index';

export interface DiscoveredModelProvider {
  providerId: string;
  displayName: string;
  apiKeyEnv: string;
  apiKey?: string;
  baseURLEnv?: string;
  baseURL: string;
  modelEnv?: string;
  model: string;
  source: 'environment' | 'config';
  ready: boolean;
}

export interface ModelConfigDoctorReport {
  activeProviderId: string;
  activeModel: string;
  activeBaseURL: string;
  hasApiKey: boolean;
  discoveredProviders: DiscoveredModelProvider[];
  globalConfigPath: string;
  projectConfigPath: string;
}

interface ProviderDefinition {
  providerId: string;
  displayName: string;
  apiKeyEnv: string;
  baseURLEnv?: string;
  modelEnv?: string;
  defaultBaseURL: string;
  defaultModel: string;
  aliases?: string[];
}

const PROVIDERS: ProviderDefinition[] = [
  {
    providerId: 'deepseek',
    displayName: 'DeepSeek',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    baseURLEnv: 'DEEPSEEK_BASE_URL',
    modelEnv: 'DEEPSEEK_MODEL',
    defaultBaseURL: 'https://api.deepseek.com',
    defaultModel: 'deepseek-reasoner',
  },
  {
    providerId: 'openai',
    displayName: 'OpenAI',
    apiKeyEnv: 'OPENAI_API_KEY',
    baseURLEnv: 'OPENAI_BASE_URL',
    modelEnv: 'OPENAI_MODEL',
    defaultBaseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    aliases: ['codex'],
  },
  {
    providerId: 'glm',
    displayName: 'GLM',
    apiKeyEnv: 'GLM_API_KEY',
    baseURLEnv: 'GLM_BASE_URL',
    modelEnv: 'GLM_MODEL',
    defaultBaseURL: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
  },
  {
    providerId: 'anthropic',
    displayName: 'Anthropic',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    baseURLEnv: 'ANTHROPIC_BASE_URL',
    modelEnv: 'ANTHROPIC_MODEL',
    defaultBaseURL: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-sonnet-20241022',
  },
  {
    providerId: 'openrouter',
    displayName: 'OpenRouter',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    baseURLEnv: 'OPENROUTER_BASE_URL',
    modelEnv: 'OPENROUTER_MODEL',
    defaultBaseURL: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-sonnet',
  },
];

/**
 * 发现本机可用模型配置。
 *
 * 这里刻意只读取公开约定的环境变量，不偷读 Codex、Claude Code 等工具的私有配置文件。
 * 这样既能复用用户已有的 API Key，又能避免跨工具配置格式变化和隐私风险。
 */
export class ModelConfigDiscoveryService {
  constructor(private env: NodeJS.ProcessEnv = process.env) {}

  discoverFromEnvironment(): DiscoveredModelProvider[] {
    return PROVIDERS.map((provider) => {
      const apiKey = this.readEnv(provider.apiKeyEnv);
      return {
        providerId: provider.providerId,
        displayName: provider.displayName,
        apiKeyEnv: provider.apiKeyEnv,
        apiKey,
        baseURLEnv: provider.baseURLEnv,
        baseURL: this.readEnv(provider.baseURLEnv) || provider.defaultBaseURL,
        modelEnv: provider.modelEnv,
        model: this.readEnv(provider.modelEnv) || provider.defaultModel,
        source: 'environment' as const,
        ready: Boolean(apiKey),
      };
    }).filter((provider) => provider.ready);
  }

  getPreferredProvider(): DiscoveredModelProvider | undefined {
    const discovered = this.discoverFromEnvironment();
    return discovered[0];
  }

  findProvider(providerIdOrAlias: string): DiscoveredModelProvider | undefined {
    const normalized = providerIdOrAlias.trim().toLowerCase();
    return this.discoverFromEnvironment().find((provider) => {
      const definition = PROVIDERS.find((item) => item.providerId === provider.providerId);
      return provider.providerId === normalized || definition?.aliases?.includes(normalized);
    });
  }

  getDefaultModel(providerId: string): string {
    return this.getDefinition(providerId)?.defaultModel || 'deepseek-reasoner';
  }

  getDefaultBaseURL(providerId: string): string {
    return this.getDefinition(providerId)?.defaultBaseURL || 'https://api.deepseek.com';
  }

  getProviderEnvConfig(providerId: string): { apiKey?: string; baseURL?: string; model?: string } {
    const definition = this.getDefinition(providerId);
    if (!definition) {
      return {};
    }

    return {
      apiKey: this.readEnv(definition.apiKeyEnv),
      baseURL: this.readEnv(definition.baseURLEnv),
      model: this.readEnv(definition.modelEnv),
    };
  }

  createProviderConfig(provider: DiscoveredModelProvider): Partial<EnhancedConfig> {
    return {
      model: provider.model,
      provider: {
        [provider.providerId]: {
          apiKey: provider.apiKey,
          baseURL: provider.baseURL,
        } satisfies ProviderConfig,
      },
      _metadata: {
        provider: provider.providerId,
        importedFrom: 'environment',
        importedAt: new Date().toISOString(),
      } as any,
    } as Partial<EnhancedConfig>;
  }

  formatDoctorReport(report: ModelConfigDoctorReport): string {
    const lines = [
      'Model configuration doctor',
      '',
      `Active provider: ${report.activeProviderId}`,
      `Active model: ${report.activeModel}`,
      `Base URL: ${report.activeBaseURL}`,
      `API key: ${report.hasApiKey ? 'configured' : 'missing'}`,
      '',
      'Discovered environment providers:',
    ];

    if (report.discoveredProviders.length === 0) {
      lines.push('- none');
    } else {
      for (const provider of report.discoveredProviders) {
        lines.push(
          `- ${provider.displayName} (${provider.providerId}) · ${provider.model} · ${provider.apiKeyEnv}`
        );
      }
    }

    lines.push(
      '',
      'Config files:',
      `- Global: ${report.globalConfigPath}`,
      `- Project: ${report.projectConfigPath}`
    );
    lines.push('', 'Commands:', '- /config import-env [provider] [global|project]', '- /model');

    return lines.join('\n');
  }

  private getDefinition(providerId: string): ProviderDefinition | undefined {
    const normalized = providerId.trim().toLowerCase();
    return PROVIDERS.find(
      (provider) => provider.providerId === normalized || provider.aliases?.includes(normalized)
    );
  }

  private readEnv(name?: string): string | undefined {
    if (!name) {
      return undefined;
    }

    const value = this.env[name];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
