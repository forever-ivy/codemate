import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '../../../src/services/ConfigService';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('ConfigService', () => {
  let configService: ConfigService;
  const testConfigFile = path.join(process.cwd(), 'test-config.json');

  beforeEach(() => {
    configService = new ConfigService({
      cwd: process.cwd(),
      productName: 'aicli',
    });
  });

  afterEach(async () => {
    // 清理测试配置文件
    try {
      await fs.unlink(testConfigFile);
    } catch {
      // 忽略错误
    }
  });

  /**
   * 测试 1：应该初始化默认配置
   */
  it('should initialize with default config', () => {
    const config = configService.getConfig();

    expect(config.model).toBeDefined();
    expect(config.language).toBe('English');
    expect(config.quiet).toBe(false);
  });

  /**
   * 测试 2：应该能获取各部分配置
   */
  it('should get config sections', () => {
    const config = configService.getConfig();

    expect(config.model).toBeDefined();
    expect(config.language).toBeDefined();
    expect(config.plugins).toBeInstanceOf(Array);
    expect(config.mcpServers).toBeDefined();
  });

  /**
   * 测试 3：应该能加载配置文件
   */
  it('should load config from file', async () => {
    // 创建测试配置文件
    const testConfig = {
      temperature: 0.5,
      language: 'zh-CN',
    };

    await fs.writeFile(testConfigFile, JSON.stringify(testConfig), 'utf-8');

    // 重新创建 ConfigService 并加载配置
    configService = new ConfigService({
      cwd: process.cwd(),
      productName: 'aicli',
    });

    const config = configService.getConfig();
    expect(config.temperature).toBe(0.5);
    expect(config.language).toBe('zh-CN');
  });

  /**
   * 测试 4：应该能从环境变量加载配置
   */
  it('should load config from environment variables', async () => {
    // 设置环境变量
    process.env.MODEL = 'test-model';
    process.env.TEMPERATURE = '0.3';

    // 重新创建 ConfigService（读取环境变量）
    configService = new ConfigService({
      cwd: process.cwd(),
      productName: 'aicli',
    });

    const config = configService.getConfig();
    expect(config.model).toBe('test-model');
    expect(config.temperature).toBe(0.3);

    // 清理环境变量
    delete process.env.MODEL;
    delete process.env.TEMPERATURE;
  });

  /**
   * 测试 5：应该验证配置
   */
  it('should validate config', async () => {
    // 创建无效的配置文件
    const invalidConfig = {
      temperature: 5, // 超出范围（应该是 0-2）
    };

    await fs.writeFile(testConfigFile, JSON.stringify(invalidConfig), 'utf-8');

    // ConfigManager 会自动验证并使用默认值
    configService = new ConfigService({
      cwd: process.cwd(),
      productName: 'aicli',
    });

    const config = configService.getConfig();
    // 无效值应该被忽略或使用默认值
    expect(config.temperature).toBeLessThanOrEqual(2);
  });

  /**
   * 测试 6：应该能更新配置
   */
  it('should update config', () => {
    configService.updateConfig(false, {
      temperature: 0.9,
    });

    const config = configService.getConfig();
    expect(config.temperature).toBe(0.9);
    // 其他配置应该保持不变
    expect(config.model).toBeDefined();
  });

  /**
   * 测试 7：应该处理配置文件不存在的情况
   */
  it('should handle missing config file gracefully', async () => {
    // 创建 ConfigService 不应该抛出错误
    const newConfigService = new ConfigService({
      cwd: process.cwd(),
      productName: 'aicli',
    });

    // 应该使用默认配置
    const config = newConfigService.getConfig();
    expect(config.model).toBeDefined();
  });

  /**
   * 测试 8：配置优先级应该正确
   */
  it('should respect config priority', async () => {
    // 1. 默认配置
    const defaultConfig = configService.getConfig();
    expect(defaultConfig.temperature).toBeDefined();

    // 2. 配置文件覆盖
    const fileConfig = {
      temperature: 0.5,
    };
    await fs.writeFile(testConfigFile, JSON.stringify(fileConfig), 'utf-8');

    // 3. 环境变量覆盖
    process.env.TEMPERATURE = '0.3';

    // 重新创建并加载
    configService = new ConfigService({
      cwd: process.cwd(),
      productName: 'aicli',
    });

    // 环境变量应该有最高优先级
    expect(configService.getConfig().temperature).toBe(0.3);

    // 清理
    delete process.env.TEMPERATURE;
  });
});
