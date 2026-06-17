import { SlashCommand } from '../base/SlashCommand';
import type { Application } from '../../application/Application';
import type { ModelService } from '../../services/ModelService';
import type { ConfigManager } from '../../config/ConfigManager';
import type { SessionService } from '../../services/SessionService';
import type { CommitOptions } from '../../types/index';
import { execSync } from 'node:child_process';
import clipboard from 'clipboardy';

/**
 * CommitCommand - 智能提交命令
 *
 * 使用 AI 分析 Git diff 并生成提交信息
 */
export class CommitCommand extends SlashCommand {
  name = 'commit';
  description = 'Generate commit message using AI';
  usage = '/commit [options]';

  private modelService: ModelService;
  private configManager: ConfigManager;

  constructor(modelService: ModelService, configManager: ConfigManager) {
    super();
    this.modelService = modelService;
    this.configManager = configManager;
  }

  async execute(args: string[], app: Application): Promise<void> {
    // 解析选项
    const options = this.parseOptions(args);
    const sessionService = app.getContainer().get<SessionService>('session');

    try {
      // 1. 自动 stage（如果指定）
      if (options.stage) {
        await this.output(sessionService, '📦 Staging all changes...');
        this.execCommand('git add -A');
      }

      // 2. 读取 Git diff
      await this.output(sessionService, '🔍 Analyzing changes...');
      const diff = await this.getDiff(true);

      if (!diff || diff.trim().length === 0) {
        await this.output(
          sessionService,
          '❌ No staged changes to commit. Stage files first or run `/commit --stage`.'
        );
        return;
      }

      // 3. 读取提交历史（如果需要学习风格）
      let commitHistory = '';
      if (options.followStyle) {
        await this.output(sessionService, '📚 Learning commit style from history...');
        const history = await this.getCommitHistory(50);
        commitHistory = history.join('\n');
      }

      // 4. 生成提交信息
      await this.output(sessionService, '🤖 Generating commit message...');
      const commitMessage = await this.generateCommitMessage(diff, commitHistory, options);

      // 5. 复制到剪贴板（如果指定）
      if (options.copy) {
        await this.copyToClipboard(commitMessage);
        await this.output(
          sessionService,
          `📋 Commit message copied to clipboard\n\n${commitMessage}`
        );
        return;
      }

      // 6. 默认只预览提交信息，避免在 Ink UI 中卡在隐藏的 stdin 确认流程
      if (!options.commit) {
        await this.output(
          sessionService,
          `📝 Generated commit message:\n\n${commitMessage}\n\nUse \`/commit --commit\` to create the commit, or \`/commit --copy\` to copy the message.`
        );
        return;
      }

      await this.output(
        sessionService,
        `📝 Generated commit message:\n\n${commitMessage}\n\n🚀 Creating commit...`
      );

      // 7. 执行提交
      await this.executeCommit(commitMessage, options);

      await this.output(sessionService, '✅ Commit successful');

      // 8. 推送（如果指定）
      if (options.push) {
        await this.output(sessionService, '📤 Pushing to remote...');
        this.execCommand('git push');
        await this.output(sessionService, '✅ Push successful');
      }
    } catch (error) {
      await this.output(
        sessionService,
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`
      );
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
   * 解析命令选项
   */
  private parseOptions(args: string[]): CommitOptions {
    const options: CommitOptions = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '-s':
        case '--stage':
          options.stage = true;
          break;
        case '-c':
        case '--commit':
          options.commit = true;
          break;
        case '-n':
        case '--no-verify':
          options.noVerify = true;
          break;
        case '--copy':
          options.copy = true;
          break;
        case '--push':
          options.push = true;
          break;
        case '--checkout':
          options.checkout = true;
          break;
        case '--follow-style':
          options.followStyle = true;
          break;
        case '-m':
        case '--model':
          options.model = args[++i];
          break;
      }
    }

    return options;
  }

  /**
   * 读取 Git diff
   */
  private async getDiff(staged: boolean): Promise<string> {
    try {
      const command = staged ? 'git diff --cached' : 'git diff';
      return this.execCommand(command);
    } catch (error) {
      return '';
    }
  }

  /**
   * 读取提交历史
   */
  private async getCommitHistory(count: number): Promise<string[]> {
    try {
      const output = this.execCommand(`git log -${count} --pretty=format:"%s"`);
      return output.split('\n').filter((line) => line.trim().length > 0);
    } catch (error) {
      return [];
    }
  }

  /**
   * 生成提交信息
   */
  private async generateCommitMessage(
    diff: string,
    commitHistory: string,
    _options: CommitOptions
  ): Promise<string> {
    const config = this.configManager.config;
    const commitConfig = config.commit || {};

    // 获取语言设置
    const language = commitConfig.language || 'en';

    // 构建系统提示词
    const systemPrompt = commitConfig.systemPrompt || this.getDefaultSystemPrompt(language);

    // 构建用户消息
    let userMessage = `Please analyze the following Git diff and generate a commit message:\n\n${diff}`;

    // 如果有提交历史，添加风格学习
    if (commitHistory) {
      userMessage += `\n\nHere are some recent commits from this repository. Please follow the same style:\n\n${commitHistory}`;
    }

    // 构建完整的提示词（系统提示词 + 用户消息）
    const fullPrompt = `${systemPrompt}\n\n${userMessage}`;

    const response = await this.modelService.chat(fullPrompt);

    return response.content.trim();
  }

  /**
   * 获取默认系统提示词
   */
  private getDefaultSystemPrompt(language: string): string {
    if (language === 'zh') {
      return `你是一个 Git 提交信息生成助手。请根据 Git diff 生成符合 Conventional Commits 规范的提交信息。

提交信息格式：
<type>(<scope>): <subject>

<body>

<footer>

Type 类型：
- feat: 新功能
- fix: Bug 修复
- docs: 文档变更
- style: 代码格式
- refactor: 重构
- perf: 性能优化
- test: 测试相关
- chore: 构建过程或辅助工具的变动

要求：
1. subject 简短清晰，不超过 50 字符
2. body 详细说明变更内容和原因
3. 如果有 breaking changes，在 footer 中说明
4. 如果关闭了 issue，在 footer 中引用

请直接输出提交信息，不要添加任何解释。`;
    }

    return `You are a Git commit message generator. Generate a commit message following the Conventional Commits specification based on the Git diff.

Commit message format:
<type>(<scope>): <subject>

<body>

<footer>

Type options:
- feat: A new feature
- fix: A bug fix
- docs: Documentation only changes
- style: Changes that do not affect the meaning of the code
- refactor: A code change that neither fixes a bug nor adds a feature
- perf: A code change that improves performance
- test: Adding missing tests or correcting existing tests
- chore: Changes to the build process or auxiliary tools

Requirements:
1. subject should be concise and clear, no more than 50 characters
2. body should explain what and why, not how
3. if there are breaking changes, mention them in the footer
4. if closing issues, reference them in the footer

Output only the commit message, no explanations.`;
  }

  /**
   * 执行提交
   */
  private async executeCommit(message: string, options: CommitOptions): Promise<void> {
    // 转义提交信息中的特殊字符
    const escapedMessage = message.replace(/"/g, '\\"').replace(/`/g, '\\`');

    // 构建提交命令
    let command = `git commit -m "${escapedMessage}"`;

    // 添加 --no-verify 选项
    if (options.noVerify) {
      command += ' --no-verify';
    }

    // 如果需要创建新分支
    if (options.checkout) {
      const branchName = await this.promptBranchName();
      if (branchName) {
        this.execCommand(`git checkout -b ${branchName}`);
        console.log(`✅ Created and switched to branch: ${branchName}`);
      }
    }

    // 执行提交
    this.execCommand(command);
  }

  /**
   * 提示输入分支名
   */
  private async promptBranchName(): Promise<string> {
    console.log('Enter branch name:');

    return new Promise((resolve) => {
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim());
      });
    });
  }

  /**
   * 复制到剪贴板
   */
  private async copyToClipboard(text: string): Promise<void> {
    try {
      await clipboard.write(text);
    } catch (error) {
      console.warn('⚠️  Failed to copy to clipboard');
    }
  }

  /**
   * 执行命令
   */
  private execCommand(command: string): string {
    try {
      return execSync(command, { encoding: 'utf-8' });
    } catch (error) {
      throw new Error(`Command failed: ${command}`);
    }
  }
}
