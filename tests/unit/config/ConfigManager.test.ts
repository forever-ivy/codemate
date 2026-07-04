import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from '../../../src/config/ConfigManager';
import * as fs from 'node:fs';
import * as path from 'pathe';
import { homedir } from 'node:os';

describe('ConfigManager', () => {
  const testCwd = path.join(process.cwd(), 'test-config-workspace');
  const testProductName = 'test-codemate';
  let configManager: ConfigManager;

  beforeEach(() => {
    // 创建测试目录
    if (!fs.existsSync(testCwd)) {
      fs.mkdirSync(testCwd, { recursive: true });
    }

    configManager = new ConfigManager({
      cwd: testCwd,
      productName: testProductName,
      argvConfig: {},
    });
  });

  afterEach(() => {
    // 清理测试文件
    const globalConfigPath = path.join(homedir(), `.${testProductName}`, 'config.json');
    const projectConfigPath = path.join(testCwd, `.${testProductName}`, 'config.json');

    try {
      if (fs.existsSync(globalConfigPath)) {
        fs.unlinkSync(globalConfigPath);
      }
      if (fs.existsSync(projectConfigPath)) {
        fs.unlinkSync(projectConfigPath);
      }
      if (fs.existsSync(testCwd)) {
        fs.rmSync(testCwd, { recursive: true, force: true });
      }
    } catch (error) {
      // 忽略错误
    }
  });

  /**
   * 测试 1：应该初始化默认配置
   */
  it('should initialize with default config', () => {
    const config = configManager.config;

    expect(config.model).toBe('deepseek-chat');
    expect(config.language).toBe('English');
    expect(config.quiet).toBe(false);
    expect(config.approvalMode).toBe('autoEdit');
    expect(config.sandbox).toEqual({
      mode: 'permissive',
      network: 'deny',
      allowUnsandboxedFallback: true,
    });
  });

  /**
   * 测试 2：应该能设置平面配置
   */
  it('should set flat config', () => {
    configManager.setConfig(false, 'model', 'claude-sonnet-4');

    const config = configManager.config;
    expect(config.model).toBe('claude-sonnet-4');
  });

  /**
   * 测试 3：应该能设置嵌套配置
   */
  it('should set nested config', () => {
    configManager.setConfig(false, 'agent.Explore.model', 'claude-haiku');

    const config = configManager.config;
    expect(config.agent?.Explore?.model).toBe('claude-haiku');
  });

  /**
   * 测试 4：应该能获取配置
   */
  it('should get config', () => {
    configManager.setConfig(false, 'model', 'gpt-4');

    const value = configManager.getConfig(false, 'model');
    expect(value).toBe('gpt-4');
  });

  /**
   * 测试 5：应该能获取嵌套配置
   */
  it('should get nested config', () => {
    configManager.setConfig(false, 'commit.language', 'zh-CN');

    const value = configManager.getConfig(false, 'commit.language');
    expect(value).toBe('zh-CN');
  });

  /**
   * 测试 6：应该能添加数组配置
   */
  it('should add to array config', () => {
    configManager.addConfig(false, 'plugins', ['logger-plugin']);

    const config = configManager.config;
    expect(config.plugins).toContain('logger-plugin');
  });

  /**
   * 测试 7：应该能移除数组配置
   */
  it('should remove from array config', () => {
    configManager.setConfig(false, 'plugins', ['plugin1', 'plugin2']);
    configManager.removeConfig(false, 'plugins', ['plugin1']);

    const config = configManager.config;
    expect(config.plugins).not.toContain('plugin1');
    expect(config.plugins).toContain('plugin2');
  });

  /**
   * 测试 8：配置优先级应该正确
   */
  it('should respect config priority', () => {
    // 设置全局配置
    configManager.setConfig(true, 'model', 'global-model');

    // 设置项目配置
    configManager.setConfig(false, 'model', 'project-model');

    // 项目配置应该覆盖全局配置
    const config = configManager.config;
    expect(config.model).toBe('project-model');
  });

  /**
   * 测试 9：应该深度合并配置
   */
  it('should deep merge config', () => {
    configManager.setConfig(false, 'agent.Explore.model', 'claude-haiku');
    configManager.setConfig(false, 'agent.Plan.model', 'claude-sonnet');

    const config = configManager.config;
    expect(config.agent?.Explore?.model).toBe('claude-haiku');
    expect(config.agent?.Plan?.model).toBe('claude-sonnet');
  });

  /**
   * 测试 10：应该保存和加载配置
   */
  it('should save and load config', () => {
    configManager.setConfig(false, 'model', 'test-model');

    // 创建新的 ConfigManager 实例
    const newConfigManager = new ConfigManager({
      cwd: testCwd,
      productName: testProductName,
      argvConfig: {},
    });

    const config = newConfigManager.config;
    expect(config.model).toBe('test-model');
  });

  it('should prefer project model over a stale global deepseek-chat on restart', () => {
    const globalConfigPath = path.join(homedir(), `.${testProductName}`, 'config.json');
    const projectConfigPath = path.join(testCwd, `.${testProductName}`, 'config.json');

    fs.mkdirSync(path.dirname(globalConfigPath), { recursive: true });
    fs.mkdirSync(path.dirname(projectConfigPath), { recursive: true });

    fs.writeFileSync(globalConfigPath, JSON.stringify({ model: 'deepseek-chat' }), 'utf-8');
    fs.writeFileSync(projectConfigPath, JSON.stringify({ model: 'deepseek-reasoner' }), 'utf-8');

    const restartedConfigManager = new ConfigManager({
      cwd: testCwd,
      productName: testProductName,
      argvConfig: {},
    });

    expect(restartedConfigManager.config.model).toBe('deepseek-reasoner');
    expect(restartedConfigManager.getProjectConfigPath()).toBe(projectConfigPath);
  });
});
