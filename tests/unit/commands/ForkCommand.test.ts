import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForkCommand } from '../../../src/commands/session/ForkCommand';

describe('ForkCommand', () => {
  let forkCommand: ForkCommand;
  let mockSessionService: any;
  let mockApp: any;

  beforeEach(() => {
    mockSessionService = {
      addMessage: vi.fn().mockResolvedValue(undefined),
      getCurrent: vi.fn().mockReturnValue({
        id: 'session-1',
        messages: [
          {
            uuid: 'message-uuid-1',
            role: 'user',
            content: 'First message content',
          },
        ],
      }),
      fork: vi.fn().mockResolvedValue({ id: 'session-2' }),
    };

    mockApp = {
      getContainer: vi.fn().mockReturnValue({
        get: vi.fn((serviceName: string) => {
          if (serviceName === 'session') {
            return mockSessionService;
          }
          return undefined;
        }),
      }),
    };

    forkCommand = new ForkCommand();
  });

  it('should show fork selector info in session when no uuid is provided', async () => {
    await forkCommand.execute([], mockApp);

    expect(mockSessionService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('📋 Select a message to fork from:'),
      })
    );
  });

  it('should fork from a message uuid and report the new session in session output', async () => {
    await forkCommand.execute(['message-uuid-1'], mockApp);

    expect(mockSessionService.fork).toHaveBeenCalledWith({
      fromMessageUuid: 'message-uuid-1',
    });
    expect(mockSessionService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('✅ Session forked: session-2'),
      })
    );
  });
});
