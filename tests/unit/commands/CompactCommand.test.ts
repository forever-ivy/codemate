import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompactCommand } from '../../../src/commands/session/CompactCommand';
import type { Application } from '../../../src/application/Application';
import type { Container } from '../../../src/application/Container';
import type { SessionService } from '../../../src/services/SessionService';
import type { ModelService } from '../../../src/services/ModelService';

describe('CompactCommand', () => {
  let command: CompactCommand;
  let mockApp: Application;
  let mockContainer: Container;
  let mockSessionService: SessionService;
  let mockModelService: ModelService;

  beforeEach(() => {
    command = new CompactCommand();

    // Mock SessionService
    mockSessionService = {
      getMessages: vi.fn(),
      clearMessages: vi.fn(),
      addMessage: vi.fn(),
    } as any;

    // Mock ModelService
    mockModelService = {
      chatWithMessages: vi.fn(),
    } as any;

    // Mock Container
    mockContainer = {
      get: vi.fn((service: string) => {
        if (service === 'session') return mockSessionService;
        if (service === 'model') return mockModelService;
        return null;
      }),
    } as any;

    // Mock Application
    mockApp = {
      getContainer: vi.fn(() => mockContainer),
    } as any;
  });

  it('should have correct metadata', () => {
    expect(command.name).toBe('compact');
    expect(command.description).toBe('Compress session history to reduce token usage');
    expect(command.aliases).toEqual([]);
  });

  it('should handle empty session', async () => {
    vi.mocked(mockSessionService.getMessages).mockReturnValue([]);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await command.execute([], mockApp);

    expect(consoleSpy).toHaveBeenCalledWith('⚠️  No messages to compact');
    consoleSpy.mockRestore();
  });

  it('should compact session history successfully', async () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
      { role: 'assistant', content: 'I am doing well, thank you!' },
    ];

    vi.mocked(mockSessionService.getMessages).mockReturnValue(messages);
    vi.mocked(mockModelService.chatWithMessages).mockResolvedValue({
      role: 'assistant',
      content: 'Summary: User greeted and asked about wellbeing. Assistant responded positively.',
    });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await command.execute([], mockApp);

    expect(mockSessionService.clearMessages).toHaveBeenCalled();
    expect(mockSessionService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'user',
        content: expect.stringContaining('Previous conversation summary'),
      })
    );
    expect(consoleSpy).toHaveBeenCalledWith('✅ Session history compacted successfully');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Original tokens:'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Compacted tokens:'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Reduction:'));

    consoleSpy.mockRestore();
  });

  it('should handle compaction errors', async () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ];

    vi.mocked(mockSessionService.getMessages).mockReturnValue(messages);
    vi.mocked(mockModelService.chatWithMessages).mockRejectedValue(new Error('API error'));

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await command.execute([], mockApp);

    expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to compact session history');
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
