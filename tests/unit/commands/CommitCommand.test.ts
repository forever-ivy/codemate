import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommitCommand } from '../../../src/commands/git/CommitCommand';

describe('CommitCommand', () => {
  let commitCommand: CommitCommand;
  let mockModelService: any;
  let mockConfigManager: any;
  let mockSessionService: any;
  let mockApp: any;

  beforeEach(() => {
    mockModelService = {
      chat: vi.fn(),
    };

    mockConfigManager = {
      config: {
        commit: {
          language: 'en',
        },
        smallModel: 'deepseek-chat',
        model: 'deepseek-chat',
      },
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

    commitCommand = new CommitCommand(mockModelService, mockConfigManager);
  });

  describe('parseOptions', () => {
    it('should parse stage option', () => {
      const options = (commitCommand as any).parseOptions(['-s']);
      expect(options.stage).toBe(true);
    });

    it('should parse commit option', () => {
      const options = (commitCommand as any).parseOptions(['-c']);
      expect(options.commit).toBe(true);
    });

    it('should parse model option', () => {
      const options = (commitCommand as any).parseOptions(['-m', 'gpt-4']);
      expect(options.model).toBe('gpt-4');
    });

    it('should parse multiple options', () => {
      const options = (commitCommand as any).parseOptions(['-s', '-c', '--push']);
      expect(options.stage).toBe(true);
      expect(options.commit).toBe(true);
      expect(options.push).toBe(true);
    });
  });

  describe('getDefaultSystemPrompt', () => {
    it('should return English prompt by default', () => {
      const prompt = (commitCommand as any).getDefaultSystemPrompt('en');
      expect(prompt).toContain('Conventional Commits');
      expect(prompt).toContain('feat:');
    });

    it('should return Chinese prompt for zh language', () => {
      const prompt = (commitCommand as any).getDefaultSystemPrompt('zh');
      expect(prompt).toContain('Conventional Commits');
      expect(prompt).toContain('新功能');
    });
  });

  describe('generateCommitMessage', () => {
    it('should generate commit message from diff', async () => {
      const diff = `
diff --git a/src/auth.ts b/src/auth.ts
+++ b/src/auth.ts
@@ -1,0 +1,5 @@
+export function login() {
+  // implementation
+}
      `;

      mockModelService.chat.mockResolvedValue({
        content: 'feat(auth): implement user login',
      });

      const message = await (commitCommand as any).generateCommitMessage(diff, '', {});

      expect(message).toBe('feat(auth): implement user login');
      expect(mockModelService.chat).toHaveBeenCalled();
    });

    it('should include commit history when followStyle is true', async () => {
      const diff = 'some diff';
      const history = 'feat: add feature\nfix: fix bug';

      mockModelService.chat.mockResolvedValue({
        content: 'feat: new feature',
      });

      await (commitCommand as any).generateCommitMessage(diff, history, { followStyle: true });

      const call = mockModelService.chat.mock.calls[0][0];

      expect(call).toContain(history);
    });
  });

  describe('execute', () => {
    it('should preview the generated commit message in the session by default', async () => {
      vi.spyOn(commitCommand as any, 'getDiff').mockResolvedValue('diff --git a/file b/file');
      vi.spyOn(commitCommand as any, 'generateCommitMessage').mockResolvedValue(
        'feat(core): improve commit flow'
      );
      const executeCommitSpy = vi.spyOn(commitCommand as any, 'executeCommit');

      await commitCommand.execute([], mockApp);

      expect(mockSessionService.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringContaining('📝 Generated commit message:'),
        })
      );
      expect(mockSessionService.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringContaining('/commit --commit'),
        })
      );
      expect(executeCommitSpy).not.toHaveBeenCalled();
    });

    it('should report when there are no staged changes', async () => {
      vi.spyOn(commitCommand as any, 'getDiff').mockResolvedValue('');

      await commitCommand.execute([], mockApp);

      expect(mockSessionService.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          content: '❌ No staged changes to commit. Stage files first or run `/commit --stage`.',
        })
      );
    });
  });
});
