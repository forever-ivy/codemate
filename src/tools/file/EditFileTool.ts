import * as fs from 'node:fs/promises';
import { z } from 'zod';
import { Tool } from '../base/Tool';

/**
 * EditFileTool - 智能编辑文件
 *
 * 功能：
 * 1. 查找旧内容
 * 2. 替换为新内容
 * 3. 支持正则表达式
 *
 * 使用场景：
 * - 修改配置文件
 * - 更新代码
 * - 批量替换
 */
export class EditFileTool extends Tool {
  name = 'edit_file';
  description = 'Edit file content by replacing old content with new content';

  schema = z.object({
    path: z.string().describe('File path to edit'),
    oldContent: z.string().describe('Content to find and replace'),
    newContent: z.string().describe('New content to replace with'),
    regex: z.boolean().optional().describe('Use regex for matching'),
  });

  async execute(input: z.infer<typeof this.schema>): Promise<any> {
    const { path, oldContent, newContent, regex = false } = input;

    try {
      // 🔥 新增：在编辑前追踪文件
      if (this.container) {
        const fileHistory = this.container.getFileHistory();
        await fileHistory.trackFile(input.path);
      }
      // 1. 读取文件
      const content = await fs.readFile(path, 'utf-8');

      // 2. 替换内容
      let newFileContent: string;
      if (regex) {
        const pattern = new RegExp(oldContent, 'g');
        newFileContent = content.replace(pattern, newContent);
      } else {
        newFileContent = content.replace(oldContent, newContent);
      }

      // 3. 检查是否有变化
      if (content === newFileContent) {
        return {
          success: false,
          message: 'No changes made (old content not found)',
        };
      }

      // 4. 写入文件
      await fs.writeFile(path, newFileContent, 'utf-8');

      return {
        success: true,
        message: `File edited: ${path}`,
        changes: newFileContent.length - content.length,
      };
    } catch (error) {
      console.error(`❌ Failed to edit file: ${path}`, error);

      if (error instanceof Error) {
        throw new Error(`Failed to edit file: ${error.message}`);
      }
      throw new Error('Failed to edit file: Unknown error');
    }
  }
}
