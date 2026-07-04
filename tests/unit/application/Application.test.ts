import { describe, it, expect } from 'vitest';
import { Application } from '@/application/Application';

/**
 * Application 的测试
 */ describe('Application', () => {
  /**
   * 测试：应该能正常初始化
   */
  it('should initialize', () => {
    const app = new Application();

    // 应该创建成功
    expect(app).toBeDefined();

    // 应该有容器
    expect(app.getContainer()).toBeDefined();
  });

  /**
   * 测试：应该能启动和停止
   */
  it('should start and stop', async () => {
    const app = new Application();

    // 启动不应该抛出错误
    await expect(app.start()).resolves.toBeUndefined();

    // 停止不应该抛出错误
    await expect(app.stop()).resolves.toBeUndefined();
  });

  /**
   * 测试：容器应该有注册的服务
   *
   * 第 0 篇：容器是空的
   * 第 1 篇：添加了 ModelService（需要配置）
   * 第 2 篇：添加了 ToolManager（总是注册）
   */
  it('should have registered services', () => {
    const app = new Application();
    const container = app.getContainer();

    // 第 2 篇：应该至少有 ToolManager
    const services = container.list();
    expect(services).toContain('tool');
  });
});
