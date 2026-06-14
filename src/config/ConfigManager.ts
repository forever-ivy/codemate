import defu from 'defu';
import * as fs from 'node:fs';
import { homedir } from 'node:os';
import * as path from 'pathe';
import type { EnhancedConfig, ConfigManagerOptions } from '../types/index';

/**
 * ConfigManager - 配置管理器
 *
 * 职责：
 * 1. 加载多层配置文件（全局、项目、项目本地）
 * 2. 按优先级合并配置
 * 3. 支持嵌套配置（dot notation）
 * 4. 配置验证
 *
 * 配置优先级（从高到低）：
 * argv > projectLocal > project > global > default
 */
export class ConfigManager {
  // 配置存储
  globalConfig: Partial<EnhancedConfig>;
  projectConfig: Partial<EnhancedConfig>;
  argvConfig: Partial<EnhancedConfig>;

  // 配置文件路径
  globalConfigPath: string;
  projectConfigPath: string;

  /**
   * 构造函数
   *
   * @param options 配置选项
   *
   * 为什么需要 cwd 和 productName？
   * - cwd：确定项目配置文件的位置
   * - productName：确定配置文件夹名称（如 .codemate）
   */
  constructor(options: ConfigManagerOptions) {
    const { cwd, productName, argvConfig = {} } = options;
    const lowerProductName = productName.toLowerCase();
    const legacyGlobalConfigPath = path.join(homedir(), '.aiclirc.json');

    // 配置文件路径
    // 全局配置：~/.codemate/config.json
    this.globalConfigPath = path.join(homedir(), `.${lowerProductName}`, 'config.json');

    // 项目配置：.codemate/config.json
    this.projectConfigPath = path.join(cwd, `.${lowerProductName}`, 'config.json');

    // 项目本地配置：.codemate/config.local.json
    const projectLocalConfigPath = path.join(cwd, `.${lowerProductName}`, 'config.local.json');

    // 加载配置
    this.globalConfig = defu(
      this.loadConfig(this.globalConfigPath),
      this.loadConfig(legacyGlobalConfigPath)
    );

    // 项目配置 = 项目配置 + 项目本地配置
    // 使用 defu 合并，项目本地配置优先级更高
    this.projectConfig = defu(
      this.loadConfig(projectLocalConfigPath), // 优先级高
      this.loadConfig(this.projectConfigPath) // 优先级低
    );

    this.argvConfig = argvConfig;

    console.log('✅ ConfigManager initialized');
  }

  /**
   * 获取合并后的配置
   *
   * 这是一个 getter，使用时像访问属性一样：configManager.config
   *
   * 为什么使用 getter？
   * - 每次访问都会重新计算，确保获取最新的合并结果
   * - 语法更简洁，不需要调用方法
   *
   * 优先级：argv > projectLocal > project > global > default
   */
  get config(): EnhancedConfig {
    const config = defu(
      this.argvConfig, // 最高优先级
      defu(
        this.projectConfig, // 项目配置（已包含本地配置）
        defu(
          this.globalConfig, // 全局配置
          this.getDefaultConfig() // 默认配置（最低优先级）
        )
      )
    ) as EnhancedConfig;

    this.normalizeConfig(config);

    // 设置默认模型
    // 如果没有指定 planModel，使用 model
    config.planModel = config.planModel || config.model;
    config.smallModel = config.smallModel || config.model;
    config.visionModel = config.visionModel || config.model;

    return config;
  }

  /**
   * 获取默认配置
   *
   * 为什么需要默认配置？
   * - 确保系统有基本的可用配置
   * - 减少用户必须配置的项目
   * - 提供合理的默认值
   */
  private getDefaultConfig(): Partial<EnhancedConfig> {
    return {
      model: 'deepseek-chat',
      planModel: 'deepseek-chat',
      language: 'English',
      quiet: false,
      approvalMode: 'autoEdit',
      sandbox: {
        mode: 'permissive',
        network: 'deny',
        allowUnsandboxedFallback: true,
      },
      plugins: [],
      mcpServers: {},
      provider: {},
      todo: true,
      autoCompact: true,
      truncation: true,
      outputFormat: 'text',
      autoUpdate: true,
      extensions: {},
      tools: {},
      agent: {},
      checkpoints: true,
      workspace: {
        baseBranch: 'main',
        autoDelete: true,
        parentDir: '..',
      },
    };
  }

  /**
   * 加载配置文件
   *
   * @param filePath 配置文件路径
   * @returns 配置对象
   *
   * 为什么返回空对象而不是抛出错误？
   * - 配置文件可能不存在（首次使用）
   * - 不应该因为配置文件不存在而导致程序崩溃
   * - 返回空对象，让 defu 合并时使用默认值
   */
  private loadConfig(filePath: string): Partial<EnhancedConfig> {
    if (!fs.existsSync(filePath)) {
      return {};
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`⚠️  Failed to load config: ${filePath}`);
      return {};
    }
  }

  private normalizeConfig(config: EnhancedConfig): void {
    const legacyModel = (config as any).model;
    if (!legacyModel || typeof legacyModel !== 'object') {
      return;
    }

    const modelName = typeof legacyModel.model === 'string' ? legacyModel.model : 'deepseek-chat';
    const providerKey = (config as any)._metadata?.provider || 'deepseek';

    config.model = modelName;

    if (!config.provider) {
      config.provider = {};
    }

    const existingProvider = config.provider[providerKey] || {};
    config.provider[providerKey] = {
      apiKey: existingProvider.apiKey || legacyModel.apiKey,
      baseURL: existingProvider.baseURL || legacyModel.baseURL,
    };

    if (config.temperature === undefined && legacyModel.temperature !== undefined) {
      config.temperature = legacyModel.temperature;
    }
  }

  /**
   * 保存配置文件
   *
   * @param filePath 配置文件路径
   * @param config 配置对象
   *
   * 为什么要过滤默认值？
   * - 保持配置文件简洁
   * - 只保存用户修改的配置
   * - 减少配置文件大小
   */
  private saveConfig(filePath: string, config: Partial<EnhancedConfig>): void {
    // 过滤掉默认值
    const defaultConfig = this.getDefaultConfig();
    const filteredConfig = Object.fromEntries(
      Object.entries(config).filter(
        ([key, value]) =>
          JSON.stringify(value) !== JSON.stringify(defaultConfig[key as keyof EnhancedConfig])
      )
    );

    // 确保目录存在
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 写入文件
    fs.writeFileSync(filePath, JSON.stringify(filteredConfig, null, 2), 'utf-8');
  }

  /**
   * 设置配置
   *
   * 支持 dot notation: 'agent.Explore.model'
   *
   * @param global 是否设置全局配置
   * @param key 配置键（支持 dot notation）
   * @param value 配置值
   *
   * 为什么需要 global 参数？
   * - 允许用户选择设置全局配置还是项目配置
   * - 全局配置影响所有项目
   * - 项目配置只影响当前项目
   */
  setConfig(global: boolean, key: string, value: any): void {
    const config = global ? this.globalConfig : this.projectConfig;
    const configPath = global ? this.globalConfigPath : this.projectConfigPath;

    if (key.includes('.')) {
      // 处理嵌套配置：'agent.Explore.model'
      this.setNestedConfig(config, key, value);
    } else {
      // 处理平面配置：'model'
      (config as any)[key] = value;
    }

    // 保存配置
    this.saveConfig(configPath, config);

    // 更新内存中的配置
    if (global) {
      this.globalConfig = config;
    } else {
      this.projectConfig = config;
    }

    console.log(`✅ Config set: ${key} = ${JSON.stringify(value)}`);
  }

  /**
   * 设置嵌套配置
   *
   * @param config 配置对象
   * @param key 配置键（dot notation）
   * @param value 配置值
   *
   * 实现原理：
   * 1. 分割 key：'agent.Explore.model' -> ['agent', 'Explore', 'model']
   * 2. 导航到嵌套属性，自动创建中间对象
   * 3. 设置最后一个键的值
   *
   * 为什么需要自动创建中间对象？
   * - 用户可能设置一个不存在的嵌套路径
   * - 自动创建可以避免错误
   * - 提供更好的用户体验
   */
  private setNestedConfig(config: Partial<EnhancedConfig>, key: string, value: any): void {
    const keys = key.split('.');
    const rootKey = keys[0] as keyof EnhancedConfig;

    // 初始化根对象
    if (!(config as any)[rootKey]) {
      (config as any)[rootKey] = {};
    }

    // 导航到嵌套属性
    let current: any = (config as any)[rootKey];
    for (let i = 1; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {}; // 自动创建中间对象
      }
      current = current[keys[i]];
    }

    // 设置值
    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
  }

  /**
   * 获取配置
   *
   * 支持 dot notation: 'agent.Explore.model'
   *
   * @param global 是否获取全局配置
   * @param key 配置键（支持 dot notation）
   * @returns 配置值
   *
   * 为什么返回 any？
   * - 配置值的类型是动态的
   * - 可能是 string、number、boolean、object 等
   * - 使用 any 提供最大的灵活性
   */
  getConfig(global: boolean, key: string): any {
    const config = global ? this.globalConfig : this.projectConfig;

    if (!key.includes('.')) {
      // 平面配置
      return (config as any)[key];
    }

    // 嵌套配置
    const keys = key.split('.');
    let current: any = config;

    for (const k of keys) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[k];
    }

    return current;
  }

  /**
   * 添加配置（用于数组和对象）
   *
   * @param global 是否添加到全局配置
   * @param key 配置键
   * @param values 要添加的值
   *
   * 使用场景：
   * - 添加插件：addConfig(false, 'plugins', ['logger-plugin'])
   * - 添加 MCP 服务器：addConfig(false, 'mcpServers', { name: config })
   *
   * 为什么需要区分数组和对象？
   * - 数组：追加元素
   * - 对象：合并属性
   * - 其他类型：直接设置
   */
  addConfig(global: boolean, key: string, values: any): void {
    const config = global ? this.globalConfig : this.projectConfig;
    const configPath = global ? this.globalConfigPath : this.projectConfigPath;

    const currentValue = (config as any)[key];

    if (Array.isArray(currentValue)) {
      // 数组：追加值
      (config as any)[key] = [...currentValue, ...values];
    } else if (typeof currentValue === 'object') {
      // 对象：合并值
      (config as any)[key] = { ...currentValue, ...values };
    } else {
      // 其他：直接设置
      (config as any)[key] = values;
    }

    this.saveConfig(configPath, config);

    console.log(`✅ Config added: ${key}`);
  }

  /**
   * 移除配置
   *
   * @param global 是否从全局配置移除
   * @param key 配置键
   * @param values 要移除的值（可选，用于数组）
   *
   * 使用场景：
   * - 移除插件：removeConfig(false, 'plugins', ['logger-plugin'])
   * - 删除整个键：removeConfig(false, 'plugins')
   */
  removeConfig(global: boolean, key: string, values?: string[]): void {
    const config = global ? this.globalConfig : this.projectConfig;
    const configPath = global ? this.globalConfigPath : this.projectConfigPath;

    if (values && Array.isArray((config as any)[key])) {
      // 从数组中移除指定值
      (config as any)[key] = (config as any)[key].filter((v: string) => !values.includes(v));
    } else {
      // 删除整个键
      delete (config as any)[key];
    }

    this.saveConfig(configPath, config);

    console.log(`✅ Config removed: ${key}`);
  }

  /**
   * 更新配置
   *
   * @param global 是否更新全局配置
   * @param newConfig 新配置
   *
   * 使用场景：
   * - 批量更新多个配置项
   * - 从文件导入配置
   *
   * 为什么使用 defu 合并？
   * - 深度合并，保留未修改的嵌套属性
   * - 不会覆盖整个配置对象
   */
  updateConfig(global: boolean, newConfig: Partial<EnhancedConfig>): void {
    let config = global ? this.globalConfig : this.projectConfig;
    const configPath = global ? this.globalConfigPath : this.projectConfigPath;

    // 深度合并
    config = defu(newConfig, config);

    if (global) {
      this.globalConfig = config;
    } else {
      this.projectConfig = config;
    }

    this.saveConfig(configPath, config);

    console.log('✅ Config updated');
  }

  /**
   * 获取全局配置文件路径
   */
  getGlobalConfigPath(): string {
    return this.globalConfigPath;
  }

  /**
   * 获取项目配置文件路径
   */
  getProjectConfigPath(): string {
    return this.projectConfigPath;
  }
}
