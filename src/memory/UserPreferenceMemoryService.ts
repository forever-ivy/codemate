import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'pathe';

export type UserPreferenceCategory = 'communication' | 'workflow' | 'coding' | 'tooling';

export interface UserPreferenceMemoryEntry {
  id: string;
  category: UserPreferenceCategory;
  content: string;
  source?: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserPreferenceMemorySnapshot {
  generatedAt: number;
  filePath: string;
  entryCount: number;
  entries: UserPreferenceMemoryEntry[];
  prompt: string;
}

export interface UserPreferenceMemoryOptions {
  relativePath?: string;
  maxEntries?: number;
  maxCharsPerEntry?: number;
}

interface UserPreferenceMemoryFile {
  version: 1;
  entries: UserPreferenceMemoryEntry[];
}

/**
 * UserPreferenceMemoryService 负责读取和维护用户级长期偏好。
 *
 * 调用链路：
 * Application.registerServices -> AgentLoop.execute -> UserPreferenceMemoryService.build
 *
 * 它和 ProjectMemoryService 的边界不同：Project Memory 跟仓库走；
 * User Preference Memory 跟用户走，适合保存沟通方式、工作流和工具偏好。
 */
export class UserPreferenceMemoryService {
  constructor(
    private dataDir: string,
    private options: UserPreferenceMemoryOptions = {}
  ) {}

  /**
   * 构建可注入模型输入的用户偏好快照。
   */
  async build(): Promise<UserPreferenceMemorySnapshot> {
    const entries = await this.loadEntries();
    const usableEntries = entries
      .filter((entry) => entry.content.trim().length > 0)
      .slice(-(this.options.maxEntries ?? 8));

    return {
      generatedAt: Date.now(),
      filePath: this.getMemoryFilePath(),
      entryCount: usableEntries.length,
      entries: usableEntries,
      prompt: usableEntries.length > 0 ? this.formatPrompt(usableEntries) : '',
    };
  }

  /**
   * 追加一条用户偏好，并持久化到全局配置目录。
   */
  async add(
    entry: Omit<UserPreferenceMemoryEntry, 'createdAt' | 'updatedAt'>
  ): Promise<UserPreferenceMemoryEntry> {
    const entries = await this.loadEntries();
    const now = Date.now();
    const nextEntry: UserPreferenceMemoryEntry = {
      ...entry,
      createdAt: now,
      updatedAt: now,
    };

    await this.save([...entries, nextEntry]);
    return nextEntry;
  }

  /**
   * 覆盖保存用户偏好文件。后续 Memory 命令可以复用它做管理入口。
   */
  async save(entries: UserPreferenceMemoryEntry[]): Promise<void> {
    const filePath = this.getMemoryFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });
    const payload: UserPreferenceMemoryFile = {
      version: 1,
      entries,
    };

    await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  getMemoryFilePath(): string {
    return path.join(this.dataDir, this.options.relativePath ?? 'memory/user-preferences.json');
  }

  private async loadEntries(): Promise<UserPreferenceMemoryEntry[]> {
    try {
      const raw = await readFile(this.getMemoryFilePath(), 'utf8');
      const parsed = JSON.parse(raw) as Partial<UserPreferenceMemoryFile>;
      if (!Array.isArray(parsed.entries)) {
        return [];
      }

      return parsed.entries.filter((entry): entry is UserPreferenceMemoryEntry =>
        this.isUserPreferenceMemoryEntry(entry)
      );
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return [];
      }

      return [];
    }
  }

  private formatPrompt(entries: UserPreferenceMemoryEntry[]): string {
    const lines = ['## User Preferences', '', `Stored preferences: ${entries.length}`];

    for (const entry of entries) {
      const source = entry.source ? ` (source: ${entry.source})` : '';
      lines.push(`- ${entry.category}: ${this.truncate(entry.content)}${source}`);
    }

    return lines.join('\n');
  }

  private truncate(content: string): string {
    const maxChars = this.options.maxCharsPerEntry ?? 240;
    const normalized = content.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxChars) {
      return normalized;
    }

    return `${normalized.slice(0, maxChars)}...`;
  }

  private isUserPreferenceMemoryEntry(entry: unknown): entry is UserPreferenceMemoryEntry {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const candidate = entry as Partial<UserPreferenceMemoryEntry>;
    return (
      typeof candidate.id === 'string' &&
      this.isUserPreferenceCategory(candidate.category) &&
      typeof candidate.content === 'string' &&
      typeof candidate.createdAt === 'number' &&
      typeof candidate.updatedAt === 'number' &&
      (candidate.source === undefined || typeof candidate.source === 'string')
    );
  }

  private isUserPreferenceCategory(category: unknown): category is UserPreferenceCategory {
    return (
      category === 'communication' ||
      category === 'workflow' ||
      category === 'coding' ||
      category === 'tooling'
    );
  }
}
