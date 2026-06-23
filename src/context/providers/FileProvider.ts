import { ContextProvider } from './ContextProvider';
import * as fs from 'node:fs';
import * as path from 'pathe';

/**
 * FileProvider - 文件内容提供者
 *
 * 提供指定文件的内容
 *
 * 使用场景：
 * - 用户：#File src/index.ts 帮我优化这个文件
 * - AI 自动看到文件内容
 */
export class FileProvider extends ContextProvider {
  name = 'file';
  pattern = /#File\s+(\S+)/i; // 只匹配文件路径（非空白字符）
  ttl = 30000; // 30 秒缓存

  private maxFileSize = 50000; // 最大文件大小（字节）

  /**
   * 解析文件内容
   *
   * @param match 正则匹配结果
   * @param cwd 当前工作目录
   * @returns 格式化的文件内容
   */
  async resolve(match: RegExpMatchArray, cwd: string): Promise<string> {
    try {
      // 1. 提取文件路径
      const filePath = match[1].trim();
      const absolutePath = path.resolve(cwd, filePath);

      // 2. 检查文件是否存在
      if (!fs.existsSync(absolutePath)) {
        return `${this.formatHeading(`File: ${filePath}`)}\n❌ File not found: ${filePath}\n`;
      }

      // 3. 检查是否是文件
      const stats = fs.statSync(absolutePath);
      if (!stats.isFile()) {
        return `${this.formatHeading(`File: ${filePath}`)}\n❌ Not a file: ${filePath}\n`;
      }

      // 4. 检查文件大小
      if (stats.size > this.maxFileSize) {
        return `${this.formatHeading(`File: ${filePath}`)}\n❌ File too large: ${this.formatBytes(stats.size)} (max: ${this.formatBytes(this.maxFileSize)})\n`;
      }

      // 5. 读取文件内容
      const content = fs.readFileSync(absolutePath, 'utf-8');

      // 6. 检测语言
      const language = this.detectLanguage(filePath);

      // 7. 格式化输出
      let result = this.formatHeading(`File: ${filePath}`);
      result += '\n';
      result += this.formatCodeBlock(content, language);
      result += '\n';

      return result;
    } catch (error) {
      return this.formatError(error, match[1].trim());
    }
  }

  /**
   * 生成缓存键
   *
   * 包含文件路径，每个文件独立缓存
   *
   * @param match 正则匹配结果
   * @returns 缓存键
   */
  getCacheKey(match: RegExpMatchArray): string {
    const filePath = match[1].trim();
    return `${this.name}:${filePath}`;
  }

  /**
   * 检测文件语言
   *
   * 根据文件扩展名检测语言
   *
   * @param filePath 文件路径
   * @returns 语言标识
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.cs': 'csharp',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.md': 'markdown',
      '.sh': 'bash',
      '.sql': 'sql',
    };

    return languageMap[ext] || '';
  }

  /**
   * 格式化字节数
   *
   * @param bytes 字节数
   * @returns 格式化的字符串
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * 格式化错误
   *
   * @param error 错误对象
   * @param filePath 文件路径
   * @returns 格式化的错误信息
   */
  private formatError(error: unknown, filePath: string): string {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `${this.formatHeading(`File: ${filePath}`)}\n❌ Failed to read file: ${message}\n`;
  }
}
