import { ConfigManager } from '../config/ConfigManager';
import type { EnhancedConfig, ConfigManagerOptions, ModelConfig } from '../types/index';
import {
  ModelConfigDiscoveryService,
  type ModelConfigDoctorReport,
} from './ModelConfigDiscoveryService';

/**
 * ConfigService - 配置服务（增强版）
 *
 * 使用 ConfigManager 管理多层配置
 *
 * 为什么需要 ConfigService？
 * - 提供统一的配置访问接口
 * - 封装 ConfigManager 的复杂性
 * - 保持向后兼容
 */
export class ConfigService {
  private configManager: ConfigManager;
  private discoveryService: ModelConfigDiscoveryService;

  /**
   * 构造函数
   *
   * @param options 配置选项
   *
   * 注意：这里的接口与第 8 篇不同
   * 第 8 篇：ConfigService(options: ConfigOptions)
   * 第 26 篇：ConfigService(options: ConfigManagerOptions)
   *
   * 为什么改变接口？
   * - 需要更多信息来初始化 ConfigManager
   * - 支持多层配置需要 cwd 和 productName
   */
  constructor(options: ConfigManagerOptions) {
    this.configManager = new ConfigManager(options);
    this.discoveryService = new ModelConfigDiscoveryService();
    console.log('✅ ConfigService initialized (Enhanced)');
  }

  /**
   * 获取完整配置
   *
   * 这是最常用的方法，返回合并后的完整配置
   */
  getConfig(): EnhancedConfig {
    return this.configManager.config;
  }

  /**
   * 获取增强配置（别名方法）
   *
   * 与 getConfig() 相同，为了兼容性提供
   */
  getEnhancedConfig(): EnhancedConfig {
    return this.configManager.config;
  }

  /**
   * 设置配置
   *
   * @param global 是否设置全局配置
   * @param key 配置键（支持 dot notation）
   * @param value 配置值
   *
   * 使用示例：
   * configService.setConfig(false, 'model', 'claude-sonnet-4');
   * configService.setConfig(false, 'agent.Explore.model', 'claude-haiku');
   */
  setConfig(global: boolean, key: string, value: any): void {
    this.configManager.setConfig(global, key, value);
  }

  /**
   * 获取配置值
   *
   * @param global 是否获取全局配置
   * @param key 配置键（支持 dot notation）
   *
   * 使用示例：
   * const model = configService.getConfigValue(false, 'model');
   * const exploreModel = configService.getConfigValue(false, 'agent.Explore.model');
   */
  getConfigValue(global: boolean, key: string): any {
    return this.configManager.getConfig(global, key);
  }

  /**
   * 添加配置
   *
   * @param global 是否添加到全局配置
   * @param key 配置键
   * @param values 要添加的值
   *
   * 使用示例：
   * configService.addConfig(false, 'plugins', ['logger-plugin']);
   */
  addConfig(global: boolean, key: string, values: any): void {
    this.configManager.addConfig(global, key, values);
  }

  /**
   * 移除配置
   *
   * @param global 是否从全局配置移除
   * @param key 配置键
   * @param values 要移除的值（可选）
   *
   * 使用示例：
   * configService.removeConfig(false, 'plugins', ['logger-plugin']);
   * configService.removeConfig(false, 'plugins');  // 删除整个 plugins
   */
  removeConfig(global: boolean, key: string, values?: string[]): void {
    this.configManager.removeConfig(global, key, values);
  }

  /**
   * 更新配置
   *
   * @param global 是否更新全局配置
   * @param newConfig 新配置
   *
   * 使用示例：
   * configService.updateConfig(false, {
   *   model: 'claude-sonnet-4',
   *   temperature: 0.9
   * });
   */
  updateConfig(global: boolean, newConfig: Partial<EnhancedConfig>): void {
    this.configManager.updateConfig(global, newConfig);
  }

  // ========== 向后兼容方法 ==========

  /**
   * 获取模型配置（向后兼容）
   *
   * 第 8 篇的代码可能会调用这个方法
   * 我们保留它以确保向后兼容
   *
   * 优先级：
   * 1. 环境变量（DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL）
   * 2. 配置文件
   * 3. 默认值
   */
  getModelConfig(): ModelConfig {
    const config = this.getConfig();
    const legacyModel =
      typeof (config as any).model === 'object' ? (config as any).model : undefined;
    const providerKey = this.getProviderKey(config) || 'deepseek';
    const providerConfig = config.provider?.[providerKey];
    const envConfig = this.getProviderEnvConfig(providerKey);
    const usesEnvironmentDiscoveredProvider =
      !(config as any)._metadata?.provider && Object.keys(config.provider || {}).length === 0;
    const configuredModel =
      !usesEnvironmentDiscoveredProvider && typeof config.model === 'string'
        ? config.model
        : undefined;

    return {
      apiKey: envConfig.apiKey || providerConfig?.apiKey || legacyModel?.apiKey || '',
      baseURL:
        envConfig.baseURL ||
        providerConfig?.baseURL ||
        legacyModel?.baseURL ||
        this.getDefaultBaseURL(providerKey),
      model:
        configuredModel ||
        envConfig.model ||
        legacyModel?.model ||
        this.getDefaultModel(providerKey),
      temperature: config.temperature ?? legacyModel?.temperature ?? 0.7,
    };
  }

  getModelDoctorReport(): ModelConfigDoctorReport {
    const modelConfig = this.getModelConfig();
    const providerKey = this.getProviderKey(this.getConfig()) || 'deepseek';

    return {
      activeProviderId: providerKey,
      activeModel: modelConfig.model,
      activeBaseURL: modelConfig.baseURL,
      hasApiKey: Boolean(modelConfig.apiKey),
      discoveredProviders: this.discoveryService.discoverFromEnvironment(),
      globalConfigPath: this.getGlobalConfigPath(),
      projectConfigPath: this.getProjectConfigPath(),
    };
  }

  formatModelDoctorReport(): string {
    return this.discoveryService.formatDoctorReport(this.getModelDoctorReport());
  }

  importDiscoveredProvider(providerId?: string, global = false): string {
    const provider = providerId
      ? this.discoveryService.findProvider(providerId)
      : this.discoveryService.getPreferredProvider();

    if (!provider) {
      return providerId
        ? `❌ No environment configuration found for provider: ${providerId}`
        : '❌ No model provider environment variables found';
    }

    this.updateConfig(global, this.discoveryService.createProviderConfig(provider));

    const scope = global ? 'global' : 'project';
    return [
      `✅ Imported ${provider.displayName} from environment into ${scope} config`,
      `Provider: ${provider.providerId}`,
      `Model: ${provider.model}`,
      `Base URL: ${provider.baseURL}`,
      `API key env: ${provider.apiKeyEnv}`,
    ].join('\n');
  }

  private getProviderKey(config: EnhancedConfig): string | undefined {
    const metadataProvider = (config as any)._metadata?.provider;
    if (typeof metadataProvider === 'string' && metadataProvider.trim()) {
      return metadataProvider;
    }

    const providerKeys = config.provider ? Object.keys(config.provider) : [];
    if (providerKeys.length === 1) {
      return providerKeys[0];
    }

    const discoveredProvider = this.discoveryService.getPreferredProvider();
    if (discoveredProvider) {
      return discoveredProvider.providerId;
    }

    return undefined;
  }

  private getDefaultModel(providerKey: string): string {
    return this.discoveryService.getDefaultModel(providerKey);
  }

  private getDefaultBaseURL(providerKey: string): string {
    return this.discoveryService.getDefaultBaseURL(providerKey);
  }

  private getProviderEnvConfig(providerKey: string): {
    apiKey?: string;
    baseURL?: string;
    model?: string;
  } {
    return this.discoveryService.getProviderEnvConfig(providerKey);
  }

  /**
   * 获取应用配置（向后兼容）
   */
  getAppConfig() {
    return {
      name: 'codemate-ai',
      version: '1.0.0',
      logLevel: 'info' as const,
      workDir: process.cwd(),
    };
  }

  /**
   * 获取工具配置（向后兼容）
   */
  getToolConfig() {
    const config = this.getConfig();
    return {
      enabled: config.tools ? Object.keys(config.tools).filter((k) => config.tools![k]) : [],
    };
  }

  /**
   * 获取 UI 配置（向后兼容）
   */
  getUIConfig() {
    return {
      theme: 'dark' as const,
      showTimestamp: false,
    };
  }

  /**
   * 获取全局配置文件路径
   */
  getGlobalConfigPath(): string {
    return this.configManager.getGlobalConfigPath();
  }

  /**
   * 获取项目配置文件路径
   */
  getProjectConfigPath(): string {
    return this.configManager.getProjectConfigPath();
  }
}
