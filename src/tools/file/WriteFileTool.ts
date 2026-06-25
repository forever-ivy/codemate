import { Tool } from '../base/Tool';
import { z } from 'zod';
import * as fs from 'node:fs/promises';
import * as path from 'pathe';

/**
 * WriteFileTool - 写入文件工具
 *
 * 功能：
 * 1. 写入文件内容
 * 2. 如果文件不存在，自动创建
 * 3. 如果目录不存在，自动创建目录
 * 4. 返回写入的字节数
 *
 * 使用场景：
 * - 创建新文件
 * - 覆盖现有文件
 * - 保存 AI 生成的内容
 */
export class WriteFileTool extends Tool<
  { path: string; content: string },
  { success: boolean; bytesWritten: number }
> {
  /**
   * 工具名称
   *
   * 这是 AI 调用时使用的标识符
   */
  name = 'write_file';

  /**
   * 工具描述
   *
   * 这是给 AI 看的,要清晰描述工具的功能和使用方法
   */
  description =
    '写入文件内容。使用相对路径如"src/utils/file.ts"。如果文件不存在会自动创建,如果存在会覆盖';

  /**
   * 输入 Schema
   *
   * 使用 Zod 定义输入格式:
   * - path: 文件路径(必需)
   * - content: 文件内容(必需)
   */
  schema = z.object({
    path: z.string().describe('文件路径(相对于当前工作目录),如"src/utils/file.ts"'),
    content: z.string().describe('文件内容'),
  });

  /**
   * 执行写入文件
   *
   * @param input 输入参数
   * @returns 写入结果
   */
  async execute(input: { path: string; content: string }): Promise<{
    success: boolean;
    bytesWritten: number;
  }> {
    // 隐藏工具执行日志，通过任务跟踪系统显示

    try {
      // 🔥 新增：在写入前追踪文件
      if (this.container) {
        const fileHistory = this.container.getFileHistory();
        await fileHistory.trackFile(input.path);
      }
      // 1. 解析路径
      const filePath = path.resolve(input.path);
      const dirPath = path.dirname(filePath);

      // 2. 确保目录存在
      await fs.mkdir(dirPath, { recursive: true });

      // 3. 写入文件
      await fs.writeFile(filePath, input.content, 'utf-8');

      // 4. 计算字节数
      const bytesWritten = Buffer.byteLength(input.content, 'utf-8');

      // 隐藏成功日志，通过任务跟踪系统显示

      return {
        success: true,
        bytesWritten,
      };
    } catch (error) {
      console.error(`❌ Failed to write file: ${input.path}`, error);

      // 抛出友好的错误信息
      if (error instanceof Error) {
        throw new Error(`Failed to write file: ${error.message}`);
      }
      throw new Error('Failed to write file: Unknown error');
    }
  }
}
