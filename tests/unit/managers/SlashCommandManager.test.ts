import { describe, it, expect, beforeEach } from 'vitest';
import { SlashCommandManager } from '../../../src/managers/SlashCommandManager';
import { SlashCommand } from '../../../src/commands/base/SlashCommand';
import type { Application } from '../../../src/application/Application';

// 测试命令
class TestCommand extends SlashCommand {
  name = 'test';
  description = 'Test command';
  aliases = ['t'];

  async execute(_args: string[], _app: Application): Promise<void> {
    console.log('Test command executed');
  }
}

describe('SlashCommandManager', () => {
  let manager: SlashCommandManager;

  beforeEach(() => {
    manager = new SlashCommandManager();
  });

  it('should register command', () => {
    const command = new TestCommand();
    manager.register(command);

    expect(manager.has('test')).toBe(true);
    expect(manager.count()).toBe(1);
  });

  it('should register aliases', () => {
    const command = new TestCommand();
    manager.register(command);

    expect(manager.has('t')).toBe(true);
    expect(manager.get('t')).toBe(command);
  });

  it('should detect command input', () => {
    expect(manager.isCommand('/help')).toBe(true);
    expect(manager.isCommand('help')).toBe(false);
    expect(manager.isCommand('  /help')).toBe(true);
  });

  it('should list all commands', () => {
    manager.register(new TestCommand());
    const commands = manager.list();

    expect(commands).toContain('test');
    expect(commands.length).toBe(1);
  });

  it('should throw error for duplicate command', () => {
    manager.register(new TestCommand());

    expect(() => {
      manager.register(new TestCommand());
    }).toThrow('Command already registered: test');
  });
});
