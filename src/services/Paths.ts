import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'pathe';
import type { SessionMetadata, LogEntry } from '../types/index';

/**
 * Paths - 路径管理类
 *
 * 职责：
 * 1. 管理所有文件路径
 * 2. 格式化项目路径
 * 3. 获取会话文件路径
 * 4. 列出所有会话
 *
 */
export class Paths {
  globalConfigDir: string; // 全局配置目录：~/.aicli
  globalProjectDir: string; // 项目会话目录：~/.aicli/projects/{项目}
  projectConfigDir: string; // 项目配置目录：{项目}/.aicli
  private cwd: string; // 当前工作目录

  /**
   * 构造函数
   *
   * @param opts 选项
   */
  constructor(opts: { productName: string; cwd: string }) {
    const productName = opts.productName.toLowerCase();
    this.cwd = opts.cwd;

    // 全局配置目录：~/.aicli
    this.globalConfigDir = path.join(os.homedir(), `.${productName}`);

    // 项目会话目录：~/.aicli/projects/{格式化的项目路径}
    this.globalProjectDir = path.join(this.globalConfigDir, 'projects', this.formatPath(opts.cwd));

    // 项目配置目录：{项目}/.aicli
    this.projectConfigDir = path.join(opts.cwd, `.${productName}`);

    console.log(`✅ Paths initialized`);
    console.log(`   Global config: ${this.globalConfigDir}`);
    console.log(`   Project dir: ${this.globalProjectDir}`);
  }

  /**
   * 获取当前工作目录
   *
   * @returns 当前工作目录
   */
  getCwd(): string {
    return this.cwd;
  }

  /**
   * 获取数据存储目录
   *
   * @returns 数据存储目录路径
   */
  getDataDir(): string {
    return this.globalConfigDir;
  }

  /**
   * 获取会话日志文件路径
   *
   * @param sessionId 会话 ID
   * @returns 会话文件路径
   */
  getSessionLogPath(sessionId: string): string {
    // 如果是绝对路径，直接返回
    if (path.isAbsolute(sessionId)) {
      return sessionId;
    }

    // 如果以 . 开头或以 .jsonl 结尾，相对于当前目录
    if (sessionId.startsWith('.') || sessionId.endsWith('.jsonl')) {
      return path.join(process.cwd(), sessionId);
    }

    // 否则，存储在项目会话目录
    return path.join(this.globalProjectDir, `${sessionId}.jsonl`);
  }

  /**
   * 获取最新的会话 ID
   *
   * @returns 最新会话 ID，如果没有会话则返回 undefined
   */
  getLatestSessionId(): string | undefined {
    if (!fs.existsSync(this.globalProjectDir)) {
      return undefined;
    }

    const jsonlFiles = fs
      .readdirSync(this.globalProjectDir)
      .filter((file) => file.endsWith('.jsonl'))
      .map((file) => {
        const filePath = path.join(this.globalProjectDir, file);
        const stats = fs.statSync(filePath);
        return {
          timestamp: stats.mtime.getTime(),
          created: stats.birthtime.getTime(),
          sessionId: path.basename(file, '.jsonl'),
        };
      });

    if (jsonlFiles.length === 0) {
      return undefined;
    }

    // 按修改时间倒序排序；时间相同时用创建时间和 sessionId 稳定兜底。
    const latest = jsonlFiles.sort(
      (a, b) =>
        b.timestamp - a.timestamp || b.created - a.created || b.sessionId.localeCompare(a.sessionId)
    )[0];
    return latest.sessionId;
  }

  /**
   * 获取所有会话
   *
   * @returns 会话元数据列表（最多 50 个）
   */
  getAllSessions(): SessionMetadata[] {
    if (!fs.existsSync(this.globalProjectDir)) {
      return [];
    }

    const sessions = fs
      .readdirSync(this.globalProjectDir)
      .filter((file) => file.endsWith('.jsonl'))
      .map((file) => {
        const filePath = path.join(this.globalProjectDir, file);
        const stats = fs.statSync(filePath);
        const sessionId = path.basename(file, '.jsonl');

        // 读取消息数量和摘要
        let messageCount = 0;
        let summary = '';

        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n').filter(Boolean);
          messageCount = lines.length;

          // 提取摘要：优先使用 config.summary，否则使用第一条用户消息
          if (lines.length > 0) {
            try {
              const firstEntry: LogEntry = JSON.parse(lines[0]);
              if (firstEntry.type === 'config' && firstEntry.config.summary) {
                summary = firstEntry.config.summary;
              } else {
                summary = this.extractFirstUserMessageSummary(lines);
              }
            } catch {
              summary = this.extractFirstUserMessageSummary(lines);
            }
          }
        } catch {
          // 忽略读取错误
        }

        return {
          sessionId,
          summary: this.normalizeSummary(summary),
          messageCount,
          modified: stats.mtime,
          created: stats.birthtime,
        };
      })
      .sort(
        (a, b) =>
          b.modified.getTime() - a.modified.getTime() ||
          b.created.getTime() - a.created.getTime() ||
          b.sessionId.localeCompare(a.sessionId)
      )
      .slice(0, 50); // 最多返回 50 个会话

    return sessions;
  }

  /**
   * 格式化路径
   *
   * 将文件系统路径转换为安全的文件名
   * 例如：/Users/curry/project → users-curry-project
   *
   * @param from 原始路径
   * @returns 格式化后的路径
   */
  private formatPath(from: string): string {
    return from
      .replace(/^\/+|\/+$/g, '') // 移除首尾斜杠
      .replace(/[^a-zA-Z0-9]/g, '-') // 非字母数字替换为 -
      .replace(/-+/g, '-') // 合并多个 -
      .replace(/^-+|-+$/g, '') // 移除首尾 -
      .toLowerCase(); // 转小写
  }

  /**
   * 提取第一条用户消息作为摘要
   *
   * @param lines .jsonl 文件的所有行
   * @returns 摘要文本
   */
  private extractFirstUserMessageSummary(lines: string[]): string {
    for (const line of lines) {
      try {
        const entry: LogEntry = JSON.parse(line);
        if (
          entry.type === 'message' &&
          entry.role === 'user' &&
          typeof entry.content === 'string'
        ) {
          // 截取前 50 个字符
          return entry.content.length > 50 ? entry.content.slice(0, 50) + '...' : entry.content;
        }
      } catch {
        // 忽略解析错误
      }
    }
    return '';
  }

  /**
   * 规范化摘要文本
   *
   * 移除换行符和多余空格
   *
   * @param summary 原始摘要
   * @returns 规范化后的摘要
   */
  private normalizeSummary(summary: string): string {
    if (!summary) return '';
    return summary
      .replace(/\r\n|\r|\n/g, ' ') // 替换换行符为空格
      .replace(/\s+/g, ' ') // 合并多个空格
      .trim(); // 移除首尾空格
  }
}
