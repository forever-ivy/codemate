import type { RetrievedMemoryEntry } from './MemoryRetrievalService';

export interface GovernedMemoryEntry extends RetrievedMemoryEntry {
  content: string;
  redacted: boolean;
  originalLength: number;
}

export interface DroppedMemoryEntry {
  id: string;
  reason: 'expired';
}

export interface MemoryGovernanceResult {
  generatedAt: number;
  entryCount: number;
  entries: GovernedMemoryEntry[];
  droppedEntries: DroppedMemoryEntry[];
  redactionCount: number;
  prompt: string;
}

export interface MemoryGovernanceOptions {
  maxAgeMs?: number;
  maxCharsPerEntry?: number;
  now?: () => number;
}

/**
 * MemoryGovernanceService 负责长期记忆进入 prompt 前的治理。
 *
 * 调用链路：
 * MemoryRetrievalService.build -> MemoryGovernanceService.apply -> AgentLoop.buildModelMessage
 *
 * 它不改变原始记忆文件，只在注入模型前做过期过滤、敏感信息脱敏和长度裁剪。
 */
export class MemoryGovernanceService {
  constructor(private options: MemoryGovernanceOptions = {}) {}

  /**
   * 对检索出的记忆执行安全治理，并重新生成可注入 prompt。
   */
  apply(entries: RetrievedMemoryEntry[]): MemoryGovernanceResult {
    const now = this.options.now?.() ?? Date.now();
    const droppedEntries: DroppedMemoryEntry[] = [];
    let redactionCount = 0;
    const governedEntries: GovernedMemoryEntry[] = [];

    for (const entry of entries) {
      if (this.isExpired(entry, now)) {
        droppedEntries.push({
          id: entry.id,
          reason: 'expired',
        });
        continue;
      }

      const redacted = this.redactSecrets(entry.content);
      if (redacted.redacted) {
        redactionCount += 1;
      }

      governedEntries.push({
        ...entry,
        content: this.truncate(redacted.content),
        redacted: redacted.redacted,
        originalLength: entry.content.length,
      });
    }

    return {
      generatedAt: now,
      entryCount: governedEntries.length,
      entries: governedEntries,
      droppedEntries,
      redactionCount,
      prompt:
        governedEntries.length > 0
          ? this.formatPrompt(governedEntries, droppedEntries, redactionCount)
          : '',
    };
  }

  private isExpired(entry: RetrievedMemoryEntry, now: number): boolean {
    if (!this.options.maxAgeMs || entry.updatedAt === undefined) {
      return false;
    }

    return now - entry.updatedAt > this.options.maxAgeMs;
  }

  private redactSecrets(content: string): { content: string; redacted: boolean } {
    const patterns = [
      /sk-[A-Za-z0-9_-]{10,}/g,
      /ghp_[A-Za-z0-9_]{10,}/g,
      /(api[_-]?key\s*=\s*)[^\s"'`]+/gi,
      /(password\s*=\s*)[^\s"'`]+/gi,
      /(token\s*=\s*)[^\s"'`]+/gi,
    ];

    let redacted = false;
    let sanitized = content;
    for (const pattern of patterns) {
      sanitized = sanitized.replace(pattern, (match, prefix: string | undefined) => {
        redacted = true;
        return prefix ? `${prefix}[REDACTED_SECRET]` : '[REDACTED_SECRET]';
      });
    }

    return {
      content: sanitized,
      redacted,
    };
  }

  private formatPrompt(
    entries: GovernedMemoryEntry[],
    droppedEntries: DroppedMemoryEntry[],
    redactionCount: number
  ): string {
    const lines = [
      '## Retrieved Memory',
      '',
      'Memory safety:',
      `- Dropped entries: ${droppedEntries.length}`,
      `- Redacted secrets: ${redactionCount}`,
      '',
      `Matched entries: ${entries.length}`,
    ];

    for (const entry of entries) {
      lines.push(`- ${entry.source}/${entry.label}: ${entry.content}`);
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
}
