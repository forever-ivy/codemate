import { SlashCommand } from '../base/SlashCommand';
import type { Application } from '../../application/Application';
import type { ConfigManager } from '../../config/ConfigManager';
import type { SessionService } from '../../services/SessionService';
import type { WorkspaceCreateOptions, WorkspaceInfo } from '../../types/index';
import { execSync } from 'node:child_process';
import { basename, join, resolve } from 'pathe';
import { existsSync } from 'node:fs';

/**
 * WorkspaceCommand - 工作区管理命令
 *
 * 基于 Git worktree 实现多工作区管理
 */
export class WorkspaceCommand extends SlashCommand {
  name = 'workspace';
  description = 'Manage Git worktrees';
  usage = '/workspace <create|list|remove|complete> [options]';

  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    super();
    this.configManager = configManager;
  }

  async execute(args: string[], app: Application): Promise<void> {
    const subcommand = args[0];
    const sessionService = app.getContainer().get<SessionService>('session');

    try {
      switch (subcommand) {
        case 'create':
          await this.create(this.parseCreateOptions(args.slice(1)), sessionService);
          break;
        case 'list':
          await this.list(sessionService);
          break;
        case 'remove':
        case 'delete':
          await this.remove(args[1], sessionService);
          break;
        case 'complete':
          await this.complete(sessionService);
          break;
        default:
          await this.output(
            sessionService,
            [
              'Usage: /workspace <create|list|remove|complete> [options]',
              '',
              'Commands:',
              '  create [--name <name>] [-b <branch>]  Create a new workspace',
              '  list                                   List all workspaces',
              '  remove <name>                          Remove a workspace',
              '  complete                               Complete and merge current workspace',
            ].join('\n')
          );
      }
    } catch (error) {
      await this.output(
        sessionService,
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 解析创建选项
   */
  private parseCreateOptions(args: string[]): WorkspaceCreateOptions {
    const options: WorkspaceCreateOptions = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '--name':
          options.name = args[++i];
          break;
        case '-b':
        case '--branch':
          options.baseBranch = args[++i];
          break;
        case '--new':
          options.newBranch = true;
          break;
      }
    }

    return options;
  }

  /**
   * 创建工作区
   */
  private async create(
    options: WorkspaceCreateOptions,
    sessionService?: SessionService
  ): Promise<void> {
    // 1. 获取工作区名称
    const workspaceName = options.name;
    if (!workspaceName) {
      await this.output(
        sessionService,
        [
          '❌ Workspace name is required',
          'Usage: /workspace create --name <workspace-name> [-b <branch>]',
          '',
          'Example:',
          '  /workspace create --name feature-auth',
          '  /workspace create --name bugfix-login -b develop',
        ].join('\n')
      );
      return;
    }

    // 2. 获取基础分支
    const config = this.configManager.config;
    const baseBranch = options.baseBranch || config.workspace?.baseBranch || 'main';

    // 3. 验证基础分支是否存在
    if (!this.branchExists(baseBranch)) {
      let message = `❌ Base branch '${baseBranch}' does not exist\nAvailable branches:`;
      try {
        const branches = this.execGit('branch -a')
          .split('\n')
          .map((line) =>
            line
              .trim()
              .replace(/^\*\s*/, '')
              .replace(/^remotes\/origin\//, '')
          )
          .filter((line) => line && !line.includes('HEAD'))
          .slice(0, 5); // 只显示前5个分支
        message += `\n${branches.map((branch) => `  - ${branch}`).join('\n')}`;
      } catch {
        message += '\n  (Unable to list branches)';
      }
      await this.output(sessionService, message);
      return;
    }

    // 4. 生成工作区路径
    const workspacePath = this.getWorkspacePath(workspaceName);

    // 5. 检查工作区是否已存在
    if (existsSync(workspacePath)) {
      await this.output(sessionService, `❌ Workspace already exists: ${workspacePath}`);
      return;
    }

    // 6. 检查分支是否存在
    const branchExists = this.branchExists(workspaceName);

    await this.output(sessionService, `🌿 Creating workspace '${workspaceName}'...`);

    // 7. 创建工作区
    try {
      if (branchExists && !options.newBranch) {
        // 基于现有分支创建
        this.execGit(`worktree add ${workspacePath} ${workspaceName}`);
      } else {
        // 创建新分支并创建工作区
        this.execGit(`worktree add -b ${workspaceName} ${workspacePath} ${baseBranch}`);
      }

      await this.output(
        sessionService,
        `✅ Workspace created at: ${workspacePath}\n💡 To start working: cd ${workspacePath}`
      );
    } catch (error) {
      await this.output(sessionService, '❌ Failed to create workspace');
      throw error;
    }
  }

  /**
   * 列出所有工作区
   */
  private async list(sessionService?: SessionService): Promise<void> {
    try {
      const output = this.execGit('worktree list --porcelain');
      const workspaces = this.parseWorktreeList(output);

      if (workspaces.length === 0) {
        await this.output(sessionService, '📋 No workspaces found');
        return;
      }

      const lines = ['📋 Workspaces:', ''];

      for (const workspace of workspaces) {
        const marker = workspace.isCurrent ? '→' : ' ';
        const name = basename(workspace.path);
        lines.push(`${marker} ${name}`);
        lines.push(`  Path:   ${workspace.path}`);
        lines.push(`  Branch: ${workspace.branch}`);
        lines.push(`  Commit: ${workspace.commit.substring(0, 7)}`);
        lines.push('');
      }

      await this.output(sessionService, lines.join('\n').trimEnd());
    } catch (error) {
      await this.output(sessionService, '❌ Failed to list workspaces');
      throw error;
    }
  }

  /**
   * 删除工作区
   */
  private async remove(name: string, sessionService?: SessionService): Promise<void> {
    if (!name) {
      await this.output(
        sessionService,
        '❌ Workspace name is required\nUsage: /workspace remove <name>'
      );
      return;
    }

    const workspacePath = this.getWorkspacePath(name);

    // 检查工作区是否存在
    if (!existsSync(workspacePath)) {
      await this.output(sessionService, `❌ Workspace not found: ${workspacePath}`);
      return;
    }

    await this.output(sessionService, `🗑️  Removing workspace '${name}'...`);

    try {
      this.execGit(`worktree remove ${workspacePath}`);
      await this.output(sessionService, `✅ Workspace removed: ${workspacePath}`);
    } catch (error) {
      await this.output(sessionService, '❌ Failed to remove workspace');
      throw error;
    }
  }

  /**
   * 完成并合并工作区
   */
  private async complete(sessionService?: SessionService): Promise<void> {
    // 1. 获取当前分支
    const currentBranch = this.getCurrentBranch();

    if (!currentBranch) {
      await this.output(sessionService, '❌ Not in a Git repository');
      return;
    }

    // 2. 获取配置
    const config = this.configManager.config;
    const baseBranch = config.workspace?.baseBranch || 'main';
    const autoDelete = config.workspace?.autoDelete !== false;

    // 3. 检查是否有未提交的更改
    try {
      this.execGit('diff-index --quiet HEAD --');
    } catch {
      await this.output(
        sessionService,
        '❌ You have uncommitted changes. Please commit or stash them first.'
      );
      return;
    }

    await this.output(sessionService, `🔀 Merging ${currentBranch} into ${baseBranch}...`);

    try {
      // 4. 切换到基础分支
      this.execGit(`checkout ${baseBranch}`);

      // 5. 合并当前分支
      this.execGit(`merge ${currentBranch}`);

      await this.output(sessionService, `✅ Merged ${currentBranch} into ${baseBranch}`);

      // 6. 删除工作区
      const workspacePath = process.cwd();
      await this.output(sessionService, '🗑️  Removing workspace...');

      // 切换到父目录
      process.chdir('..');

      // 删除工作区
      this.execGit(`worktree remove ${workspacePath}`);

      // 7. 删除分支（如果配置了自动删除）
      if (autoDelete) {
        await this.output(sessionService, `🗑️  Deleting branch ${currentBranch}...`);
        this.execGit(`branch -d ${currentBranch}`);
      }

      await this.output(sessionService, '✅ Workspace completed and merged!');
    } catch (error) {
      await this.output(sessionService, '❌ Failed to complete workspace');
      throw error;
    }
  }

  private async output(sessionService: SessionService | undefined, message: string): Promise<void> {
    if (sessionService) {
      await sessionService.addMessage({
        role: 'assistant',
        content: message,
      });
      return;
    }

    console.log(message);
  }

  /**
   * 获取项目名称
   */
  private getProjectName(): string {
    const cwd = process.cwd();
    return basename(cwd);
  }

  /**
   * 获取工作区路径
   */
  private getWorkspacePath(name: string): string {
    const config = this.configManager.config;
    const parentDir = config.workspace?.parentDir || '..';
    const prefix = config.workspace?.namePrefix || this.getProjectName();

    const workspaceName = `${prefix}-${name}`;
    return resolve(join(parentDir, workspaceName));
  }

  /**
   * 获取当前分支
   */
  private getCurrentBranch(): string {
    try {
      return this.execGit('branch --show-current').trim();
    } catch {
      return '';
    }
  }

  /**
   * 检查分支是否存在
   */
  private branchExists(branch: string): boolean {
    try {
      this.execGit(`rev-parse --verify ${branch}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 解析 worktree list 输出
   */
  private parseWorktreeList(output: string): WorkspaceInfo[] {
    const workspaces: WorkspaceInfo[] = [];
    const lines = output.split('\n');

    let current: Partial<WorkspaceInfo> = {};

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        if (current.path) {
          workspaces.push(current as WorkspaceInfo);
        }
        current = {
          path: line.substring('worktree '.length),
          isCurrent: false,
        };
      } else if (line.startsWith('HEAD ')) {
        current.commit = line.substring('HEAD '.length);
      } else if (line.startsWith('branch ')) {
        current.branch = line.substring('branch '.length).replace('refs/heads/', '');
      } else if (line === '') {
        if (current.path) {
          workspaces.push(current as WorkspaceInfo);
          current = {};
        }
      }
    }

    // 添加最后一个工作区
    if (current.path) {
      workspaces.push(current as WorkspaceInfo);
    }

    // 标记当前工作区
    const cwd = process.cwd();
    for (const workspace of workspaces) {
      if (workspace.path === cwd) {
        workspace.isCurrent = true;
      }
    }

    return workspaces;
  }

  /**
   * 执行 Git 命令
   */
  private execGit(command: string): string {
    try {
      return execSync(`git ${command}`, { encoding: 'utf-8' });
    } catch (error) {
      throw new Error(`Git command failed: ${command}`);
    }
  }
}
