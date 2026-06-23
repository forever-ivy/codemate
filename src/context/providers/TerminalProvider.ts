import { ContextProvider } from './ContextProvider';
import * as fs from 'node:fs';
import * as path from 'pathe';

/**
 * TerminalProvider - 终端输出提供者
 *
 * 提供最近的终端输出
 *
 * 使用场景：
 * - 用户：#Terminal 为什么测试失败了？
 * - AI 自动看到终端输出
 */
export class TerminalProvider extends ContextProvider {
  name = 'terminal';
  pattern = /#Terminal\b/i;
  ttl = 2000; // 2 秒缓存

  private maxOutputLength = 5000; // 最大输出长度

  /**
   * 解析终端输出
   *
   * @param match 正则匹配结果
   * @param cwd 当前工作目录
   * @returns 格式化的终端输出
   */
  async resolve(_match: RegExpMatchArray, cwd: string): Promise<string> {
    try {
      // 1. 获取终端输出
      const output = await this.getTerminalOutput(cwd);

      // 2. 如果没有输出
      if (!output) {
        return `${this.formatHeading('Terminal Output')}\nNo recent terminal output found.\n`;
      }

      // 3. 格式化输出
      let result = this.formatHeading('Terminal Output');
      result += '\n';
      result += this.formatCodeBlock(output, 'bash');
      result += '\n';

      return result;
    } catch (error) {
      return this.formatError(error);
    }
  }

  /**
   * 获取终端输出
   *
   * 简化实现：从日志文件读取
   * 实际应该从终端会话获取
   *
   * @param cwd 当前工作目录
   * @returns 终端输出
   */
  private async getTerminalOutput(cwd: string): Promise<string | null> {
    // 简化实现：读取 .codemate/terminal.log
    const logPath = path.join(cwd, '.codemate', 'terminal.log');

    if (!fs.existsSync(logPath)) {
      return null;
    }

    try {
      let content = fs.readFileSync(logPath, 'utf-8');

      // 截断过长的输出
      if (content.length > this.maxOutputLength) {
        content = content.slice(-this.maxOutputLength);
        content = '...(truncated)\n' + content;
      }

      return content;
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
    return `${this.formatHeading('Terminal Output')}\n❌ Failed to get terminal output: ${message}\n`;
  }
}
