import { ContextProvider } from './ContextProvider';
import type { DiagnosticProblem } from '../../types/index';
import * as fs from 'node:fs';
import * as path from 'pathe';

/**
 * ProblemsProvider - 诊断问题提供者
 *
 * 提供代码中的错误、警告等诊断信息
 *
 * 使用场景：
 * - 用户：#Problems 帮我修复这些错误
 * - AI 自动看到所有编译错误
 */
export class ProblemsProvider extends ContextProvider {
  name = 'problems';
  pattern = /#Problems\b/i;
  ttl = 5000; // 5 秒缓存

  /**
   * 解析诊断问题
   *
   * 注意：这里简化实现，实际应该从 LSP 或编译器获取
   *
   * @param match 正则匹配结果
   * @param cwd 当前工作目录
   * @returns 格式化的诊断信息
   */
  async resolve(_match: RegExpMatchArray, cwd: string): Promise<string> {
    try {
      // 1. 获取诊断问题
      const problems = await this.getDiagnosticProblems(cwd);

      // 2. 如果没有问题
      if (problems.length === 0) {
        return `${this.formatHeading('Diagnostic Problems')}\nNo problems found. ✅\n`;
      }

      // 3. 按文件分组
      const problemsByFile = this.groupByFile(problems);

      // 4. 格式化输出
      let output = this.formatHeading('Diagnostic Problems');
      output += `\nFound ${problems.length} problem(s):\n\n`;

      for (const [file, fileProblems] of Object.entries(problemsByFile)) {
        output += this.formatHeading(file, 3);

        for (const problem of fileProblems) {
          const icon = this.getSeverityIcon(problem.severity);
          output += `- ${icon} Line ${problem.line}: ${problem.message}\n`;
          if (problem.code) {
            output += `  Code: ${problem.code}\n`;
          }
        }

        output += '\n';
      }

      return output;
    } catch (error) {
      return this.formatError(error);
    }
  }

  /**
   * 获取诊断问题
   *
   * 简化实现：从 TypeScript 编译器获取错误
   * 实际应该从 LSP 服务器获取
   *
   * @param cwd 当前工作目录
   * @returns 诊断问题列表
   */
  private async getDiagnosticProblems(cwd: string): Promise<DiagnosticProblem[]> {
    // 简化实现：检查是否有 tsconfig.json
    const tsconfigPath = path.join(cwd, 'tsconfig.json');
    if (!fs.existsSync(tsconfigPath)) {
      return [];
    }

    // 实际应该：
    // 1. 启动 TypeScript 语言服务器
    // 2. 获取所有诊断信息
    // 3. 转换为 DiagnosticProblem 格式

    // 这里返回模拟数据作为示例
    return [
      {
        file: 'src/index.ts',
        line: 10,
        column: 5,
        severity: 'error',
        message: "Cannot find module 'xxx'",
        code: 'TS2304',
      },
      {
        file: 'src/utils.ts',
        line: 5,
        column: 10,
        severity: 'warning',
        message: "Property 'foo' is declared but never used",
        code: 'TS6133',
      },
    ];
  }

  /**
   * 按文件分组
   *
   * @param problems 诊断问题列表
   * @returns 按文件分组的问题
   */
  private groupByFile(problems: DiagnosticProblem[]): Record<string, DiagnosticProblem[]> {
    const grouped: Record<string, DiagnosticProblem[]> = {};

    for (const problem of problems) {
      if (!grouped[problem.file]) {
        grouped[problem.file] = [];
      }
      grouped[problem.file].push(problem);
    }

    return grouped;
  }

  /**
   * 获取严重程度图标
   *
   * @param severity 严重程度
   * @returns 图标
   */
  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '•';
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
    return `${this.formatHeading('Diagnostic Problems')}\n❌ Failed to get problems: ${message}\n`;
  }
}
