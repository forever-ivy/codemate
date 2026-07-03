import { describe, it, expect, beforeEach } from 'vitest';
import { Application } from '../../src/application/Application';
import type { SlashCommandManager } from '../../src/managers/SlashCommandManager';

describe('Commands Integration', () => {
  let app: Application;
  let commandManager: SlashCommandManager;

  beforeEach(() => {
    app = new Application({
      model: 'deepseek-chat',
      apiKey: 'test-key',
      baseURL: 'https://api.deepseek.com',
    });

    commandManager = app.getContainer().get<SlashCommandManager>('command');
  });

  it('should have all commands registered', () => {
    const commands = commandManager.list();

    expect(commands).toContain('help');
    expect(commands).toContain('clear');
    expect(commands).toContain('exit');
    expect(commands).toContain('model');
    expect(commands).toContain('sessions');
  });

  it('should execute help command', async () => {
    const result = await commandManager.execute('/help', app);
    expect(result).toBe(true);
  });

  it('should handle unknown command', async () => {
    const result = await commandManager.execute('/unknown', app);
    expect(result).toBe(false);
  });

  it('should handle non-command input', async () => {
    const result = await commandManager.execute('hello', app);
    expect(result).toBe(false);
  });
});
