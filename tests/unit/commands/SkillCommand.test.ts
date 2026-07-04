import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillCommand } from '../../../src/commands/skill/SkillCommand';

describe('SkillCommand', () => {
  let skillCommand: SkillCommand;
  let mockSkillManager: any;
  let mockSessionService: any;
  let mockApp: any;

  beforeEach(() => {
    mockSkillManager = {
      addSkill: vi.fn().mockResolvedValue(undefined),
      removeSkill: vi.fn().mockResolvedValue(undefined),
      listSkills: vi.fn().mockReturnValue([]),
    };

    mockSessionService = {
      addMessage: vi.fn().mockResolvedValue(undefined),
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

    skillCommand = new SkillCommand(mockSkillManager);
  });

  it('should show help in the session when no subcommand is provided', async () => {
    await skillCommand.execute([], mockApp);

    expect(mockSessionService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('Usage: /skill <subcommand> [options]'),
      })
    );
  });

  it('should list skills in the session', async () => {
    mockSkillManager.listSkills.mockReturnValue([
      {
        name: 'review',
        description: 'Review code changes',
        source: 'global',
      },
    ]);

    await skillCommand.execute(['list'], mockApp);

    expect(mockSessionService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('Available Skills:'),
      })
    );
    expect(mockSessionService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('/review'),
      })
    );
  });

  it('should show installation feedback in the session', async () => {
    await skillCommand.execute(['add', 'user/repo'], mockApp);

    expect(mockSkillManager.addSkill).toHaveBeenCalledWith('user/repo', {});
    expect(mockSessionService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('✅ Skill installed:'),
      })
    );
  });
});
