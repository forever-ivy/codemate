import * as fs from 'node:fs/promises';
import * as path from 'pathe';
import { z } from 'zod';
import { Tool } from '../base/Tool';

/**
 * GrepTool - 文本搜索
 *
 * 功能：
 * 1. 在文件中搜索文本
 * 2. 支持正则表达式
 * 3. 返回匹配行和行号
 *
 * 类似 Unix 的 grep 命令
 */
export class GrepTool extends Tool {
  name = 'grep';
  description = 'Search for text in files';

  schema = z.object({
    pattern: z.string().describe('Search pattern (regex supported)'),
    path: z.string().describe('File or directory path to search'),
    regex: z.boolean().optional().describe('Use regex for matching'),
    caseSensitive: z.boolean().optional().describe('Case sensitive search'),
  });

  async execute(input: z.infer<typeof this.schema>): Promise<any> {
    const { pattern, path: searchPath, regex = false, caseSensitive = false } = input;

    console.log(`🔍 Searching for: ${pattern} in ${searchPath}`);

    try {
      const stats = await fs.stat(searchPath);
      const results: Array<{ file: string; line: number; content: string }> = [];

      if (stats.isDirectory()) {
        // 搜索目录（递归）
        console.log(`📁 Searching directory: ${searchPath}`);
        const files = await this.getFiles(searchPath);
        console.log(`📄 Found ${files.length} files to search`);

        for (const file of files) {
          try {
            const matches = await this.searchFile(file, pattern, regex, caseSensitive);
            results.push(...matches);
          } catch (error) {
            // 跳过无法读取的文件
            console.warn(`⚠️  Skipping file ${file}: ${error}`);
          }
        }
      } else if (stats.isFile()) {
        // 搜索单个文件
        const matches = await this.searchFile(searchPath, pattern, regex, caseSensitive);
        results.push(...matches);
      } else {
        throw new Error(`Path is neither a file nor a directory: ${searchPath}`);
      }

      console.log(`✅ Found ${results.length} matches`);

      return {
        success: true,
        matches: results,
        count: results.length,
      };
    } catch (error) {
      console.error(`❌ Search failed:`, error);

      if (error instanceof Error) {
        throw new Error(`Search failed: ${error.message}`);
      }
      throw new Error('Search failed: Unknown error');
    }
  }

  /**
   * 搜索单个文件
   */
  private async searchFile(
    filePath: string,
    pattern: string,
    regex: boolean,
    caseSensitive: boolean
  ): Promise<Array<{ file: string; line: number; content: string }>> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const results: Array<{ file: string; line: number; content: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let matches: boolean;

      if (regex) {
        // 使用正则表达式搜索
        const searchPattern = new RegExp(pattern, caseSensitive ? '' : 'i');
        matches = searchPattern.test(line);
      } else {
        // 使用字符串搜索
        matches = caseSensitive
          ? line.includes(pattern)
          : line.toLowerCase().includes(pattern.toLowerCase());
      }

      if (matches) {
        results.push({
          file: filePath,
          line: i + 1,
          content: line.trim(),
        });
      }
    }

    return results;
  }

  /**
   * 递归获取所有文件
   */
  private async getFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.getFiles(fullPath)));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }
}
