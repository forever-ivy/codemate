import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'pathe';

export type ProjectMemoryKind = 'fact' | 'convention' | 'decision' | 'warning';

export interface ProjectMemoryEntry {
  id: string;
  kind: ProjectMemoryKind;
  content: string;
  source?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectMemorySnapshot {
  generatedAt: number;
  filePath: string;
  entryCount: number;
  entries: ProjectMemoryEntry[];
  prompt: string;
}

export interface ProjectMemoryOptions {
  relativePath?: string;
  maxEntries?: number;
  maxCharsPerEntry?: number;
}

interface ProjectMemoryFile {
  version: 1;
  entries: ProjectMemoryEntry[];
}

/**
 * ProjectMemoryService 负责读取和维护仓库级长期记忆。
 *
 * 调用链路：
 * Application.registerServices -> AgentLoop.execute -> ProjectMemoryService.build
 *
 * 它和 SessionMemoryService 的边界不同：Session Memory 只看当前会话历史；
 * Project Memory 会写入仓库本地文件，用来跨会话保存项目约定、决策和风险。
 */
export class ProjectMemoryService {
  constructor(
    private cwd: string,
    private options: ProjectMemoryOptions = {}
  ) {}

  /**
   * 构建可注入模型输入的项目记忆快照。
   */
  async build(): Promise<ProjectMemorySnapshot> {
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
   * 追加一条项目记忆，并持久化到仓库本地文件。
   */
  async add(
    entry: Omit<ProjectMemoryEntry, 'createdAt' | 'updatedAt'>
  ): Promise<ProjectMemoryEntry> {
    const entries = await this.loadEntries();
    const now = Date.now();
    const nextEntry: ProjectMemoryEntry = {
      ...entry,
      createdAt: now,
      updatedAt: now,
    };

    await this.save([...entries, nextEntry]);
    return nextEntry;
  }

  /**
   * 覆盖保存项目记忆文件。测试和后续 Memory 管理命令都会复用它。
   */
  async save(entries: ProjectMemoryEntry[]): Promise<void> {
    const filePath = this.getMemoryFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });
    const payload: ProjectMemoryFile = {
      version: 1,
      entries,
    };

    await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  getMemoryFilePath(): string {
    return path.join(this.cwd, this.options.relativePath ?? '.aicli/memory/project-memory.json');
  }

  private async loadEntries(): Promise<ProjectMemoryEntry[]> {
    try {
      const raw = await readFile(this.getMemoryFilePath(), 'utf8');
      const parsed = JSON.parse(raw) as Partial<ProjectMemoryFile>;
      if (!Array.isArray(parsed.entries)) {
        return [];
      }

      return parsed.entries.filter((entry): entry is ProjectMemoryEntry =>
        this.isProjectMemoryEntry(entry)
      );
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return [];
      }

      return [];
    }
  }

  private formatPrompt(entries: ProjectMemoryEntry[]): string {
    const lines = ['## Project Memory', '', `Stored entries: ${entries.length}`];

    for (const entry of entries) {
      const source = entry.source ? ` (source: ${entry.source})` : '';
      lines.push(`- ${entry.kind}: ${this.truncate(entry.content)}${source}`);
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

  private isProjectMemoryEntry(entry: unknown): entry is ProjectMemoryEntry {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const candidate = entry as Partial<ProjectMemoryEntry>;
    return (
      typeof candidate.id === 'string' &&
      this.isProjectMemoryKind(candidate.kind) &&
      typeof candidate.content === 'string' &&
      typeof candidate.createdAt === 'number' &&
      typeof candidate.updatedAt === 'number' &&
      (candidate.source === undefined || typeof candidate.source === 'string')
    );
  }

  private isProjectMemoryKind(kind: unknown): kind is ProjectMemoryKind {
    return kind === 'fact' || kind === 'convention' || kind === 'decision' || kind === 'warning';
  }
}
