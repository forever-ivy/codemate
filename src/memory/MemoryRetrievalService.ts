import type { ProjectMemorySnapshot } from './ProjectMemoryService';
import type { UserPreferenceMemorySnapshot } from './UserPreferenceMemoryService';

export type RetrievedMemorySource = 'user-preference' | 'project';

export interface RetrievedMemoryEntry {
  id: string;
  source: RetrievedMemorySource;
  label: string;
  content: string;
  score: number;
  updatedAt?: number;
}

export interface RetrievedMemorySnapshot {
  generatedAt: number;
  entryCount: number;
  entries: RetrievedMemoryEntry[];
  prompt: string;
}

export interface MemoryRetrievalInput {
  userMessage: string;
  userPreferences?: UserPreferenceMemorySnapshot;
  projectMemory?: ProjectMemorySnapshot;
}

export interface MemoryRetrievalOptions {
  maxEntries?: number;
  maxCharsPerEntry?: number;
  minScore?: number;
}

/**
 * MemoryRetrievalService 负责按当前请求筛选长期记忆。
 *
 * 调用链路：
 * AgentLoop.execute -> MemoryRetrievalService.build -> AgentLoop.buildModelMessage
 *
 * 它不读取文件、不写入文件，只处理已经由 UserPreferenceMemoryService 和
 * ProjectMemoryService 构建出来的记忆快照。
 */
export class MemoryRetrievalService {
  constructor(private options: MemoryRetrievalOptions = {}) {}

  /**
   * 从用户偏好和项目记忆中挑出与当前请求最相关的条目。
   */
  build(input: MemoryRetrievalInput): RetrievedMemorySnapshot {
    const queryTokens = this.tokenize(input.userMessage);
    const entries = [
      ...this.scoreUserPreferences(input.userPreferences, queryTokens),
      ...this.scoreProjectMemory(input.projectMemory, queryTokens),
    ]
      .filter((entry) => entry.score >= (this.options.minScore ?? 2))
      .sort((a, b) => b.score - a.score)
      .slice(0, this.options.maxEntries ?? 6);

    return {
      generatedAt: Date.now(),
      entryCount: entries.length,
      entries,
      prompt: entries.length > 0 ? this.formatPrompt(entries) : '',
    };
  }

  private scoreUserPreferences(
    snapshot: UserPreferenceMemorySnapshot | undefined,
    queryTokens: Set<string>
  ): RetrievedMemoryEntry[] {
    if (!snapshot) {
      return [];
    }

    return snapshot.entries.map((entry) => ({
      id: entry.id,
      source: 'user-preference',
      label: entry.category,
      content: entry.content,
      score: this.scoreText(`${entry.category} ${entry.content}`, queryTokens),
      updatedAt: entry.updatedAt,
    }));
  }

  private scoreProjectMemory(
    snapshot: ProjectMemorySnapshot | undefined,
    queryTokens: Set<string>
  ): RetrievedMemoryEntry[] {
    if (!snapshot) {
      return [];
    }

    return snapshot.entries.map((entry) => ({
      id: entry.id,
      source: 'project',
      label: entry.kind,
      content: entry.content,
      score: this.scoreText(`${entry.kind} ${entry.content}`, queryTokens),
      updatedAt: entry.updatedAt,
    }));
  }

  private formatPrompt(entries: RetrievedMemoryEntry[]): string {
    const lines = ['## Retrieved Memory', '', `Matched entries: ${entries.length}`];

    for (const entry of entries) {
      lines.push(`- ${entry.source}/${entry.label}: ${this.truncate(entry.content)}`);
    }

    return lines.join('\n');
  }

  private scoreText(content: string, queryTokens: Set<string>): number {
    const contentTokens = this.tokenize(content);
    let score = 0;

    for (const token of queryTokens) {
      if (contentTokens.has(token)) {
        score += 1;
      }
    }

    return score;
  }

  private tokenize(content: string): Set<string> {
    const normalized = content
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
    if (!normalized) {
      return new Set();
    }

    const tokens = normalized.split(/\s+/).filter(Boolean);
    for (const char of normalized) {
      if (char.charCodeAt(0) > 127 && /\p{L}|\p{N}/u.test(char)) {
        tokens.push(char);
      }
    }

    return new Set(tokens);
  }

  private truncate(content: string): string {
    const maxChars = this.options.maxCharsPerEntry ?? 240;
    const normalized = content.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxChars) {
      return normalized;
    }

    return `${normalized.slice(0, maxChars)}...`;
  }
}
