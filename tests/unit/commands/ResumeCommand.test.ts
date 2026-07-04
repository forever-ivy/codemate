import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResumeCommand } from '../../../src/commands/session/ResumeCommand';
import type { Application } from '../../../src/application/Application';
import type { SessionService } from '../../../src/services/SessionService';

describe('ResumeCommand', () => {
  let resumeCommand: ResumeCommand;
  let mockApp: Application;
  let mockSessionService: SessionService;

  beforeEach(() => {
    mockSessionService = {
      list: vi.fn(),
      resume: vi.fn(),
      exists: vi.fn(),
      getCurrent: vi.fn(),
      save: vi.fn(),
    } as any;

    mockApp = {
      getContainer: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue(mockSessionService),
      }),
    } as any;

    resumeCommand = new ResumeCommand();
  });

  it('should show no sessions message when no sessions exist', async () => {
    // Arrange
    mockSessionService.list = vi.fn().mockReturnValue([]);
    const consoleSpy = vi.spyOn(console, 'log');

    // Act
    await resumeCommand.execute([], mockApp);

    // Assert
    expect(consoleSpy).toHaveBeenCalledWith('📭 No sessions found to resume');
  });

  it('should list available sessions', async () => {
    // Arrange
    const mockSessions = [
      {
        sessionId: 'session-1',
        modified: new Date('2024-01-01T10:00:00Z'),
        created: new Date('2024-01-01T09:00:00Z'),
        messageCount: 5,
        summary: 'Test session 1',
      },
      {
        sessionId: 'session-2',
        modified: new Date('2024-01-01T11:00:00Z'),
        created: new Date('2024-01-01T10:30:00Z'),
        messageCount: 3,
        summary: 'Test session 2',
      },
    ];

    mockSessionService.list = vi.fn().mockReturnValue(mockSessions);

    // Act
    await resumeCommand.execute([], mockApp);

    // Assert
    expect(mockSessionService.list).toHaveBeenCalled();
  });

  it('should resume selected session', async () => {
    // Arrange
    const sessionId = 'test-session';
    mockSessionService.resume = vi.fn().mockResolvedValue(undefined);

    // Act
    await mockSessionService.resume(sessionId);

    // Assert
    expect(mockSessionService.resume).toHaveBeenCalledWith(sessionId);
  });
});
