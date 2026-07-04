import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnhancedHelpCommand } from '../../../src/commands/session/EnhancedHelpCommand.js';
import type { Application } from '../../../src/application/Application.js';
import type { Container } from '../../../src/application/Container.js';
import type { SlashCommandManager } from '../../../src/managers/SlashCommandManager.js';
import type { SessionService } from '../../../src/services/SessionService.js';

describe('EnhancedHelpCommand', () => {
  let command: EnhancedHelpCommand;
  let mockApp: Application;
  let mockContainer: Container;
  let mockCommandManager: SlashCommandManager;
  let mockSessionService: SessionService;

  beforeEach(() => {
    command = new EnhancedHelpCommand();

    // Mock SessionService
    mockSessionService = {
      addMessage: vi.fn(),
    } as any;

    // Mock SlashCommandManager
    mockCommandManager = {
      get: vi.fn(),
      getAllInfo: vi.fn().mockReturnValue([
        { name: 'help', description: 'Show help', aliases: ['h'] },
        { name: 'clear', description: 'Clear screen', aliases: [] },
        { name: 'exit', description: 'Exit app', aliases: ['quit'] },
      ]),
    } as any;

    // Mock Container
    mockContainer = {
      get: vi.fn((key: string) => {
        if (key === 'command') return mockCommandManager;
        if (key === 'session') return mockSessionService;
        return null;
      }),
    } as any;

    // Mock Application
    mockApp = {
      getContainer: () => mockContainer,
    } as any;
  });

  it('should have correct basic properties', () => {
    expect(command.name).toBe('help');
    expect(command.description).toBe('Show available slash commands');
    expect(command.aliases).toEqual(['h', '?']);
  });

  it('should show all commands when no args provided', async () => {
    await command.execute([], mockApp);

    expect(mockSessionService.addMessage).toHaveBeenCalledWith({
      role: 'assistant',
      content: expect.stringContaining('Available slash commands:'),
    });
    expect(mockSessionService.addMessage).toHaveBeenCalledWith({
      role: 'assistant',
      content: expect.stringContaining('Total: 3 commands available'),
    });
  });

  it('should show specific command help when command name provided', async () => {
    const mockCommand = { name: 'help', description: 'Show help', aliases: ['h'] };
    (mockCommandManager.get as any).mockReturnValue(mockCommand);

    await command.execute(['help'], mockApp);

    expect(mockCommandManager.get).toHaveBeenCalledWith('help');
    expect(mockSessionService.addMessage).toHaveBeenCalledWith({
      role: 'assistant',
      content: expect.stringContaining('📖 Help for /help:'),
    });
  });

  it('should show error for unknown command', async () => {
    (mockCommandManager.get as any).mockReturnValue(null);

    await command.execute(['unknown'], mockApp);

    expect(mockSessionService.addMessage).toHaveBeenCalledWith({
      role: 'assistant',
      content: '❌ Unknown command: /unknown',
    });
  });

  it('should handle empty command list', async () => {
    (mockCommandManager.getAllInfo as any).mockReturnValue([]);

    await command.execute([], mockApp);

    expect(mockSessionService.addMessage).toHaveBeenCalledWith({
      role: 'assistant',
      content: 'No commands available.',
    });
  });

  it('should categorize commands correctly', async () => {
    (mockCommandManager.getAllInfo as any).mockReturnValue([
      { name: 'help', description: 'Show help', aliases: [] },
      { name: 'sessions', description: 'List sessions', aliases: [] },
      { name: 'model', description: 'Manage models', aliases: [] },
      { name: 'workspace', description: 'Manage workspace', aliases: [] },
    ]);

    await command.execute([], mockApp);

    const callArg = (mockSessionService.addMessage as any).mock.calls[0][0];
    expect(callArg.content).toContain('📦 Basic Commands:');
    expect(callArg.content).toContain('💬 Session Management:');
    expect(callArg.content).toContain('🤖 Model Management:');
    expect(callArg.content).toContain('📁 Workspace:');
  });

  it('should show command aliases in output', async () => {
    (mockCommandManager.getAllInfo as any).mockReturnValue([
      { name: 'help', description: 'Show help', aliases: ['h', '?'] },
    ]);

    await command.execute([], mockApp);

    const callArg = (mockSessionService.addMessage as any).mock.calls[0][0];
    expect(callArg.content).toContain('/help (h, ?) - Show help');
  });

  it('should show aliases in specific command help', async () => {
    const mockCommand = { name: 'help', description: 'Show help', aliases: ['h', '?'] };
    (mockCommandManager.get as any).mockReturnValue(mockCommand);

    await command.execute(['help'], mockApp);

    const callArg = (mockSessionService.addMessage as any).mock.calls[0][0];
    expect(callArg.content).toContain('Aliases: /h, /?');
  });
});
