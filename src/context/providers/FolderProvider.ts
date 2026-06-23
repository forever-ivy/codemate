import { ContextProvider } from './ContextProvider';
import * as fs from 'node:fs';
import * as path from 'pathe';

/**
 * FolderProvider - 目录结构提供者
 *
 * 提供指定目录的结构
 *
 * 使用场景：
 * - 用户：#Folder src 帮我理解项目结构
 * - AI 自动看到目录结构
 */
export class FolderProvider extends ContextProvider {
  name = 'folder';
  pattern = /#Folder\s+(\S+)/i; // 只匹配目录路径（非空白字符）
  ttl = 60000; // 60 秒缓存

  private maxDepth = 5; // 最大深度
  private maxFiles = 100; // 最大文件数

  /**
   * 解析目录结构
   *
   * @param match 正则匹配结果
   * @param cwd 当前工作目录
   * @returns 格式化的目录结构
   */
  async resolve(match: RegExpMatchArray, cwd: string): Promise<string> {
    try {
      // 1. 提取目录路径
      const folderPath = match[1].trim();
      const absolutePath = path.resolve(cwd, folderPath);

      // 2. 检查目录是否存在
      if (!fs.existsSync(absolutePath)) {
        return `${this.formatHeading(`Folder: ${folderPath}`)}\n❌ Folder not found: ${folderPath}\n`;
      }

      // 3. 检查是否是目录
      const stats = fs.statSync(absolutePath);
      if (!stats.isDirectory()) {
        return `${this.formatHeading(`Folder: ${folderPath}`)}\n❌ Not a folder: ${folderPath}\n`;
      }

      // 4. 读取目录结构
      const tree = this.buildTree(absolutePath, 0);

      // 5. 格式化输出
      let result = this.formatHeading(`Folder: ${folderPath}`);
      result += '\n';
      result += this.formatCodeBlock(tree, '');
      result += '\n';

      return result;
    } catch (error) {
      return this.formatError(error, match[1].trim());
    }
  }

  /**
   * 生成缓存键
   *
   * 包含目录路径，每个目录独立缓存
   *
   * @param match 正则匹配结果
   * @returns 缓存键
   */
  getCacheKey(match: RegExpMatchArray): string {
    const folderPath = match[1].trim();
    return `${this.name}:${folderPath}`;
  }

  /**
   * 构建目录树
   *
   * @param dirPath 目录路径
   * @param depth 当前深度
   * @param prefix 前缀（用于缩进）
   * @returns 目录树字符串
   */
  private buildTree(dirPath: string, depth: number, prefix = ''): string {
    // 检查深度限制
    if (depth >= this.maxDepth) {
      return `${prefix}...(max depth reached)\n`;
    }

    let result = '';
    let fileCount = 0;

    try {
      // 读取目录内容
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      // 过滤隐藏文件和 node_modules
      const filteredEntries = entries.filter((entry) => {
        return !entry.name.startsWith('.') && entry.name !== 'node_modules';
      });

      // 排序：目录在前，文件在后
      filteredEntries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      // 遍历条目
      for (let i = 0; i < filteredEntries.length; i++) {
        // 检查文件数限制
        if (fileCount >= this.maxFiles) {
          result += `${prefix}...(max files reached)\n`;
          break;
        }

        const entry = filteredEntries[i];
        const isLast = i === filteredEntries.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const childPrefix = prefix + (isLast ? '    ' : '│   ');

        if (entry.isDirectory()) {
          // 目录
          result += `${prefix}${connector}${entry.name}/\n`;

          // 递归处理子目录
          const childPath = path.join(dirPath, entry.name);
          result += this.buildTree(childPath, depth + 1, childPrefix);
        } else {
          // 文件
          result += `${prefix}${connector}${entry.name}\n`;
          fileCount++;
        }
      }
    } catch (error) {
      result += `${prefix}...(error reading directory)\n`;
    }

    return result;
  }

  /**
   * 格式化错误
   *
   * @param error 错误对象
   * @param folderPath 目录路径
   * @returns 格式化的错误信息
   */
  private formatError(error: unknown, folderPath: string): string {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `${this.formatHeading(`Folder: ${folderPath}`)}\n❌ Failed to read folder: ${message}\n`;
  }
}
