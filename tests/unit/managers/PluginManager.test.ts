import { beforeEach, describe, expect, it } from 'vitest';
import { Application } from '../../../src/application/Application';
import { PluginManager } from '../../../src/managers/PluginManager';
import { Plugin } from '../../../src/plugins/base/Plugin';
import type { Tool } from '../../../src/tools/base/Tool';

// 测试插件
class TestPlugin extends Plugin {
  name = 'test';
  version = '1.0.0';

  loadCalled = false;
  unloadCalled = false;
  beforeCalled = false;
  afterCalled = false;

  async onLoad(_app: Application): Promise<void> {
    this.loadCalled = true;
  }

  async onUnload(_app: Application): Promise<void> {
    this.unloadCalled = true;
  }

  async onToolBefore(_tool: Tool, _input: unknown): Promise<void> {
    this.beforeCalled = true;
  }

  async onToolAfter(_tool: Tool, _result: unknown): Promise<void> {
    this.afterCalled = true;
  }
}

class FailingPlugin extends Plugin {
  name = 'failing';
  version = '1.0.0';

  async onLoad(_app: Application): Promise<void> {
    throw new Error('load failed');
  }
}

describe('PluginManager', () => {
  let app: Application;
  let manager: PluginManager;

  beforeEach(() => {
    app = new Application({
      model: 'deepseek-chat',
      apiKey: 'test-key',
      baseURL: 'https://api.deepseek.com',
    });
    manager = new PluginManager(app);
  });

  it('should load plugin', async () => {
    const plugin = new TestPlugin();
    await manager.load(plugin);

    expect(manager.has('test')).toBe(true);
    expect(manager.count()).toBe(1);
    expect(plugin.loadCalled).toBe(true);
  });

  it('should record lifecycle status when loading and unloading plugin', async () => {
    const plugin = new TestPlugin();

    await manager.load(plugin);

    expect(manager.getLifecycleRecord('test')).toMatchObject({
      name: 'test',
      version: '1.0.0',
      status: 'loaded',
      source: 'runtime',
    });
    expect(manager.getLifecycleRecord('test')?.loadedAt).toBeGreaterThan(0);

    await manager.unload('test');

    expect(manager.getLifecycleRecord('test')).toMatchObject({
      name: 'test',
      version: '1.0.0',
      status: 'unloaded',
      source: 'runtime',
    });
    expect(manager.getLifecycleRecord('test')?.unloadedAt).toBeGreaterThan(0);
  });

  it('should record failed plugin loads', async () => {
    await expect(manager.load(new FailingPlugin())).rejects.toThrow('load failed');

    expect(manager.has('failing')).toBe(false);
    expect(manager.getLifecycleRecord('failing')).toMatchObject({
      name: 'failing',
      version: '1.0.0',
      status: 'failed',
      source: 'runtime',
      error: 'load failed',
    });
  });

  it('should load built-in plugins from project configuration', async () => {
    const summary = await manager.loadFromConfig(['logger', 'performance']);

    expect(summary).toEqual({
      loaded: ['logger', 'performance'],
      failed: [],
      notFound: [],
    });
    expect(manager.has('logger')).toBe(true);
    expect(manager.has('performance')).toBe(true);
    expect(manager.getLifecycleRecord('logger')).toMatchObject({
      name: 'logger',
      status: 'loaded',
      source: 'builtin',
    });
  });

  it('should record unknown configured plugins without failing startup', async () => {
    const summary = await manager.loadFromConfig(['missing-plugin']);

    expect(summary).toEqual({
      loaded: [],
      failed: [],
      notFound: ['missing-plugin'],
    });
    expect(manager.getLifecycleRecord('missing-plugin')).toMatchObject({
      name: 'missing-plugin',
      status: 'not_found',
      source: 'config',
      error: 'Plugin is not registered',
    });
  });

  it('should unload plugin', async () => {
    const plugin = new TestPlugin();
    await manager.load(plugin);
    await manager.unload('test');

    expect(manager.has('test')).toBe(false);
    expect(manager.count()).toBe(0);
    expect(plugin.unloadCalled).toBe(true);
  });

  it('should list plugins', async () => {
    const plugin = new TestPlugin();
    await manager.load(plugin);

    const plugins = manager.list();
    expect(plugins).toContain('test');
    expect(plugins.length).toBe(1);
  });

  it('should throw error for duplicate plugin', async () => {
    const plugin1 = new TestPlugin();
    const plugin2 = new TestPlugin();

    await manager.load(plugin1);

    await expect(manager.load(plugin2)).rejects.toThrow('Plugin already loaded: test');
  });

  it('should trigger tool hooks', async () => {
    const plugin = new TestPlugin();
    await manager.load(plugin);

    const mockTool = { name: 'mock-tool' } as Tool;
    const mockInput = { test: 'input' };
    const mockResult = { test: 'result' };

    await manager.triggerToolBefore(mockTool, mockInput);
    expect(plugin.beforeCalled).toBe(true);

    await manager.triggerToolAfter(mockTool, mockResult);
    expect(plugin.afterCalled).toBe(true);
  });
});
