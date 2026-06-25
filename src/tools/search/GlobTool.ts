import * as fs from 'node:fs/promises';
import * as path from 'pathe';
import { z } from 'zod';
import { Tool } from '../base/Tool';

/**
 * GlobTool - 文件匹配
 *
 * 功能：
 * 1. 使用通配符匹配文件
 * 2. 支持 ** 递归匹配
 * 3. 返回匹配的文件列表
 *
 * 示例：
 * - *.ts - 所有 TypeScript 文件
 * - **\/*.test.ts - 所有测试文件
 */
export class GlobTool extends Tool {
  name = 'glob';
  description = 'Match files using glob patterns';

  schema = z.object({
    pattern: z.string().describe('Glob pattern (e.g., **/*.ts)'),
    cwd: z.string().optional().describe('Working directory'),
  });

  async execute(input: z.infer<typeof this.schema>): Promise<any> {
    const { pattern, cwd = process.cwd() } = input;

    console.log(`🔍 Matching files: ${pattern}`);

    try {
      const files = await this.glob(pattern, cwd);

      console.log(`✅ Found ${files.length} files`);

      return {
        success: true,
        files,
        count: files.length,
      };
    } catch (error) {
      console.error(`❌ Glob failed:`, error);

      if (error instanceof Error) {
        throw new Error(`Glob failed: ${error.message}`);
      }
      throw new Error('Glob failed: Unknown error');
    }
  }

  /**
   * 简单的 glob 实现
   */
  private async glob(pattern: string, cwd: string): Promise<string[]> {
    const files: string[] = [];

    // 简化实现：只支持 *.ext 和 **\/*.ext
    if (pattern.startsWith('**/')) {
      // 递归匹配
      const ext = pattern.slice(3);
      await this.findFiles(cwd, ext, files);
    } else if (pattern.startsWith('*.')) {
      // 当前目录匹配
      const ext = pattern.slice(1);
      const entries = await fs.readdir(cwd);
      for (const entry of entries) {
        if (entry.endsWith(ext)) {
          files.push(path.join(cwd, entry));
        }
      }
    }

    return files;
  }

  /**
   * 递归查找文件
   */
  private async findFiles(dir: string, ext: string, files: string[]): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.findFiles(fullPath, ext, files);
      } else if (entry.name.endsWith(ext)) {
        files.push(fullPath);
      }
    }
  }
}
