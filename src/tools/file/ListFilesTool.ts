import { Tool } from '../base/Tool';
import { z } from 'zod';
import * as fs from 'node:fs/promises';
import * as path from 'pathe';

/**
 * ListFilesTool - 列出文件工具
 *
 * 功能：
 * 1. 列出目录中的所有文件和子目录
 * 2. 区分文件和目录
 * 3. 返回结构化数据
 *
 * 使用场景：
 * - 查看目录内容
 * - 了解项目结构
 * - 辅助其他工具使用
 */
export class ListFilesTool extends Tool<
  { path: string },
  { files: Array<{ name: string; type: 'file' | 'directory' }> }
> {
  /**
   * 工具名称
   */
  name = 'list_files';

  /**
   * 工具描述
   */
  description =
    '列出目录中的所有文件和子目录。使用"."表示当前工作目录,或使用相对路径如"src"、"src/utils"';

  /**
   * 输入 Schema
   */
  schema = z.object({
    path: z
      .string()
      .describe(
        '目录路径(相对于当前工作目录)。使用"."表示当前目录,或使用相对路径如"src"、"src/utils"'
      ),
  });

  /**
   * 执行列出文件
   *
   * @param input 输入参数
   * @returns 文件列表
   */
  async execute(input: { path: string }): Promise<{
    files: Array<{ name: string; type: 'file' | 'directory' }>;
  }> {
    // 隐藏工具执行日志，通过任务跟踪系统显示

    try {
      // 1. 解析路径
      const dirPath = path.resolve(input.path);

      // 2. 读取目录内容
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      // 3. 转换为结构化数据
      const files = entries.map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? ('directory' as const) : ('file' as const),
      }));

      // 隐藏成功日志，通过任务跟踪系统显示

      return { files };
    } catch (error) {
      // 保留错误日志，因为这是重要信息
      console.error(`❌ Failed to list files: ${input.path}`, error);

      // 抛出友好的错误信息
      if (error instanceof Error) {
        throw new Error(`Failed to list files: ${error.message}`);
      }
      throw new Error('Failed to list files: Unknown error');
    }
  }
}
