import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Application } from '../../src/application/Application';
import type { SlashCommandManager } from '../../src/managers/SlashCommandManager';

describe('MCP Command Integration', () => {
  let app: Application;

  beforeEach(async () => {
    app = new Application();
    await app.initialize();
  });

  afterEach(async () => {
    if (app) {
      await app.cleanup();
    }
  });

  it('should register MCP command', () => {
    const commandManager = app.getContainer().get<SlashCommandManager>('command');
    const command = commandManager.get('mcp');

    expect(command).toBeDefined();
    expect(command?.name).toBe('mcp');
    expect(command?.description).toContain('MCP');
  });

  it('should be listed in available commands', () => {
    const commandManager = app.getContainer().get<SlashCommandManager>('command');
    const commands = commandManager.list();

    expect(commands).toContain('mcp');
  });

  it('should have correct command info', () => {
    const commandManager = app.getContainer().get<SlashCommandManager>('command');
    const allInfo = commandManager.getAllInfo();

    const mcpInfo = allInfo.find((info) => info.name === 'mcp');
    expect(mcpInfo).toBeDefined();
    expect(mcpInfo?.description).toBe('MCP servers management');
    expect(mcpInfo?.aliases).toEqual([]);
  });

  it('should execute without errors', async () => {
    const commandManager = app.getContainer().get<SlashCommandManager>('command');

    // 执行命令不应该抛出错误
    const result = await commandManager.execute('/mcp', app);
    expect(result).toBe(true);
  });
});
