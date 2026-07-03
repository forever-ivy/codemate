import { describe, it, expect, beforeEach } from 'vitest';
import { Application } from '../../src/application/Application';
import { LoggerPlugin } from '../../src/plugins/builtin/LoggerPlugin';
import { PerformancePlugin } from '../../src/plugins/builtin/PerformancePlugin';
import { SecurityPlugin } from '../../src/plugins/builtin/SecurityPlugin';
import type { PluginManager } from '../../src/managers/PluginManager';

describe('Plugins Integration', () => {
  let app: Application;
  let pluginManager: PluginManager;

  beforeEach(() => {
    app = new Application({
      model: 'deepseek-chat',
      apiKey: 'test-key',
      baseURL: 'https://api.deepseek.com',
    });

    pluginManager = app.getPluginManager()!;
  });

  it('should load logger plugin', async () => {
    await pluginManager.load(new LoggerPlugin());

    expect(pluginManager.has('logger')).toBe(true);
  });

  it('should load performance plugin', async () => {
    await pluginManager.load(new PerformancePlugin());

    expect(pluginManager.has('performance')).toBe(true);
  });

  it('should load security plugin', async () => {
    await pluginManager.load(new SecurityPlugin());

    expect(pluginManager.has('security')).toBe(true);
  });

  it('should load multiple plugins', async () => {
    await pluginManager.load(new LoggerPlugin());
    await pluginManager.load(new PerformancePlugin());
    await pluginManager.load(new SecurityPlugin());

    expect(pluginManager.count()).toBe(3);
  });

  it('should unload all plugins', async () => {
    await pluginManager.load(new LoggerPlugin());
    await pluginManager.load(new PerformancePlugin());

    await pluginManager.unloadAll();

    expect(pluginManager.count()).toBe(0);
  });
});
