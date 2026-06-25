import { Tool } from '../base/Tool';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'pathe';

/**
 * 读取文件工具
 *
 * 功能：读取指定路径的文件内容
 *
 * 输入：{ path: string }
 * 输出：{ content: string, size: number }
 */
export class ReadFileTool extends Tool<{ path: string }, { content: string; size: number }> {
  /**
   * 工具名称
   */
  name = 'read_file';

  /**
   * 工具描述
   *
   * 这个描述很重要!
   * AI 会根据这个描述决定是否使用这个工具
   */
  description = '读取文件内容。使用相对路径,如"src/utils/file.ts"或"README.md"';

  /**
   * 输入模式
   *
   * 定义工具需要什么参数
   */
  schema = z.object({
    path: z.string().describe('文件路径(相对于当前工作目录),如"src/utils/file.ts"'),
  });

  /**
   * 执行工具
   *
   * @param input 已验证的输入
   * @returns 文件内容和大小
   */
  async execute(input: { path: string }): Promise<{ content: string; size: number }> {
    // 隐藏工具执行日志，通过任务跟踪系统显示

    try {
      // 解析路径（支持相对路径）
      const fullPath = path.resolve(input.path);

      // 检查文件是否存在
      try {
        await fs.access(fullPath);
      } catch {
        throw new Error(`File not found: ${input.path}`);
      }

      // 读取文件内容
      const content = await fs.readFile(fullPath, 'utf-8');
      const size = content.length;

      // 隐藏成功日志，通过任务跟踪系统显示

      return {
        content,
        size,
      };
    } catch (error) {
      console.error(`❌ Failed to read file: ${input.path}`, error);

      if (error instanceof Error) {
        throw new Error(`Failed to read file: ${error.message}`);
      }
      throw new Error('Failed to read file: Unknown error');
    }
  }
}
