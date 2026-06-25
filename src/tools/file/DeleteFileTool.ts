import * as fs from 'node:fs/promises';
import { z } from 'zod';
import { Tool } from '../base/Tool';

/**
 * DeleteFileTool - 删除文件
 *
 * 功能：
 * 1. 删除单个文件
 * 2. 删除目录（递归）
 * 3. 安全检查
 *
 * 注意：这是危险操作！
 */
export class DeleteFileTool extends Tool {
  name = 'delete_file';
  description = 'Delete a file or directory';

  schema = z.object({
    path: z.string().describe('File or directory path to delete'),
    recursive: z.boolean().optional().describe('Delete directory recursively'),
  });

  async execute(input: z.infer<typeof this.schema>): Promise<any> {
    const { path, recursive = false } = input;

    console.log(`🗑️  Deleting: ${path}`);

    try {
      // 🔥 新增：在删除前追踪文件
      if (this.container) {
        const fileHistory = this.container.getFileHistory();
        await fileHistory.trackFile(input.path);
      }
      // 1. 检查文件是否存在
      const stats = await fs.stat(path);

      // 2. 删除
      if (stats.isDirectory()) {
        if (!recursive) {
          throw new Error('Cannot delete directory without recursive flag');
        }
        await fs.rm(path, { recursive: true, force: true });
      } else {
        await fs.unlink(path);
      }

      console.log(`✅ Deleted successfully`);

      return {
        success: true,
        message: `Deleted: ${path}`,
        type: stats.isDirectory() ? 'directory' : 'file',
      };
    } catch (error) {
      console.error(`❌ Failed to delete: ${path}`, error);

      if (error instanceof Error) {
        throw new Error(`Failed to delete: ${error.message}`);
      }
      throw new Error('Failed to delete: Unknown error');
    }
  }
}
