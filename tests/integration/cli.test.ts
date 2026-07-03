import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Application } from '@/application/Application';
import { ConfigService } from '@/services/ConfigService';
import type { ModelConfig } from '@/types/index';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('CLI Integration', () => {
  let app: Application;
  const testFile = path.join(process.cwd(), 'test-integration.txt');
  const testContent = 'Integration test content';

  beforeEach(async () => {
    // 创建测试文件
    await fs.writeFile(testFile, testContent, 'utf-8');

    // 创建 Application（传入 ModelConfig）
    const modelConfig: ModelConfig = {
      apiKey: process.env.DEEPSEEK_API_KEY || 'test-key',
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      temperature: 0.7,
    };

    const configService = new ConfigService({
      cwd: process.cwd(),
      productName: 'aicli',
    });

    app = new Application(modelConfig, configService);

    await app.start();
  });

  afterEach(async () => {
    // 清理测试文件
    try {
      await fs.unlink(testFile);
    } catch {
      // 忽略错误
    }

    await app.stop();
  });

  /**
   * 测试 1：应该能初始化 Application
   */
  it('should initialize application', () => {
    expect(app).toBeDefined();
    expect(app.getContainer()).toBeDefined();
  });

  /**
   * 测试 2：应该能获取服务
   */
  it('should get services', () => {
    const modelService = app.getContainer().get('model');
    const toolManager = app.getContainer().get('tool');

    expect(modelService).toBeDefined();
    expect(toolManager).toBeDefined();
  });

  /**
   * 测试 3：应该能调用工具
   */
  it('should execute tool', async () => {
    const toolManager = app.getContainer().get('tool') as any;

    const result = await toolManager.execute('read_file', {
      path: testFile,
    });

    expect(result.content).toBe(testContent);
  });

  /**
   * 测试 4：应该能调用 AI（需要真实 API Key）
   *
   * 注意：这个测试需要真实的 API Key
   * 如果没有 API Key，测试会被跳过
   */
  it.skipIf(!process.env.DEEPSEEK_API_KEY)('should call AI', async () => {
    const modelService = app.getContainer().get('model') as any;

    const response = await modelService.chat('你好');

    expect(response.content).toBeTruthy();
    expect(response.content.length).toBeGreaterThan(0);
  });

  /**
   * 测试 5：应该能使用工具调用 AI（需要真实 API Key）
   */
  it.skipIf(!process.env.DEEPSEEK_API_KEY)('should call AI with tools', async () => {
    const modelService = app.getContainer().get('model') as any;
    const toolManager = app.getContainer().get('tool') as any;

    const tools = toolManager.list().map((name: string) => toolManager.get(name));
    const response = await modelService.chatWithTools(`请读取文件 ${testFile}`, tools, toolManager);

    expect(response.content).toBeTruthy();
  });
  /**
   * 测试 6：应该能使用 ConfigService
   */
  it('should work with ConfigService', async () => {
    const configService = new ConfigService({
      cwd: process.cwd(),
      productName: 'aicli',
    });

    const app = new Application(undefined, configService);
    await app.start();

    // 验证配置服务已注册
    const config = app.getContainer().get<ConfigService>('config');
    expect(config).toBeDefined();
    expect(config.getConfig()).toBeDefined();

    await app.stop();
  });
});
