import { ContextProvider } from './ContextProvider';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * GitProvider - Git diff 提供者
 *
 * 提供 Git 未提交的变更
 *
 * 使用场景：
 * - 用户：#Git 帮我审查这次提交
 * - AI 自动看到 Git diff
 */
export class GitProvider extends ContextProvider {
  name = 'git';
  pattern = /#Git\b/i;
  ttl = 10000; // 10 秒缓存

  private maxDiffLength = 10000; // 最大 diff 长度

  /**
   * 解析 Git diff
   *
   * @param match 正则匹配结果
   * @param cwd 当前工作目录
   * @returns 格式化的 Git diff
   */
  async resolve(_match: RegExpMatchArray, cwd: string): Promise<string> {
    try {
      // 1. 检查是否是 Git 仓库
      const isGitRepo = await this.isGitRepository(cwd);
      if (!isGitRepo) {
        return `${this.formatHeading('Git Changes')}\nNot a Git repository.\n`;
      }

      // 2. 获取 Git diff
      const diff = await this.getGitDiff(cwd);

      // 3. 如果没有变更
      if (!diff) {
        return `${this.formatHeading('Git Changes')}\nNo uncommitted changes. ✅\n`;
      }

      // 4. 格式化输出
      let result = this.formatHeading('Git Changes');
      result += '\n';
      result += this.formatCodeBlock(diff, 'diff');
      result += '\n';

      return result;
    } catch (error) {
      return this.formatError(error);
    }
  }

  /**
   * 检查是否是 Git 仓库
   *
   * @param cwd 当前工作目录
   * @returns 是否是 Git 仓库
   */
  private async isGitRepository(cwd: string): Promise<boolean> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取 Git diff
   *
   * @param cwd 当前工作目录
   * @returns Git diff 内容
   */
  private async getGitDiff(cwd: string): Promise<string | null> {
    try {
      // 获取未暂存的变更
      const { stdout: unstagedDiff } = await execAsync('git diff', { cwd });

      // 获取已暂存的变更
      const { stdout: stagedDiff } = await execAsync('git diff --cached', {
        cwd,
      });

      // 合并两种变更
      let diff = '';

      if (stagedDiff) {
        diff += '# Staged changes\n\n';
        diff += stagedDiff;
        diff += '\n';
      }

      if (unstagedDiff) {
        diff += '# Unstaged changes\n\n';
        diff += unstagedDiff;
      }

      if (!diff) {
        return null;
      }

      // 截断过长的 diff
      if (diff.length > this.maxDiffLength) {
        diff = diff.slice(0, this.maxDiffLength);
        diff += '\n\n...(truncated)';
      }

      return diff;
    } catch (error) {
      return null;
    }
  }

  /**
   * 格式化错误
   *
   * @param error 错误对象
   * @returns 格式化的错误信息
   */
  private formatError(error: unknown): string {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `${this.formatHeading('Git Changes')}\n❌ Failed to get Git diff: ${message}\n`;
  }
}
