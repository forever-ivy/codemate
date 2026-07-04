import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkspaceCommand } from '../../../src/commands/workspace/WorkspaceCommand';

describe('WorkspaceCommand', () => {
  let workspaceCommand: WorkspaceCommand;
  let mockConfigManager: any;
  let mockSessionService: any;
  let mockApp: any;

  beforeEach(() => {
    mockConfigManager = {
      config: {
        workspace: {
          baseBranch: 'main',
          autoDelete: true,
          parentDir: '..',
          namePrefix: 'test-project',
        },
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

    workspaceCommand = new WorkspaceCommand(mockConfigManager);
  });

  describe('getProjectName', () => {
    it('should return current directory name', () => {
      const name = (workspaceCommand as any).getProjectName();
      expect(name).toBeTruthy();
      expect(typeof name).toBe('string');
    });
  });

  describe('getWorkspacePath', () => {
    it('should generate workspace path with prefix', () => {
      const path = (workspaceCommand as any).getWorkspacePath('feature-a');
      expect(path).toContain('test-project-feature-a');
    });

    it('should use custom parent directory', () => {
      const path = (workspaceCommand as any).getWorkspacePath('feature-a');
      expect(path).toBeTruthy();
    });
  });

  describe('parseWorktreeList', () => {
    it('should parse worktree list output', () => {
      const output = `worktree /path/to/project
HEAD abc1234567890
branch refs/heads/main

worktree /path/to/project-feature-a
HEAD def1234567890
branch refs/heads/feature-a
`;

      const workspaces = (workspaceCommand as any).parseWorktreeList(output);

      expect(workspaces).toHaveLength(2);
      expect(workspaces[0].path).toBe('/path/to/project');
      expect(workspaces[0].branch).toBe('main');
      expect(workspaces[0].commit).toBe('abc1234567890');
      expect(workspaces[1].path).toBe('/path/to/project-feature-a');
      expect(workspaces[1].branch).toBe('feature-a');
    });

    it('should handle detached HEAD', () => {
      const output = `worktree /path/to/project
HEAD abc1234567890
detached
`;

      const workspaces = (workspaceCommand as any).parseWorktreeList(output);

      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].branch).toBeUndefined();
    });
  });

  describe('execute', () => {
    it('should show help in the session when no subcommand is provided', async () => {
      await workspaceCommand.execute([], mockApp);

      expect(mockSessionService.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringContaining(
            'Usage: /workspace <create|list|remove|complete> [options]'
          ),
        })
      );
    });

    it('should show list output in the session', async () => {
      vi.spyOn(workspaceCommand as any, 'execGit').mockReturnValue(`worktree /tmp/project
HEAD abc1234567890
branch refs/heads/main
`);

      await workspaceCommand.execute(['list'], mockApp);

      expect(mockSessionService.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringContaining('📋 Workspaces:'),
        })
      );
    });
  });
});
